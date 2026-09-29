import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, Tooltip, useMap, CircleMarker } from 'react-leaflet';
import { renderToString } from 'react-dom/server';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { FiMap, FiClock, FiActivity, FiMaximize, FiMinimize, FiMapPin, FiTarget, FiTruck, FiInfo, FiFlag } from 'react-icons/fi';
import { FaBus, FaMapSigns } from 'react-icons/fa';
import polyline from '@mapbox/polyline';

// Khắc phục icon của Leaflet bị lỗi trong React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom HTML React-Icons
const createHtmlIcon = (IconComponent, bgColor) => new L.divIcon({
  className: 'custom-html-icon border-0 bg-transparent',
  html: `<div style="
    display: flex; align-items: center; justify-content: center;
    width: 32px; height: 32px; 
    background-color: ${bgColor}; 
    color: white;
    border-radius: 50%; 
    border: 2px solid white;
    box-shadow: 0 3px 6px rgba(0,0,0,0.4);
    font-size: 16px;
  ">${renderToString(<IconComponent />)}</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

const startIcon = createHtmlIcon(FiMapPin, '#10b981'); // Xanh lá
const endIcon = createHtmlIcon(FiFlag, '#f97316'); // Cam
const stationIcon = createHtmlIcon(FaMapSigns, '#3b82f6'); // Xanh dương
const busIcon = createHtmlIcon(FaBus, '#ef4444'); // Đỏ

// Icon đánh số thứ tự cho trạm trung gian
const createNumberedIcon = (num) => new L.divIcon({
  className: 'bg-transparent border-0',
  html: `<div style="
    display: flex; align-items: center; justify-content: center;
    width: 20px; height: 20px; 
    background-color: white; 
    color: #059669;
    border-radius: 50%; 
    border: 2px solid #059669;
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    font-size: 10px;
    font-weight: bold;
  ">${num}</div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -10]
});

const userLiveIcon = new L.divIcon({
  className: 'bg-transparent border-0',
  html: `<div style="width: 18px; height: 18px; background-color: #2563eb; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 8px rgba(37,99,235,0.8); animation: pulse 2s infinite;"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9]
});

function MapController({ bounds, flyToTarget, busesLoaded }) {
  const map = useMap();
  const hasFittedInitial = React.useRef(false);
  const hasFittedBuses = React.useRef(false);

  useEffect(() => {
    if (flyToTarget) {
      map.flyTo(flyToTarget.coords, flyToTarget.zoom || 16, { duration: 1.5 });
    } else if (bounds && bounds.isValid()) {
      if (!hasFittedInitial.current) {
        map.fitBounds(bounds, { padding: [50, 50] });
        hasFittedInitial.current = true;
      } else if (busesLoaded && !hasFittedBuses.current) {
        // Khi xe buýt load xong lần đầu, zoom ra để bao quát cả xe buýt
        map.fitBounds(bounds, { padding: [50, 50] });
        hasFittedBuses.current = true;
      }
    }
  }, [bounds, flyToTarget, map, busesLoaded]);
  return null;
}

// GPS Singleton — chỉ khởi động 1 lần, tồn tại xuyên qua mọi lần remount MapCard
const _gpsState = { watchId: null, location: null, started: false };
const _gpsListeners = new Set();

export default function MapCard({ startLat, startLng, endLat, endLng, regionCode = 'hn', liveData = null, targetRoute = null, showToolbar = false }) {
  const [routeData, setRouteData] = useState({ points: [], raw_route: null });
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapInstance, setMapInstance] = useState(null);

  // Fix lỗi bản đồ xám (không load gạch) hoặc lệch tâm khi resize
  useEffect(() => {
    if (mapInstance) {
      setTimeout(() => {
        mapInstance.invalidateSize();
      }, 300);

      const resizeObserver = new ResizeObserver(() => {
        mapInstance.invalidateSize();
      });
      const container = mapInstance.getContainer();
      if (container) resizeObserver.observe(container);

      return () => {
        if (container) resizeObserver.unobserve(container);
        resizeObserver.disconnect();
      };
    }
  }, [isFullscreen, mapInstance]);

  const [flyToTarget, setFlyToTarget] = useState(null);
  const [showLegend, setShowLegend] = useState(true);

  // States lưu các mảng toạ độ thực tế (với OSRM)
  const [realisticWalks, setRealisticWalks] = useState({});
  const [realisticBusPaths, setRealisticBusPaths] = useState({});
  const [userLocation, setUserLocation] = useState(_gpsState.location);
  const [realtimeUserWalkPath, setRealtimeUserWalkPath] = useState(null);

  // Real-time User GPS tracking — dùng singleton để không bị reset khi remount
  useEffect(() => {
    if (!navigator.geolocation) return;

    // Đăng ký listener nhận update từ singleton
    const onGps = (loc) => setUserLocation(loc);
    _gpsListeners.add(onGps);

    // Nếu đã có vị trí cũ thì dùng ngay
    if (_gpsState.location) {
      setUserLocation(_gpsState.location);
    }

    // Nếu GPS chưa được khởi động thì start
    if (!_gpsState.started) {
      _gpsState.started = true;

      // Lấy vị trí ngay lập tức (không đợi watchPosition)
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = [pos.coords.latitude, pos.coords.longitude];
          _gpsState.location = loc;
          _gpsListeners.forEach(fn => fn(loc));
        },
        (err) => console.warn("getCurrentPosition error:", err),
        { enableHighAccuracy: true, timeout: 10000 }
      );

      // Tiếp tục watch để cập nhật liên tục
      _gpsState.watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const loc = [pos.coords.latitude, pos.coords.longitude];
          _gpsState.location = loc;
          _gpsListeners.forEach(fn => fn(loc));
        },
        (err) => console.warn("watchPosition error:", err),
        { enableHighAccuracy: true }
      );
    }

    return () => { _gpsListeners.delete(onGps); };
  }, []);

  useEffect(() => {
    const fetchPath = async () => {
      try {
        const timestamp = Date.now();
        const res = await fetch(`http://localhost:8000/api/directions?start_lat=${startLat}&start_lng=${startLng}&end_lat=${endLat}&end_lng=${endLng}&region_code=${regionCode}&_t=${timestamp}`);
        const data = await res.json();
        if (data.status === "SUCCESS") {
          let pts = [];
          let rawRouteData = null;
          
          if (data.data) {
             if (Array.isArray(data.data)) {
                pts = data.data; // Backend cũ trả về trực tiếp mảng
             } else {
                pts = data.data.points || [];
                rawRouteData = data.data.raw_route || null;
             }
          } else if (data.points) {
             pts = data.points;
             rawRouteData = data.raw_route || null;
          }
          
          setRouteData({ points: pts, raw_route: rawRouteData });
        }
      } catch (e) {
        console.error("Map fetch error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchPath();
  }, [startLat, startLng, endLat, endLng, regionCode]);

  const [busRoutePath, setBusRoutePath] = useState({ path: [], stations: [], routeId: null });

  // Fetch đường đi thực tế của tuyến xe khi có liveData + targetRoute
  useEffect(() => {
    if (!liveData || !targetRoute) return;
    const safeTarget = String(targetRoute).trim();
    const routeInfo = liveData.find(r => String(r.routeNo).trim() === safeTarget || String(r.routeId) === safeTarget);
    if (!routeInfo || busRoutePath.routeId === routeInfo.routeId) return; // Tránh fetch lại nếu đã có

    fetch(`http://localhost:8000/api/route-detail?route_id=${routeInfo.routeId}&region_code=${regionCode}`)
      .then(res => res.json())
      .then(data => {
        if (data.status === "SUCCESS") {
          setBusRoutePath({ path: data.data.path || [], stations: data.data.stations || [], routeId: routeInfo.routeId });
        }
      })
      .catch(e => console.error("Route detail fetch error:", e));
  }, [liveData, targetRoute, regionCode]);

  // Lọc xe buýt từ liveData
  let buses = [];
  if (liveData && targetRoute) {
    const safeTarget = String(targetRoute).trim();
    const routeInfo = liveData.find(r => String(r.routeNo).trim() === safeTarget || String(r.routeId) === safeTarget);
    if (routeInfo && routeInfo.list) {
      buses = routeInfo.list.filter(b => b.lat && b.lng);
    }

  }

  // Chuẩn bị dữ liệu hiển thị cơ bản
  const { points, raw_route } = routeData;
  const walkSegments = [];
  const busSegments = [];
  const stations = [];
  const allCoords = [];

  if (startLat && startLng) allCoords.push([startLat, startLng]);
  if (endLat && endLng) allCoords.push([endLat, endLng]);

  if (raw_route && raw_route.detailList && raw_route.detailList.length > 0) {
    const legs = raw_route.detailList;
    for (let i = 0; i < legs.length - 1; i++) {
      const current = legs[i].busStation;
      const next = legs[i+1].busStation;

      if (current && next) {
        const p1 = [current.lat, current.lng];
        const p2 = [next.lat, next.lng];
        allCoords.push(p1, p2);

        const isWalk = (i === 0 || i === legs.length - 2);

        if (isWalk) {
          walkSegments.push({ id: `walk-${i}`, p1, p2, isStartWalk: i === 0 });
        } else {
          const busPath = legs[i+1].busPathPoints;
          if (busPath) {
            try {
              const decoded = polyline.decode(busPath);
              busSegments.push(decoded);
              decoded.forEach(pt => allCoords.push(pt));
            } catch(e) {
               busSegments.push([p1, p2]);
            }
          } else {
            busSegments.push([p1, p2]);
          }
        }
      }
      
      if (current && current.stationName) {
        stations.push(current);
      }
    }
    const lastLeg = legs[legs.length - 1].busStation;
    if (lastLeg && lastLeg.stationName) {
      stations.push(lastLeg);
      allCoords.push([lastLeg.lat, lastLeg.lng]);
    }
  } else if (points && points.length > 0) {
     busSegments.push(points);
     points.forEach(pt => allCoords.push(pt));
  }

  // Xác định trạm đón và trạm xuống
  const boardingStation = stations.length > 0 ? stations[0] : null;
  const alightingStation = stations.length > 1 ? stations[stations.length - 1] : null;
  
  // Kiểm tra trùng lặp vị trí (dưới 30m) để ẩn bớt icon cho đỡ rối
  const isStartSameAsBoarding = boardingStation && startLat && startLng 
    ? L.latLng(startLat, startLng).distanceTo(L.latLng(boardingStation.lat, boardingStation.lng)) < 30 
    : false;
    
  const isEndSameAsAlighting = alightingStation && endLat && endLng 
    ? L.latLng(endLat, endLng).distanceTo(L.latLng(alightingStation.lat, alightingStation.lng)) < 30 
    : false;
    
  // Trạm trung gian
  const intermediateStations = stations.slice(1, stations.length - 1);

  // Lấy đường bộ thực tế qua OSRM (chỉ lấy 1 lần)
  useEffect(() => {
    walkSegments.forEach(async (seg) => {
      if (realisticWalks[seg.id]) return; // Đã lấy
      try {
        const res = await fetch(`https://router.project-osrm.org/route/v1/foot/${seg.p1[1]},${seg.p1[0]};${seg.p2[1]},${seg.p2[0]}?geometries=polyline`);
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
          const decoded = polyline.decode(data.routes[0].geometry);
          setRealisticWalks(prev => ({ ...prev, [seg.id]: decoded }));
        }
      } catch (e) {}
    });
  }, [routeData]);

  // Lấy đường đi thực tế của xe buýt đến trạm đón qua OSRM
  useEffect(() => {
    if (!boardingStation) return;
    
    // Nếu có GPS User, vẽ đường đi bộ từ vị trí GPS đến trạm đón
    if (userLocation) {
      const fetchGPSWalk = async () => {
        try {
          const res = await fetch(`https://router.project-osrm.org/route/v1/foot/${userLocation[1]},${userLocation[0]};${boardingStation.lng},${boardingStation.lat}?geometries=polyline`);
          const data = await res.json();
          if (data.routes && data.routes.length > 0) {
            setRealtimeUserWalkPath(polyline.decode(data.routes[0].geometry));
          }
        } catch (e) {}
      };
      fetchGPSWalk();
    }
    buses.forEach(async (bus) => {
      const busId = bus.vehicleNumber || bus.busId;
      if (realisticBusPaths[busId]) return;
      try {
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${bus.lng},${bus.lat};${boardingStation.lng},${boardingStation.lat}?geometries=polyline`);
        const data = await res.json();
        if (data.routes && data.routes.length > 0) {
          const decoded = polyline.decode(data.routes[0].geometry);
          setRealisticBusPaths(prev => ({ ...prev, [busId]: decoded }));
        }
      } catch (e) {}
    });
  }, [buses.length, boardingStation]);

  const bounds = React.useMemo(() => {
    let boundsCoords = [...allCoords];
    buses.forEach(b => boundsCoords.push([b.lat, b.lng]));
    if (userLocation) boundsCoords.push(userLocation); // Include user location in bounds
    
    if (boundsCoords.length > 0) {
      return L.latLngBounds(boundsCoords);
    }
    return L.latLngBounds([[startLat, startLng], [endLat, endLng]]);
  }, [allCoords.length, buses.length, userLocation]); 

  const wrapperClass = isFullscreen 
      ? "fixed inset-4 z-[9999] rounded-xl overflow-hidden shadow-2xl border-4 border-emerald-500 bg-white flex flex-col" 
      : "bg-white border-2 border-emerald-100 rounded-xl overflow-hidden shadow-sm my-3 w-full relative z-0 flex flex-col";

  return (
    <div className={wrapperClass}>
      {!isFullscreen && !showToolbar && (
        <div className="bg-emerald-50 px-4 py-2 flex flex-col gap-1 border-b border-emerald-100">
          <div className="flex items-center gap-2">
             <FiMap className="text-emerald-600" />
             <h3 className="font-bold text-emerald-900 text-sm">Bản đồ Lộ trình Tuyến</h3>
          </div>
          {raw_route && (
             <div className="flex items-center gap-4 text-xs text-emerald-700 mt-1">
                <span className="flex items-center gap-1"><FiClock /> {raw_route.estimateTimePretty || 'N/A'}</span>
                <span className="flex items-center gap-1"><FiActivity /> {stations.length} Trạm</span>
             </div>
          )}
        </div>
      )}
      <div className={`w-full relative ${isFullscreen ? 'flex-1' : 'h-72'}`}>
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
            <span className="animate-pulse text-emerald-600 font-medium text-sm">Đang vẽ bản đồ...</span>
          </div>
        ) : (
          <MapContainer ref={setMapInstance} bounds={bounds} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
            <TileLayer
              attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* Đường đi bộ thực tế từ GPS của User đến Trạm đón */}
            {realtimeUserWalkPath && (
              <Polyline 
                positions={realtimeUserWalkPath} 
                color="#2563eb" 
                weight={5} 
                dashArray="6, 8" 
                opacity={0.9} 
              />
            )}
            
            {/* Vẽ đường đi bộ thực tế (OSRM) hoặc fallback (Đường thẳng) */}
            {walkSegments.map((seg) => {
              if (seg.isStartWalk && userLocation) return null; // Bỏ qua đường bộ tĩnh vì đã có đường bộ GPS
              return (
                <Polyline 
                  key={seg.id} 
                  positions={realisticWalks[seg.id] || [seg.p1, seg.p2]} 
                  color="#64748b" 
                  weight={4} 
                  dashArray="5, 8" 
                  opacity={0.8} 
                />
              );
            })}

            {/* Vẽ đường xe buýt tổng quát (Solid) */}
            {busSegments.map((seg, idx) => (
              <Polyline key={`bus-${idx}`} positions={seg} color="#10b981" weight={5} opacity={0.6} />
            ))}
            
            {/* Vẽ đường đi của xe buýt hiện tại tới trạm đón */}
            {buses.map(bus => {
              const busId = bus.vehicleNumber || bus.busId;
              const path = realisticBusPaths[busId];
              if (!path) return null;
              return (
                <Polyline 
                  key={`bus-path-${busId}`} 
                  positions={path} 
                  color="#ef4444" 
                  weight={5} 
                  dashArray="10, 10" 
                  opacity={0.9} 
                />
              );
            })}

            {/* Marker Trạm trung gian (Đánh số) */}
            {intermediateStations.map((st, idx) => (
              <Marker key={`st-mid-${idx}`} position={[st.lat, st.lng]} icon={createNumberedIcon(idx + 1)}>
                <Popup className="font-bold text-emerald-700">Trạm {idx + 1}: {st.stationName}</Popup>
              </Marker>
            ))}

            {/* Marker Trạm đón */}
            {boardingStation && (
              <Marker position={[boardingStation.lat, boardingStation.lng]} icon={stationIcon}>
                <Popup className="font-bold text-blue-700">
                  {isStartSameAsBoarding ? `Xuất phát & Đón: ${boardingStation.stationName}` : `Trạm đón: ${boardingStation.stationName}`}
                </Popup>
              </Marker>
            )}
            {/* Marker Trạm xuống */}
            {alightingStation && (
              <Marker position={[alightingStation.lat, alightingStation.lng]} icon={stationIcon}>
                <Popup className="font-bold text-blue-700">
                  {isEndSameAsAlighting ? `Đích & Xuống: ${alightingStation.stationName}` : `Trạm xuống: ${alightingStation.stationName}`}
                </Popup>
              </Marker>
            )}

            {/* Marker điểm xuất phát (Người dùng search) - Ẩn nếu có Live Tracking */}
            {!userLocation && !isStartSameAsBoarding && startLat && startLng && (
              <Marker position={[startLat, startLng]} icon={startIcon}>
                <Popup className="font-bold text-emerald-700">
                  Điểm xuất phát
                </Popup>
              </Marker>
            )}
            
            {/* Marker điểm đến (Người dùng search) */}
            {!isEndSameAsAlighting && endLat && endLng && (
              <Marker position={[endLat, endLng]} icon={endIcon}>
                <Popup className="font-bold text-orange-700">
                  Điểm đến
                </Popup>
              </Marker>
            )}

            {/* Marker GPS Vị trí hiện tại thực tế của User */}
            {userLocation && (
              <Marker position={userLocation} icon={userLiveIcon}>
                <Popup>Vị trí GPS của bạn</Popup>
              </Marker>
            )}
            
            {/* Đường đi thực tế của tuyến xe buýt */}
            {busRoutePath.path.length > 0 && (
              <Polyline
                positions={busRoutePath.path}
                color="#3b82f6"
                weight={4}
                opacity={0.55}
                dashArray="8,4"
              />
            )}

            {/* Realtime Buses */}
            {buses.map((bus, idx) => (
              <Marker key={`bus-rt-${idx}`} position={[Number(bus.lat), Number(bus.lng)]} icon={busIcon}>
                <Popup>
                  <strong>Xe {bus.vehicleNumber || bus.busId}</strong><br/>
                  Đang tới: {Math.ceil(bus.time / 60)} phút
                </Popup>
              </Marker>
            ))}

            <MapController bounds={bounds} flyToTarget={flyToTarget} busesLoaded={buses.length > 0} />
          </MapContainer>
        )}
        
        {/* Chú giải (Legend) */}
        {showLegend && (
          <div className="absolute bottom-2 left-2 z-[1000] bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-lg border border-gray-200 text-xs text-gray-700 pointer-events-auto transition-all duration-300">
            <h4 className="font-bold text-gray-900 mb-2 border-b pb-1">Chú giải Bản đồ</h4>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-sm"></div> Vị trí GPS của bạn</div>
              <div className="flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white"><FiMapPin size={12} /></div> Điểm xuất phát</div>
              <div className="flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-white"><FiFlag size={12} /></div> Điểm đến</div>
              <div className="flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white"><FaMapSigns size={12} /></div> Trạm đón / xuống</div>
              <div className="flex items-center gap-2"><div className="w-5 h-5 rounded-full border-2 border-emerald-600 bg-white flex items-center justify-center text-[10px] font-bold text-emerald-600">1</div> Trạm đi qua</div>
              {buses.length > 0 && (
                <div className="flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white"><FaBus size={12} /></div> Xe buýt (Realtime)</div>
              )}
            </div>
            <button 
              onClick={() => setShowLegend(false)}
              className="absolute top-1.5 right-1.5 text-gray-400 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
        )}
        {!showLegend && (
          <button 
            onClick={() => setShowLegend(true)}
            className="absolute bottom-2 left-2 z-[1000] bg-white p-2 rounded-full shadow-lg text-gray-600 hover:text-gray-900 border border-gray-200"
            title="Hiện chú giải"
          >
            <FiInfo size={16} />
          </button>
        )}
      </div>
      
      {/* Thanh công cụ Map (Nổi lên trên cùng) */}
      {showToolbar && (
        <div className="absolute top-2 right-2 z-[1000] flex flex-col gap-2">
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="bg-white p-2.5 rounded-lg shadow-lg hover:bg-emerald-50 border-2 border-emerald-500 text-emerald-700 font-bold flex items-center justify-center gap-2 transition-colors"
            title={isFullscreen ? "Thu nhỏ" : "Phóng to"}
          >
            {isFullscreen ? <><FiMinimize size={18} /> Thu nhỏ</> : <><FiMaximize size={18} /> Phóng to</>}
          </button>
          
          {userLocation && (
            <button 
              onClick={() => setFlyToTarget({coords: userLocation, zoom: 17})}
              className="bg-white text-gray-700 p-2 rounded-lg shadow-lg hover:bg-gray-50 font-bold flex items-center justify-start gap-2 transition-colors border border-gray-100"
              title="Vị trí của bạn"
            >
              <div className="w-5 h-5 rounded-full bg-blue-500 border-2 border-white shadow-sm flex-shrink-0"></div> <span className="whitespace-nowrap pr-1 text-sm">Của tôi</span>
            </button>
          )}

          {!userLocation && startLat && startLng && (
            <button 
              onClick={() => setFlyToTarget({coords: [startLat, startLng], zoom: 17})}
              className="bg-white text-gray-700 p-2 rounded-lg shadow-lg hover:bg-gray-50 font-bold flex items-center justify-start gap-2 transition-colors border border-gray-100"
              title="Đến Điểm Xuất Phát"
            >
              <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white flex-shrink-0"><FiMapPin size={12} /></div> <span className="whitespace-nowrap pr-1 text-sm">Điểm đi</span>
            </button>
          )}
          
          {endLat && endLng && (
            <button 
              onClick={() => setFlyToTarget({coords: [endLat, endLng], zoom: 17})}
              className="bg-white text-gray-700 p-2 rounded-lg shadow-lg hover:bg-gray-50 font-bold flex items-center justify-start gap-2 transition-colors border border-gray-100"
              title="Đến Điểm Đến"
            >
              <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-white flex-shrink-0"><FiFlag size={12} /></div> <span className="whitespace-nowrap pr-1 text-sm">Điểm đến</span>
            </button>
          )}
          
          {buses.length > 0 && (
            <button 
              onClick={() => {
                const nearest = buses.reduce((prev, curr) => (prev.time < curr.time) ? prev : curr);
                setFlyToTarget({coords: [nearest.lat, nearest.lng], zoom: 17});
              }}
              className="bg-white text-gray-700 p-2 rounded-lg shadow-lg hover:bg-gray-50 font-bold flex items-center justify-start gap-2 transition-colors border border-gray-100"
              title="Đến Xe Gần Nhất"
            >
              <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white flex-shrink-0"><FaBus size={12} /></div> <span className="whitespace-nowrap pr-1 text-sm">Xe gần nhất</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
