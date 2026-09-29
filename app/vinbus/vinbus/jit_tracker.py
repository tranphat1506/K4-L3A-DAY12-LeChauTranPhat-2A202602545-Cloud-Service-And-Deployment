import os
import json
import time
import math
import sys
import select
import termios
import tty
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv

from rich.live import Live
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich.console import Group
from rich import box

from vinbus_api.client import VinbusClient

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def get_minutes_to_target(target_time_str):
    now = datetime.now()
    try:
        target_time = datetime.strptime(target_time_str, "%H:%M").replace(
            year=now.year, month=now.month, day=now.day
        )
        diff = (target_time - now).total_seconds() / 60.0
        return diff
    except ValueError:
        return 0

def get_key():
    fd = sys.stdin.fileno()
    old_settings = termios.tcgetattr(fd)
    try:
        tty.setraw(fd)
        r, _, _ = select.select([sys.stdin], [], [], 0)
        if r:
            return sys.stdin.read(1)
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
    return None

def fetch_all_stations(c, region_code="hn"):
    CACHE_FILE = f"stations_cache_{region_code}.json"
    if os.path.exists(CACHE_FILE):
        print(f"⚡ Đang nạp danh sách trạm từ cache cục bộ ({CACHE_FILE})...")
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)

    print(f"⏳ Đang tải dữ liệu toàn bộ trạm VinBus tại khu vực '{region_code}'...")
    t0 = time.time()
    routes = c.get_routes_list(region_code)
    route_ids = [r['routeId'] for r in routes]
    stations = {}

    def fetch_route(rid):
        try:
            return c.get_route_detail(rid, region_code).get('stations', [])
        except:
            return []

    with ThreadPoolExecutor(max_workers=20) as executor:
        results = executor.map(fetch_route, route_ids)

    for sts in results:
        for s in sts:
            sid = str(s['stationId'])
            if sid not in stations:
                stations[sid] = {
                    "name": s['stationName'],
                    "lat": s.get('lat', 0),
                    "lng": s.get('lng', 0),
                    "address": s.get('stationAddress', '')
                }
            
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(stations, f, ensure_ascii=False, indent=2)
        
    print(f"✅ Đã tải xong và lưu Cache {len(stations)} trạm (mất {time.time()-t0:.2f}s).")
    return stations

def interactive_search(stations, prompt_text):
    while True:
        q = input(f"\n🔍 {prompt_text} (Gõ từ khóa): ")
        if not q.strip(): continue
        
        matches = {k: v for k, v in stations.items() if q.lower() in v['name'].lower()}
        if not matches:
            print("❌ Không tìm thấy trạm nào khớp. Hãy thử từ khóa khác!")
            continue
        
        match_list = list(matches.items())
        print(f"Có {len(match_list)} kết quả:")
        for i, (sid, sdata) in enumerate(match_list[:20]):
            print(f"  [{i+1}] {sdata['name']} (ID: {sid})")
        if len(match_list) > 20:
            print(f"  ... và {len(match_list) - 20} trạm khác bị ẩn.")
            
        choice = input("👉 Chọn số thứ tự (hoặc bấm Enter để tìm từ khóa khác): ")
        if choice.isdigit() and 1 <= int(choice) <= min(len(match_list), 20):
            selected_id, selected_data = match_list[int(choice)-1]
            print(f"✅ Đã chọn: {selected_data['name']}\n")
            return int(selected_id)

def find_valid_routes(c, board_station_id, alight_station_id, region_code="hn"):
    if not alight_station_id:
        return []
    try:
        board_res = c.get_station_detail(board_station_id, region_code)
        alight_res = c.get_station_detail(alight_station_id, region_code)
        board_routes = board_res.get('allRouteThroughStation', [])
        alight_routes = alight_res.get('allRouteThroughStation', [])
        
        alight_map = {(r['routeId'], r['direction']): r['order'] for r in alight_routes}
        
        valid = []
        for br in board_routes:
            key = (br['routeId'], br['direction'])
            if key in alight_map:
                if br['order'] < alight_map[key]:
                    valid.append(br['routeNo'])
        return valid
    except:
        return []

def geocode(c, address, region_code="hn", default_lat=20.9922, default_lng=105.9723):
    try:
        res = c.geocoding_search(region_code, address)
        if res:
            return res[0].get('lat'), res[0].get('lng')
    except:
        pass
    return default_lat, default_lng

def get_station_coords(all_stations, station_id):
    sid = str(station_id)
    if sid in all_stations:
        return all_stations[sid]['lat'], all_stations[sid]['lng']
    return 0, 0

def generate_ui(routine, valid_routes, walk_origin, walk_dest, transit_time, mins_to_target_board, buses, alert_msg, status_msg, fetch_countdown):
    mode = routine.get('plan_mode', 'DEPARTURE')
    if mode == 'ARRIVAL':
        target_desc = f"{routine['target_time']} (Có mặt tại đích)"
    else:
        target_desc = f"{routine.get('target_time')} (Có mặt tại bến)"

    routes_str = ", ".join(valid_routes) if valid_routes else routine.get('route', 'Không rõ')
    region_str = routine.get('region_code', 'hn').upper()

    info_text = (
        f"[bold]Lịch trình:[/bold] {routine['name']} [italic]({mode})[/italic]\n"
        f"[bold]Khu vực:[/bold] {region_str} | [bold]Tuyến khả dụng:[/bold] {routes_str} | [bold]Trạm đi:[/bold] {routine['boarding_station_id']}"
    )
    if mode == 'ARRIVAL':
         info_text += f" | [bold]Trạm đến:[/bold] {routine.get('alighting_station_id')}"
         info_text += f"\n[bold]Mục tiêu:[/bold] {target_desc}"
         info_text += f"\n🚶 [bold]Đi bộ ra bến:[/bold] {walk_origin} phút | 🚌 [bold]Ngồi xe:[/bold] {transit_time} phút | 🚶 [bold]Đi bộ vào đích:[/bold] {walk_dest} phút"
         info_text += f"\n⏰ [bold]GIỜ XE CHẠY CHÓT (Boarding Deadline):[/bold] Còn lại {int(mins_to_target_board)} phút"
    else:
         info_text += f"\n[bold]Mục tiêu:[/bold] {target_desc} (Còn {int(mins_to_target_board)} phút)"
         info_text += f"\n🚶 [bold]Đi bộ:[/bold] {walk_origin} phút"

    info_panel = Panel(info_text, title="THÔNG TIN LỊCH TRÌNH", border_style="blue")
    
    table = Table(title="[bold blue]DANH SÁCH CÁC CHUYẾN XE PHÙ HỢP NHẤT", box=box.ROUNDED, expand=True)
    table.add_column("Tuyến", justify="center", style="yellow", no_wrap=True)
    table.add_column("Biển số", justify="center", style="cyan", no_wrap=True)
    table.add_column("Khoảng cách", justify="right", style="magenta")
    table.add_column("Thời gian (ETA)", justify="right", style="green")
    table.add_column("Tốc độ", justify="right")

    if not buses:
        table.add_row("-", "Chưa có thông tin", "-", "-", "-")
    else:
        buses.sort(key=lambda x: x.get('time', float('inf')))
        for b in buses:
            route_no = b.get('routeNo', '-')
            bus_id = b.get('busId') or b.get('vehicleNumber', 'N/A')
            is_waiting = b.get('speed', -1) == -1
            eta = f"{math.ceil(b.get('time', 0) / 60)} phút"
            
            if is_waiting:
                table.add_row(route_no, f"[dim]{bus_id}[/dim]", "-", f"[dim]{eta} (Chờ bến)[/dim]", "-")
            else:
                dist = f"{int(b.get('distance', 0))}m"
                speed = f"{b.get('speed', 0)} km/h"
                table.add_row(route_no, bus_id, dist, eta, speed)

    if fetch_countdown > 0:
        throttle_msg = f"{status_msg} (Làm mới sau: {fetch_countdown}s...)"
    else:
        throttle_msg = f"{status_msg} (Đang fetch dữ liệu...)"
        
    status_panel = Panel(Text(throttle_msg, style="yellow italic"), title="TRẠNG THÁI HỆ THỐNG", border_style="yellow")

    if alert_msg:
        alert_panel = Panel(Text(alert_msg, justify="center", style="bold white on red"), border_style="red", padding=(1, 1))
    else:
        alert_panel = Panel(Text("Đang theo dõi... Mọi thứ vẫn ổn.", justify="center", style="dim"), border_style="dim")

    footer = Text("Bấm 'R' để Refresh | 'S' để đổi giờ mục tiêu | 'Q' để thoát", justify="center", style="bold cyan")

    group = Group(info_panel, table, status_panel, alert_panel, footer)
    return Panel(group, title="[bold green]🚀 VINBUS JIT TRACKER (MULTI-ROUTE & WIZARD)", border_style="green", padding=(1, 2))

def setup_wizard(c):
    print("=======================================")
    print("🚌 CHÀO MỪNG ĐẾN VỚI VINBUS JIT TRACKER 🚌")
    print("=======================================\n")
    
    routine = {"name": "Chuyến đi linh hoạt", "buffer_minutes": 2}

    region_choice = input("🌍 Chọn khu vực hoạt động:\n  [1] Hà Nội (hn)\n  [2] TP. Hồ Chí Minh (hcm)\n  [3] Phú Quốc (pq)\n👉 Chọn (1/2/3) [Mặc định 1]: ")
    region_map = {'1': 'hn', '2': 'hcm', '3': 'pq'}
    routine['region_code'] = region_map.get(region_choice.strip(), 'hn')
    
    mode_choice = input("\n🎯 Bạn muốn lập kế hoạch theo kiểu nào?\n  [1] Giờ ĐẾN ĐÍCH (ARRIVAL - Tự trừ lùi thời gian ngồi xe)\n  [2] Giờ RA BẾN (DEPARTURE)\n👉 Chọn (1/2) [Mặc định 1]: ")
    routine['plan_mode'] = 'DEPARTURE' if mode_choice.strip() == '2' else 'ARRIVAL'
    
    routine['origin_address'] = input("\n📍 Nhập địa chỉ bạn ĐANG ĐỨNG (Dùng để tính thời gian đi bộ ra bến, VD: S2.05): ")
    if not routine['origin_address'].strip(): routine['origin_address'] = "S2.05"
    
    all_stations = fetch_all_stations(c, routine['region_code'])
    routine['boarding_station_id'] = interactive_search(all_stations, "Tìm trạm ĐÓN (Boarding)")
    
    if routine['plan_mode'] == 'ARRIVAL':
        routine['destination_address'] = input("\n📍 Nhập địa chỉ ĐÍCH ĐẾN (VD: Đại học VinUni): ")
        if not routine['destination_address'].strip(): routine['destination_address'] = "Đại học VinUni"
        routine['alighting_station_id'] = interactive_search(all_stations, "Tìm trạm TRẢ (Alighting)")
        target = input("\n⏰ Giờ mục tiêu CÓ MẶT TẠI ĐÍCH (VD: 08:30): ")
    else:
        routine['alighting_station_id'] = None
        target = input("\n⏰ Giờ mục tiêu CÓ MẶT TẠI BẾN (VD: 08:30): ")
        
    routine['target_time'] = target if target.strip() else "08:30"
    
    buf = input("\n⏳ Số phút dự phòng (Mặc định 2): ")
    if buf.strip().isdigit():
        routine['buffer_minutes'] = int(buf.strip())
        
    print("\n🚀 Đang khởi động hệ thống theo dõi thời gian thực...\n")
    return routine, all_stations

def main():
    load_dotenv()
    c = VinbusClient(timeout=10)
    
    r, all_stations = setup_wizard(c)
            
    mode = r.get('plan_mode')
    region_code = r.get('region_code', 'hn')
    board_station_id = r.get('boarding_station_id')
    alight_station_id = r.get('alighting_station_id')
    
    valid_routes = find_valid_routes(c, board_station_id, alight_station_id, region_code)
    if not valid_routes and 'route' in r:
        valid_routes = [r['route']]
        
    origin_lat, origin_lng = geocode(c, r.get('origin_address', ''), region_code, 20.992, 105.972)
    board_lat, board_lng = get_station_coords(all_stations, board_station_id)
    
    dist_origin = haversine(origin_lat, origin_lng, board_lat, board_lng)
    walk_origin = math.ceil(dist_origin / 83.0)
    
    walk_dest = 0
    transit_time = 0
    
    if mode == 'ARRIVAL':
        dest_lat, dest_lng = geocode(c, r.get('destination_address', ''), region_code)
        alight_lat, alight_lng = get_station_coords(all_stations, alight_station_id)
        
        dist_dest = haversine(alight_lat, alight_lng, dest_lat, dest_lng)
        walk_dest = math.ceil(dist_dest / 83.0)
        
        dist_transit = haversine(board_lat, board_lng, alight_lat, alight_lng) * 1.3
        transit_time = math.ceil(dist_transit / 333.0)
        
    buffer = r.get("buffer_minutes", 2)
    current_buses = []
    alert_msg = ""
    status_msg = "Đang khởi động..."
    
    live = Live(generate_ui(r, valid_routes, walk_origin, walk_dest, transit_time, 0, current_buses, alert_msg, status_msg, 0), refresh_per_second=4)
    live.start()
    
    try:
        while True:
            target_time = r.get('target_time')
            raw_mins_to_target = get_minutes_to_target(target_time)
            
            if mode == 'ARRIVAL':
                mins_to_board = raw_mins_to_target - walk_dest - transit_time
            else:
                mins_to_board = raw_mins_to_target
                
            if mins_to_board < -30:
                live.update(generate_ui(r, valid_routes, walk_origin, walk_dest, transit_time, mins_to_board, current_buses, "HẾT GIỜ!", "Đã qua giờ lên xe chót. Thoát.", 0))
                break
                
            status_msg = f"[{datetime.now().strftime('%H:%M:%S')}] 🔍 Đang tìm các chuyến ({', '.join(valid_routes)})..."
            live.update(generate_ui(r, valid_routes, walk_origin, walk_dest, transit_time, mins_to_board, current_buses, alert_msg, status_msg, 0))
            
            try:
                etas = c.get_eta(region_code, board_station_id, group=1, is_internal=0)
                current_buses = []
                
                for target_route in etas:
                    if not valid_routes or target_route.get('routeNo') in valid_routes:
                        for bus in target_route.get('list', []):
                            bus['routeNo'] = target_route.get('routeNo')
                            current_buses.append(bus)
                            
                alert_msg = ""
                fastest_eta = float('inf')
                fastest_route = ""
                
                for bus in current_buses:
                    eta_mins = math.ceil(bus.get('time', float('inf')) / 60)
                    if eta_mins < fastest_eta:
                        fastest_eta = eta_mins
                        fastest_route = bus.get('routeNo')
                        
                    if eta_mins <= walk_origin + buffer and mins_to_board <= 30:
                        if eta_mins <= mins_to_board + buffer:
                            alert_msg = (
                                f"🔔 BẮT ĐẦU DI CHUYỂN NGAY!\n"
                                f"Chuyến xe {bus.get('routeNo')} đang cách {eta_mins} phút.\n"
                                f"Bạn cần {walk_origin} phút đi bộ ra bến. Kịp giờ đến đích!"
                            )
            except Exception as ex:
                status_msg = f"Lỗi gọi API: {ex}"
                
            closest_eta_mins = fastest_eta if current_buses else float('inf')

            if closest_eta_mins == float('inf'):
                poll_interval, status_msg = 60, f"[{datetime.now().strftime('%H:%M:%S')}] ⏳ Đang chờ xe xuất hiện (60s/lần)"
            elif closest_eta_mins > 10:
                poll_interval, status_msg = 180, f"[{datetime.now().strftime('%H:%M:%S')}] 🐢 Tuyến {fastest_route} còn xa >10p (Quét 3p/lần)"
            elif closest_eta_mins > 3:
                poll_interval, status_msg = 60, f"[{datetime.now().strftime('%H:%M:%S')}] ⚡ Tuyến {fastest_route} đang tới (Quét 60s/lần)"
            else:
                poll_interval, status_msg = 15, f"[{datetime.now().strftime('%H:%M:%S')}] 🔥 {fastest_route} RẤT GẦN! (Quét 15s/lần)"

            if mins_to_board > 45:
                poll_interval, status_msg = 180, f"[{datetime.now().strftime('%H:%M:%S')}] Zzz... Ngủ đông vì còn lâu mới đến giờ đi (3p/lần)"

            force_refresh = False
            for i in range(poll_interval, 0, -1):
                key = get_key()
                if key:
                    key = key.lower()
                    if key == 'r':
                        force_refresh = True
                        break
                    elif key == 's':
                        live.stop()
                        print("\n" * 2)
                        new_time = input("⏰ Nhập giờ mục tiêu mới (VD: 07:30): ")
                        if new_time.strip():
                            r['target_time'] = new_time.strip()
                        print("🔄 Đang khởi động lại...")
                        live.start()
                        force_refresh = True
                        break
                    elif key in ('q', '\x03'):
                        live.stop()
                        print("👋 Đã thoát chương trình.")
                        return

                live.update(generate_ui(r, valid_routes, walk_origin, walk_dest, transit_time, mins_to_board, current_buses, alert_msg, status_msg, i))
                time.sleep(1)
                
            if force_refresh:
                continue
    finally:
        live.stop()

if __name__ == "__main__":
    main()
