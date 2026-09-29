import requests
from typing import List, Dict, Any, Optional

from .crypto import decrypt_payload
from .exceptions import APIRequestError
from .types import (
    Region, NearStation, RouteInfo, RouteDetail,
    RealTimeVehicle, BusEtaInfo, DirectionResponse
)

class VinbusClient:
    """
    Client tương tác với hệ thống API của VinBus.
    Hỗ trợ tự động giải mã payload trả về.
    """
    BASE_URL = "https://vbcore-api.vinbus.vn"

    def __init__(self, timeout: int = 10, secret_key: Optional[bytes] = None):
        self.session = requests.Session()
        self.timeout = timeout
        self.secret_key = secret_key

    def _request(self, endpoint: str, method: str = "GET", params: Optional[Dict[str, Any]] = None, json_data: Optional[Dict[str, Any]] = None, data: Optional[Dict[str, Any]] = None) -> Any:
        url = f"{self.BASE_URL}{endpoint}"
        try:
            if method.upper() == "GET":
                response = self.session.get(url, params=params, timeout=self.timeout)
            elif method.upper() == "POST":
                response = self.session.post(url, params=params, json=json_data, data=data, timeout=self.timeout)
            else:
                raise APIRequestError(f"Method {method} chưa được hỗ trợ.")
        except requests.RequestException as e:
            raise APIRequestError(f"Lỗi kết nối tới VinBus API: {str(e)}") from e

        if not response.ok:
            raise APIRequestError(f"API trả về mã lỗi HTTP {response.status_code} tại {endpoint}", status_code=response.status_code)

        raw_text = response.text.strip().strip('"')
        
        if self.secret_key:
            return decrypt_payload(raw_text, self.secret_key)
        return decrypt_payload(raw_text)

    def get_regions(self) -> List[Region]:
        """Lấy danh sách các khu vực hoạt động của VinBus."""
        return self._request("/client/route/regions")

    def get_near_stations(self, lat: float, lng: float, radius: int, region_code: str) -> List[NearStation]:
        """Tìm các trạm lân cận trong bán kính r mét."""
        params = {
            "lat": lat,
            "lng": lng,
            "r": radius,
            "regionCode": region_code
        }
        return self._request("/client/station/near", params=params)

    def get_routes_list(self, region_code: str) -> List[RouteInfo]:
        """Lấy danh sách tuyến xe buýt trong khu vực."""
        params = {"regionCode": region_code}
        return self._request("/client/route/list", params=params)

    def get_route_detail(self, route_id: int, region_code: str = "hn") -> RouteDetail:
        """Lấy chi tiết một tuyến (danh sách trạm đi/về, polyline)."""
        params = {"routeId": route_id, "regionCode": region_code}
        return self._request("/client/route/detail", params=params)

    def get_real_time_vehicles(self, bus_id: str) -> RealTimeVehicle:
        """Lấy vị trí thời gian thực của MỘT xe cụ thể (bằng busId)."""
        params = {"busId": bus_id}
        return self._request("/client/station/bus_coordinates", params=params)

    def get_eta(self, region_code: str, station_id: int, group: int = 1, is_internal: int = 0) -> List[BusEtaInfo]:
        """Lấy danh sách các xe buýt dự kiến đến trạm."""
        params = {
            "regionCode": region_code,
            "stationId": station_id,
            "group": group,
            "isInternalStation": is_internal
        }
        return self._request("/client/station/estimate_bus_to_station", params=params)

    def get_directions(self, start_lat: float, start_lng: float, end_lat: float, end_lng: float, region_code: str) -> DirectionResponse:
        """Tìm lộ trình chỉ đường tối ưu (multimodal)."""
        params = {
            "startPoint": f"{start_lat},{start_lng}",
            "endPoint": f"{end_lat},{end_lng}",
            "regionCode": region_code,
            "maxWay": 4,
            "maxRoute": 3,
            "ignoreTime": 1,
            "filterRouteType": 0
        }
        return self._request("/client/navigation", method="POST", json_data=params)

    # ---------------- BỔ SUNG CÁC API CÒN THIẾU TỪ JAVASCRIPT ----------------

    def get_bus_detail_at_station(self, region_code: str, station_id: int, route_id: int, bus_id: str) -> Any:
        """Lấy chi tiết của một chiếc xe buýt cụ thể đang hướng tới trạm."""
        params = {
            "regionCode": region_code,
            "stationId": station_id,
            "routeId": route_id,
            "busId": bus_id
        }
        return self._request("/client/station/bus_detail", params=params)

    def get_station_detail(self, station_id: int, region_code: str) -> Any:
        """Lấy thông tin chi tiết của một trạm xe buýt."""
        params = {"stationId": station_id, "regionCode": region_code}
        return self._request("/client/station/detail", params=params)

    def get_route_timeline(self, route_id: int, region_code: str, weekday: int) -> Any:
        """Lấy thời gian biểu (timetable) xuất bến của tuyến theo ngày (weekday = 0->6)."""
        params = {"routeId": route_id, "regionCode": region_code, "weekday": weekday}
        return self._request("/client/route/timeline", params=params)

    def get_ticket_stores(self, region_code: str) -> Any:
        """Lấy danh sách các điểm bán vé."""
        params = {"regionCode": region_code}
        return self._request("/client/system/stores", params=params)

    def geocoding_reverse(self, lat: float, lng: float) -> Any:
        """Chuyển đổi toạ độ GPS thành địa chỉ (Reverse Geocoding)."""
        params = {"lat": lat, "lng": lng}
        return self._request("/client/geo_coding/reverse", params=params)

    def geocoding_search(self, region_code: str, content: str) -> Any:
        """Tìm kiếm toạ độ/địa chỉ theo từ khoá (Search Geocoding)."""
        json_data = {"regionCode": region_code, "content": content}
        return self._request("/client/geo_coding/search", method="POST", json_data=json_data)

    def get_eta_multi(self, region_code: str, data: str) -> Any:
        """Lấy ETA cho nhiều trạm cùng lúc. `data` thường là chuỗi JSON chứa list station_id."""
        form_data = {"regionCode": region_code, "data": data}
        return self._request("/client/station/estimate_bus_to_station_multi", method="POST", data=form_data)

