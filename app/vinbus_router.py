
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi import WebSocket, WebSocketDisconnect
import json
import asyncio
import math
from datetime import datetime
from app.vinbus.vinbus.vinbus_api.client import VinbusClient
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
from app.vinbus.providers import get_llm_provider
from app.vinbus.mcp_server import MCPVinBusServer
from app.vinbus.app import run_react_agent, run_react_agent_stream
from dotenv import load_dotenv

load_dotenv()

from fastapi import APIRouter
router = APIRouter(prefix="/api")

# Setup CORS cho React


provider = get_llm_provider()
mcp_server = MCPVinBusServer()

class ChatRequest(BaseModel):
    query: str
    history: List[Dict[str, str]] = []

@router.post("/chat")
def chat(request: ChatRequest):
    # Dùng list() để clone history, tránh thay đổi trực tiếp request object
    chat_history = list(request.history)
    
    # Chạy ReAct Agent
    logs = run_react_agent(request.query, provider, mcp_server, chat_history=chat_history)
    
    final_answer = ""
    for log in logs:
        if log.get("action_type") == "FINAL_ANSWER":
            final_answer = log.get("output", "")
            
    return {
        "final_answer": final_answer,
        "logs": logs
    }



from fastapi import Request, Depends, HTTPException, Header
from app.main import get_rate_limiter, get_cost_guard, RateLimiter, CostGuard, get_redis_client

def check_security(request: Request, x_session_id: str = Header(default="anonymous"), limiter: RateLimiter = Depends(get_rate_limiter), guard: CostGuard = Depends(get_cost_guard)):
    client_ip = request.client.host if request.client else "127.0.0.1"
    # Kiểm tra Rate limit kép (hàm check tự raise exception)
    limiter.check(f"session:{x_session_id}")
    limiter.check(f"ip:{client_ip}")
    
    # Kiểm tra Cost guard kép (giả sử mỗi phiên chat tốn 0.001$)
    cost_estimate = 0.001
    guard.check(f"session:{x_session_id}", estimated_cost=cost_estimate)
    guard.check(f"ip:{client_ip}", estimated_cost=cost_estimate)
        
    return x_session_id, client_ip

@router.post("/chat/stream")
def chat_stream(request: ChatRequest, req: Request, deps = Depends(check_security), redis_client = Depends(get_redis_client), guard: CostGuard = Depends(get_cost_guard)):
    x_session_id, client_ip = deps
    
    # Fetch history từ Redis
    history_key = f"chat_history:{x_session_id}"
    history_data = redis_client.get(history_key)
    import json
    if history_data:
        saved_history = json.loads(history_data)
    else:
        saved_history = []
        
    # Gộp history từ DB và request (FE gửi lên) - Tuỳ logic, ở đây lấy Redis làm chuẩn
    chat_history = saved_history

    chat_history = list(request.history)
    
    def generate():
        total_cost = 0.001 # Giả sử cost cố định
        try:
            # ReAct agent
            for log in run_react_agent_stream(request.query, provider, mcp_server, chat_history=chat_history):
                yield f"data: {json.dumps(log, ensure_ascii=False)}\n\n"
            
            # Record cost
            guard.record(f"session:{x_session_id}", total_cost)
            guard.record(f"ip:{client_ip}", total_cost)
            
            # Save history to Redis (max 10 turns = 20 messages)
            chat_history.append({"role": "user", "content": request.query})
            # Lưu ý: run_react_agent_stream tự append vào chat_history tham chiếu
            
            # Keep last 10 turns (20 messages)
            if len(chat_history) > 20:
                chat_history[:] = chat_history[-20:]
                
            redis_client.setex(history_key, 86400, json.dumps(chat_history))
            
        except Exception as e:
            if "vi phạm" in str(e).lower() or "blocked" in str(e).lower() or "safety" in str(e).lower():
                yield f"data: {json.dumps({'error': 'Nội dung vi phạm chính sách an toàn của OpenRouter.'})}\n\n"
            else:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
            
    return StreamingResponse(generate(), media_type="text/event-stream")

import uuid

class JITTrackerManager:
    def __init__(self):
        # Quản lý WebSockets theo trạm và session: { station_id: { session_id: {"ws": WebSocket, ...} } }
        self.active_connections: Dict[int, Dict[str, Dict[str, Any]]] = {}
        self.bg_task = None
        self.client = VinbusClient(timeout=10) # Singleton Client

    async def connect(self, station_id: int, session_id: str, client_info: Dict[str, Any]):
        if station_id not in self.active_connections:
            self.active_connections[station_id] = {}
            
        # Nếu session_id đã tồn tại (do reconnect), đóng kết nối cũ
        if session_id in self.active_connections[station_id]:
            try:
                old_ws = self.active_connections[station_id][session_id]["ws"]
                await old_ws.close(code=1000, reason="Session replaced")
            except Exception:
                pass
                
        self.active_connections[station_id][session_id] = client_info
        
        # Khởi động Background Task nếu chưa chạy
        if self.bg_task is None or self.bg_task.done():
            self.bg_task = asyncio.create_task(self._tracker_loop())

    def disconnect(self, station_id: int, session_id: str):
        if station_id in self.active_connections:
            if session_id in self.active_connections[station_id]:
                del self.active_connections[station_id][session_id]
            if not self.active_connections[station_id]:
                del self.active_connections[station_id]

    async def _tracker_loop(self):
        while True:
            if not self.active_connections:
                await asyncio.sleep(5)
                continue

            # Snapshot danh sách trạm cần kiểm tra
            station_ids = list(self.active_connections.keys())
            
            for station_id in station_ids:
                sessions = self.active_connections.get(station_id, {})
                if not sessions:
                    continue
                    
                # Lấy region_code từ session đầu tiên
                first_session = next(iter(sessions.values()))
                region_code = first_session.get("region", "hn")
                
                try:
                    # 🌐 GỌI API VINBUS ĐÚNG 1 LẦN DUY NHẤT CHO TRẠM NÀY
                    etas = await asyncio.to_thread(self.client.get_eta, region_code, station_id, 1, 0)
                    
                    # 📡 BROADCAST DATA ĐẾN TẤT CẢ SESSIONS
                    for sess_id, client in list(sessions.items()):
                        ws = client["ws"]
                        route_no = client["route_no"]
                        walk_time = client["walk_time"]
                        buffer_mins = 2
                        
                        current_buses = []
                        for target_route in etas:
                            if target_route.get('routeNo') == route_no:
                                for bus in target_route.get('list', []):
                                    bus['routeNo'] = route_no
                                    current_buses.append(bus)
                                    
                        fastest_eta = float('inf')
                        for bus in current_buses:
                            eta_mins = math.ceil(bus.get('time', float('inf')) / 60)
                            if eta_mins < fastest_eta:
                                fastest_eta = eta_mins
                        
                        alert_msg = ""
                        if fastest_eta != float('inf'):
                            if fastest_eta <= walk_time + buffer_mins:
                                alert_msg = f"🔔 BẮT ĐẦU DI CHUYỂN NGAY! Xe sắp tới trong {fastest_eta} phút."
                            status_msg = f"⏱️ Cập nhật lúc {datetime.now().strftime('%H:%M:%S')}"
                        else:
                            status_msg = f"💤 Không có xe nào trên tuyến. Cập nhật lúc {datetime.now().strftime('%H:%M:%S')}"

                        payload = {
                            "buses": current_buses,
                            "fastest_eta": fastest_eta if fastest_eta != float('inf') else None,
                            "alert": alert_msg,
                            "status": status_msg
                        }
                        
                        try:
                            await ws.send_json(payload)
                        except Exception:
                            # Dọn dẹp session ngay nếu gửi lỗi (client disconnect đột ngột)
                            self.disconnect(station_id, sess_id)

                except Exception as e:
                    print(f"[TrackerManager] Lỗi khi lấy data trạm {station_id}: {e}")
            
            # Cố định tốc độ quét 20 giây/lần cho toàn hệ thống
            await asyncio.sleep(20)

tracker_manager = JITTrackerManager()

@router.websocket("/ws/tracker")
async def websocket_tracker(websocket: WebSocket):
    await websocket.accept()
    
    # Lấy thông số từ query params
    region_code = websocket.query_params.get("region_code", "hn")
    boarding_station_id = int(websocket.query_params.get("boarding_station_id", 0))
    route_no = websocket.query_params.get("route_no", "")
    walk_time_mins = int(websocket.query_params.get("walk_time_mins", 5))
    
    # Xử lý session_id
    session_id = websocket.query_params.get("session_id")
    if not session_id:
        session_id = uuid.uuid4().hex
        
    # Đăng ký Observer với session
    client_info = {
        "ws": websocket,
        "route_no": route_no,
        "walk_time": walk_time_mins,
        "region": region_code
    }
    await tracker_manager.connect(boarding_station_id, session_id, client_info)
    
    # Báo lại session_id cho FE (để nếu rớt mạng FE truyền lại session_id cũ)
    await websocket.send_json({"type": "session_init", "session_id": session_id})
    
    try:
        while True:
            # Giữ connection mở, chờ client ngắt kết nối
            await websocket.receive_text()
    except WebSocketDisconnect:
        print(f"Client session {session_id} ngắt kết nối JIT Tracker.")
    except Exception as e:
        print(f"Lỗi WebSocket session {session_id}: {e}")
    finally:
        # Gỡ Observer khi ngắt kết nối
        tracker_manager.disconnect(boarding_station_id, session_id)

from fastapi import Query
@router.get("/eta")
def get_eta_api(region_code: str, station_id: int):
    client = VinbusClient(timeout=10)
    try:
        etas = client.get_eta(region_code, station_id, 1, 0)
        return {"status": "SUCCESS", "data": etas}
    except Exception as e:
        return {"status": "ERROR", "message": str(e)}

@router.get("/bus-location")
def get_bus_location_api(region_code: str, station_id: int, route_id: int, bus_id: str):
    client = VinbusClient(timeout=10)
    try:
        data = client.get_bus_detail_at_station(region_code, station_id, route_id, bus_id)
        return {"status": "SUCCESS", "data": data}
    except Exception as e:
        return {"status": "ERROR", "message": str(e)}

import polyline
@router.get("/station/{station_id}")
def get_station_api(station_id: int, region_code: str = "hn"):
    client = VinbusClient(timeout=10)
    data = client.get_station_detail(station_id, region_code)
    
    # Chuẩn hoá data trả về giống với cấu trúc FE mong đợi (data.data.lat)
    if data and "stationInfo" in data:
        return {"status": "SUCCESS", "data": data["stationInfo"]}
    return {"status": "ERROR", "message": "Not found"}

@router.get("/directions")
def get_directions_api(start_lat: float, start_lng: float, end_lat: float, end_lng: float, region_code: str = "hn"):
    client = VinbusClient(timeout=10)
    try:
        directions = client.get_directions(start_lat, start_lng, end_lat, end_lng, region_code)
        
        # Lấy lộ trình tối ưu nhất (index 0)
        if not directions:
            return {"status": "SUCCESS", "data": {"points": [], "raw_route": None}}
            
        best_route = directions[0]
        points = []
        
        for leg in best_route.get("detailList", []):
            encoded = leg.get("busPathPoints", "")
            if encoded:
                decoded = polyline.decode(encoded)
                points.extend(decoded)
                
        # Nếu không có path từ bus, vẽ đường thẳng (chưa tính đường đi bộ)
        if not points:
            points = [(start_lat, start_lng), (end_lat, end_lng)]
            
        return {"status": "SUCCESS", "data": {"points": points, "raw_route": best_route}}
    except Exception as e:
        print(f"Directions API Error: {e}")
        return {"status": "ERROR", "message": str(e)}

@router.get("/route-detail")
def get_route_detail_api(route_id: int, region_code: str = "hn", direction: int = 0):
    """Lấy chi tiết tuyến xe: danh sách trạm + polyline đường đi thực tế."""
    client = VinbusClient(timeout=15)
    try:
        data = client.get_route_detail(route_id, region_code)
        if not data:
            return {"status": "ERROR", "message": "No data"}
        
        raw_stations = data.get("stations", [])
        
        # Lọc theo chiều đi (direction 0 = chiều đi, 1 = chiều về)
        filtered = [s for s in raw_stations if s.get("stationDirection") == direction]
        if not filtered:
            filtered = raw_stations  # fallback lấy tất cả
        
        # Sắp xếp theo thứ tự trạm
        filtered.sort(key=lambda s: s.get("stationOrder", 0))
        
        # Decode pathPoints từng segment để có đường đi thực tế
        path_points = []
        for s in filtered:
            pp = s.get("pathPoints", "") or ""
            if pp:
                try:
                    decoded = polyline.decode(pp)
                    path_points.extend(decoded)
                except:
                    pass
            elif s.get("lat") and s.get("lng"):
                path_points.append([s["lat"], s["lng"]])
        
        stations = [
            {
                "id": s.get("stationId"),
                "name": s.get("stationName", "").strip(),
                "lat": s.get("lat"),
                "lng": s.get("lng"),
                "order": s.get("stationOrder"),
            }
            for s in filtered if s.get("lat") and s.get("lng")
        ]
        
        return {"status": "SUCCESS", "data": {"stations": stations, "path": path_points}}
    except Exception as e:
        print(f"Route detail API error: {e}")
        return {"status": "ERROR", "message": str(e)}

