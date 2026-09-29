"""
🛠️ TOOL DEFINITIONS & EXECUTION BACKEND
Mã nguồn chứa danh sách Tool Schemas (JSON Schema) và Execution Layer phục vụ cho MCP Server.
Đã được cấu hình lại để sử dụng VinBus API.
"""

import json
from datetime import datetime
from typing import Dict, Any

from app.vinbus.vinbus.vinbus_api.client import VinbusClient

# Khởi tạo client dùng chung
vinbus_client = VinbusClient(timeout=10)

# ==============================================================================
# 1. KHAI BÁO TOOL SCHEMAS CHUẨN NATIVE JSON SCHEMA (TASK 1.2)
# ==============================================================================

import os
import yaml

# Tự động đọc nội dung (instructions & schemas) của Tool từ file YAML
yaml_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts", "tools.yaml")
try:
    with open(yaml_path, "r", encoding="utf-8") as f:
        TOOLS_SCHEMA = yaml.safe_load(f)
except Exception as e:
    print(f"⚠️ Lỗi đọc src/artifacts/tools.yaml: {e}")
    TOOLS_SCHEMA = []

# ==============================================================================
# 2. HÀM THỰC THI TOOL (EXECUTION LAYER) GỌI VINBUS API
# ==============================================================================

def execute_geocoding_search(region_code: str, content: str) -> str:
    """Thực thi tìm kiếm tọa độ từ địa chỉ"""
    import re
    try:
        result = vinbus_client.geocoding_search(region_code, content)
        
        # Tự động retry nếu kết quả rỗng bằng cách xóa các từ rườm rà
        if not result:
            # Loại bỏ các từ khóa chung chung thường làm hỏng tìm kiếm
            prefixes_to_remove = ["nhà", "số", "đường", "tòa nhà", "tòa", "chung cư", "ngõ", "hẻm", "phân khu", "khu", "quận", "huyện", "phường", "xã"]
            
            simplified = content.lower()
            for prefix in prefixes_to_remove:
                # Xóa từ ở đầu câu hoặc đứng độc lập
                simplified = re.sub(r'\b' + prefix + r'\b', '', simplified)
                
            simplified = simplified.strip()
            
            # Chỉ retry nếu chuỗi sau khi rút gọn khác với ban đầu và không rỗng
            if simplified and simplified != content.lower():
                print(f"[Auto-Retry Geocoding] '{content}' -> '{simplified}'")
                retry_result = vinbus_client.geocoding_search(region_code, simplified)
                if retry_result:
                    return json.dumps({"status": "SUCCESS", "data": retry_result, "note": f"Auto-retried with simplified keyword: {simplified}"}, ensure_ascii=False)

        return json.dumps({"status": "SUCCESS", "data": result}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"status": "ERROR", "message": str(e)}, ensure_ascii=False)

def execute_get_near_stations(lat: float, lng: float, radius: int, region_code: str) -> str:
    """Tìm các trạm lân cận trong bán kính r mét."""
    try:
        result = vinbus_client.get_near_stations(lat, lng, radius, region_code)
        return json.dumps({"status": "SUCCESS", "data": result}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"status": "ERROR", "message": str(e)}, ensure_ascii=False)

def execute_get_station_detail(station_id: int, region_code: str) -> str:
    """Thực thi lấy chi tiết trạm xe buýt"""
    try:
        raw_result = vinbus_client.get_station_detail(station_id, region_code)
        
        # Tối ưu hóa Response (Bỏ rác HTML trong routeAlerts)
        filtered_routes = []
        if "allRouteThroughStation" in raw_result:
            for route in raw_result["allRouteThroughStation"]:
                filtered_routes.append({
                    "routeNo": route.get("routeNo"),
                    "routeName": route.get("routeName"),
                    "operationTime": route.get("operationTime"),
                    "headway": route.get("headway"),
                    "normalTicket": route.get("normalTicket")
                })
        
        result = {
            "stationInfo": raw_result.get("stationInfo", {}),
            "routes": filtered_routes
        }
        return json.dumps({"status": "SUCCESS", "data": result}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"status": "ERROR", "message": str(e)}, ensure_ascii=False)

def execute_get_eta(region_code: str, station_id: int) -> str:
    """Thực thi lấy thời gian xe đến bến realtime"""
    try:
        raw_result = vinbus_client.get_eta(region_code, station_id)
        
        # Tối ưu hóa Response ETA
        filtered_eta = []
        for route_eta in raw_result:
            live_vehicles = []
            for vehicle in route_eta.get("list", []):
                live_vehicles.append({
                    "busId": vehicle.get("busId"),
                    "vehicleNumber": vehicle.get("vehicleNumber"),
                    "distance_meters": vehicle.get("distance"),
                    "eta_seconds": vehicle.get("time"),
                    "currentStationId": vehicle.get("currentStationId")
                })
            
            filtered_eta.append({
                "routeId": route_eta.get("routeId"),
                "routeNo": route_eta.get("routeNo"),
                "routeName": route_eta.get("routeName"),
                "headway": route_eta.get("headway"),
                "live_vehicles": live_vehicles
            })
            
        return json.dumps({"status": "SUCCESS", "data": filtered_eta}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"status": "ERROR", "message": str(e)}, ensure_ascii=False)

def execute_get_route_stations(region_code: str, route_id: int) -> str:
    """Thực thi lấy danh sách trạm của một tuyến xe buýt"""
    try:
        res = vinbus_client._request("/client/route/detail", params={"routeId": route_id, "regionCode": region_code})
        stations = res.get("stations", [])
        
        # Format lại cho gọn nhẹ
        compact_stations = []
        for s in stations:
            compact_stations.append({
                "stationId": s.get("stationId"),
                "stationName": s.get("stationName"),
                "stationAddress": s.get("stationAddress"),
                "direction": "Lượt đi" if s.get("stationDirection") == 0 else "Lượt về"
            })
            
        return json.dumps({"status": "SUCCESS", "routeNo": res.get("routeNo"), "stations": compact_stations}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"status": "ERROR", "message": str(e)}, ensure_ascii=False)

def execute_search_route(region_code: str, route_keyword: str) -> str:
    """Thực thi tìm kiếm tuyến xe buýt"""
    try:
        raw_routes = vinbus_client._request("/client/route/list", params={"regionCode": region_code})
        # Lọc các tuyến có chứa từ khóa
        keyword = str(route_keyword).lower()
        matched_routes = []
        for r in raw_routes:
            if keyword in str(r.get("routeNo", "")).lower() or keyword in str(r.get("routeName", "")).lower():
                matched_routes.append({
                    "routeId": r.get("routeId"),
                    "routeNo": r.get("routeNo"),
                    "routeName": r.get("routeName"),
                    "operationTime": r.get("operationTime"),
                    "headway": r.get("headway")
                })
        return json.dumps({"status": "SUCCESS", "data": matched_routes}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"status": "ERROR", "message": str(e)}, ensure_ascii=False)

def execute_get_bus_detail(region_code: str, station_id: int, route_id: int, bus_id: str) -> str:
    """Thực thi lấy chi tiết 1 xe buýt (bao gồm tọa độ GPS)"""
    try:
        result = vinbus_client.get_bus_detail_at_station(region_code, station_id, route_id, bus_id)
        return json.dumps({"status": "SUCCESS", "data": result}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"status": "ERROR", "message": str(e)}, ensure_ascii=False)

def execute_get_directions(start_lat: float, start_lng: float, end_lat: float, end_lng: float, region_code: str) -> str:
    """Tìm lộ trình chỉ đường tối ưu (multimodal)."""
    try:
        result = vinbus_client.get_directions(start_lat, start_lng, end_lat, end_lng, region_code)
        return json.dumps({"status": "SUCCESS", "data": result}, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"status": "ERROR", "message": str(e)}, ensure_ascii=False)

def execute_show_route_map(**kwargs) -> str:
    return json.dumps({
        "status": "SUCCESS",
        "message": "Đã render bản đồ thành công."
    }, ensure_ascii=False)

def execute_propose_trip_plan(**kwargs) -> str:
    # Auto-fill station coordinates if missing
    if "station_lat" not in kwargs or "station_lng" not in kwargs or not kwargs["station_lat"]:
        try:
            res = vinbus_client.get_station_detail(kwargs.get("boarding_station_id"), kwargs.get("region_code", "hn"))
            if res and "stationInfo" in res:
                station_info = res["stationInfo"]
                kwargs["station_lat"] = station_info.get("lat")
                kwargs["station_lng"] = station_info.get("lng")
                kwargs["station_name"] = station_info.get("stationName", kwargs.get("station_name"))
        except Exception:
            pass

    # Validate strictly ONLY for user and destination coordinates
    required = ["region_code", "boarding_station_id", "route_no", "start_lat", "start_lng", "end_lat", "end_lng"]
    missing = [k for k in required if k not in kwargs or kwargs[k] is None]
    
    if missing:
        return json.dumps({
            "status": "ERROR",
            "message": f"Tool call failed. You MUST provide the following missing parameters: {', '.join(missing)}. Please call geocoding_search or get_directions to find them, then call this tool again."
        }, ensure_ascii=False)
        
    plan = {
        "status": "SUCCESS",
        "message": "Đã tạo plan thành công với ĐẦY ĐỦ tọa độ. Giao diện người dùng sẽ hiện nút Xác nhận.",
        "plan_detail": kwargs
    }
    return json.dumps(plan, ensure_ascii=False)

# Router gọi tool thực tế
TOOL_ROUTER = {
    "geocoding_search": execute_geocoding_search,
    "get_near_stations": execute_get_near_stations,
    "get_station_detail": execute_get_station_detail,
    "get_eta": execute_get_eta,
    "get_directions": execute_get_directions,
    "get_bus_detail_at_station": execute_get_bus_detail,
    "search_route": execute_search_route,
    "get_route_stations": execute_get_route_stations,
    "propose_trip_plan": execute_propose_trip_plan,
    "show_route_map": execute_show_route_map
}

def dispatch_tool_call(tool_name: str, arguments: Dict[str, Any]) -> str:
    """Hàm trung chuyển thực thi tool"""
    if tool_name in TOOL_ROUTER:
        try:
            return TOOL_ROUTER[tool_name](**arguments)
        except Exception as e:
            return json.dumps({"status": "EXECUTION_ERROR", "error": str(e)}, ensure_ascii=False)
    return json.dumps({"status": "UNKNOWN_TOOL", "error": f"Tool '{tool_name}' không tồn tại!"}, ensure_ascii=False)


