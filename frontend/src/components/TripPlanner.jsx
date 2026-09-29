import React, { useState, useEffect } from 'react';
import { FiClock, FiCheck, FiBell, FiTrash2 } from 'react-icons/fi';
import MapCard from './MapCard';

// 1. Component hiển thị đề xuất trong Chat
export function ProposedPlanCard({ regionCode, boardingStationId, stationName, stationLat, stationLng, routeNo, walkTimeMins, startLat, startLng, endLat, endLng }) {
  const [confirmed, setConfirmed] = useState(false);
  const [fetchedStationLat, setFetchedStationLat] = useState(stationLat);
  const [fetchedStationLng, setFetchedStationLng] = useState(stationLng);
  const [fetchedStationName, setFetchedStationName] = useState(stationName);
  const [liveData, setLiveData] = useState(null);

  useEffect(() => {
    // 1. Fetch Station Coordinates if missing
    if (!fetchedStationLat && boardingStationId) {
      fetch(`http://localhost:8000/api/station/${boardingStationId}?region_code=${regionCode || 'hn'}`)
        .then(res => res.json())
        .then(data => {
          if (data.status === "SUCCESS" && data.data) {
            setFetchedStationLat(data.data.lat);
            setFetchedStationLng(data.data.lng);
            if (!fetchedStationName && data.data.stationName) {
              setFetchedStationName(data.data.stationName);
            }
          }
        }).catch(e => console.error(e));
    }

    // 2. Fetch Realtime ETA (buses) for this station
    if (boardingStationId) {
      let localLiveDataRef = null;

      const fetchEta = () => {
        fetch(`http://localhost:8000/api/eta?region_code=${regionCode || 'hn'}&station_id=${boardingStationId}`)
          .then(res => res.json())
          .then(async data => {
            if (data.status === "SUCCESS" && data.data) {
              const liveDataCopy = [...data.data];
              const safeTarget = String(routeNo).trim();
              const routeInfo = liveDataCopy.find(r => String(r.routeNo).trim() === safeTarget || String(r.routeId) === safeTarget);
              if (routeInfo && routeInfo.list) {
                const promises = routeInfo.list.map(async (bus) => {
                  if (!bus.busId) return bus;
                  try {
                    const locRes = await fetch(`http://localhost:8000/api/bus-location?region_code=${regionCode || 'hn'}&station_id=${boardingStationId}&route_id=${routeInfo.routeId}&bus_id=${bus.busId}`);
                    const locData = await locRes.json();
                    if (locData.status === "SUCCESS" && locData.data) {
                      bus.lat = locData.data.lat;
                      bus.lng = locData.data.lng;
                    }
                  } catch (e) {}
                  return bus;
                });
                await Promise.all(promises);
              }
              localLiveDataRef = liveDataCopy;
              setLiveData(liveDataCopy);
            }
          }).catch(e => console.error(e));
      };

      const fetchNearestBusLocation = async () => {
        if (!localLiveDataRef) return;
        const liveDataCopy = [...localLiveDataRef];
        const safeTarget = String(routeNo).trim();
        const routeInfo = liveDataCopy.find(r => String(r.routeNo).trim() === safeTarget || String(r.routeId) === safeTarget);
        
        if (routeInfo && routeInfo.list && routeInfo.list.length > 0) {
          // Lọc các xe hợp lệ và tìm xe gần nhất
          const validBuses = routeInfo.list.filter(b => b.busId && b.time != null);
          if (validBuses.length === 0) return;
          
          const nearestBus = validBuses.reduce((prev, curr) => (prev.time < curr.time) ? prev : curr);
          
          // Chỉ fetch liên tục nếu xe còn cách dưới 15 phút (900s)
          if (nearestBus.time <= 900) {
            try {
              const locRes = await fetch(`http://localhost:8000/api/bus-location?region_code=${regionCode || 'hn'}&station_id=${boardingStationId}&route_id=${routeInfo.routeId}&bus_id=${nearestBus.busId}`);
              const locData = await locRes.json();
              if (locData.status === "SUCCESS" && locData.data) {
                // Cập nhật toạ độ cho chiếc xe gần nhất
                const targetBus = routeInfo.list.find(b => b.busId === nearestBus.busId);
                if (targetBus) {
                  targetBus.lat = locData.data.lat;
                  targetBus.lng = locData.data.lng;
                  // Ép React re-render
                  localLiveDataRef = liveDataCopy;
                  setLiveData([...liveDataCopy]);
                }
              }
            } catch (e) {}
          }
        }
      };

      fetchEta(); 
      // Master loop: Cập nhật toàn bộ ETA & toạ độ mọi xe mỗi 30 giây
      const slowIntervalId = setInterval(fetchEta, 30000); 
      // Fast loop: Liên tục fetch toạ độ của riêng chiếc xe gần nhất mỗi 5 giây
      const fastIntervalId = setInterval(fetchNearestBusLocation, 5000); 

      return () => {
        clearInterval(slowIntervalId);
        clearInterval(fastIntervalId);
      };
    }
  }, [boardingStationId, regionCode, fetchedStationLat, fetchedStationName]);

  const handleConfirm = async () => {
    // Xin quyền hiển thị thông báo trình duyệt
    if (Notification.permission !== "granted") {
      await Notification.requestPermission();
    }
    
    if (Notification.permission === "granted" || Notification.permission === "default") {
      const plan = {
        id: Date.now().toString(),
        regionCode,
        boardingStationId,
        stationName: fetchedStationName || stationName || `Trạm ${boardingStationId}`,
        stationLat: fetchedStationLat,
        stationLng: fetchedStationLng,
        routeNo,
        walkTimeMins: walkTimeMins || 5,
        startLat,
        startLng,
        endLat,
        endLng,
        status: 'active'
      };
      
      // Lưu vào LocalStorage
      const existing = JSON.parse(localStorage.getItem('vinbus_plans') || '[]');
      localStorage.setItem('vinbus_plans', JSON.stringify([...existing, plan]));
      
      setConfirmed(true);
      // Bắn event để GlobalTracker nhận biết
      window.dispatchEvent(new Event('vinbus_plan_updated'));
      
      new Notification("Kế hoạch đã được lưu!", {
        body: `Hệ thống sẽ chạy ngầm và báo động khi tuyến ${routeNo} sắp tới trạm ${boardingStationId}.`,
        icon: "/vite.svg"
      });
    } else {
      alert("Bạn cần cấp quyền Thông báo (Notification) để hệ thống có thể báo động cho bạn!");
    }
  };

  if (!startLat || !endLat || !fetchedStationLat) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 my-2 flex items-center gap-2">
        <span className="text-red-700 text-sm font-medium">⚠️ Agent bị lỗi khi tạo Kế hoạch (Thiếu toạ độ GPS). Đừng nhấn nút nào cả, hãy yêu cầu Agent thử lại.</span>
      </div>
    );
  }

  return (
    <div className="bg-white border-2 border-indigo-100 rounded-xl p-4 shadow-sm my-3 w-full max-w-full">
      <h3 className="font-bold text-indigo-900 mb-2 flex items-center gap-2">
        <FiClock className="text-indigo-500" />
        Kế hoạch: Đón xe {routeNo}
      </h3>
      
      <div className="-mx-4 -mt-2 mb-4">
        <MapCard 
          startLat={startLat} 
          startLng={startLng} 
          endLat={endLat} 
          endLng={endLng} 
          regionCode={regionCode || 'hn'} 
          liveData={liveData}
          targetRoute={routeNo}
          showToolbar={true}
        />
      </div>

      <ul className="text-sm text-gray-600 mb-4 space-y-1">
        <li>📍 Trạm đón: <strong>{stationName || boardingStationId}</strong></li>
        <li>🚶 Đi bộ ra bến: <strong>{walkTimeMins} phút</strong></li>
        <li>🔔 Hệ thống sẽ báo động trước khi xe đến.</li>
      </ul>

      {/* Realtime Buses List */}
      {liveData && (
        <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
          <h4 className="font-bold text-xs text-gray-500 uppercase tracking-wider mb-2 flex justify-between items-center">
            <span>🚌 Các chuyến xe đang chạy tới</span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </h4>
          {(() => {
            const safeTarget = String(routeNo).trim();
            const routeInfo = liveData.find(r => String(r.routeNo).trim() === safeTarget || String(r.routeId) === safeTarget);
            const buses = routeInfo?.list || [];
            if (buses.length === 0) {
              return <p className="text-sm text-gray-500 italic">Hiện chưa có xe nào sắp tới trạm này.</p>;
            }
            return (
              <div className="space-y-2">
                {buses.map((bus, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-white p-2 border border-gray-100 rounded shadow-sm text-sm">
                    <span className="font-medium text-gray-800">Biển số: {bus.vehicleNumber || bus.busId || 'N/A'}</span>
                    <span className="font-bold text-red-600">
                      Còn {bus.time ? Math.round(bus.time / 60) : '?'} phút
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
      
      {confirmed ? (
        <div className="w-full bg-emerald-50 text-emerald-700 border border-emerald-200 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2">
          <FiCheck className="text-emerald-500" />
          Đã lưu & Đang theo dõi ngầm
        </div>
      ) : (
        <button 
          onClick={handleConfirm}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          <FiBell />
          Xác nhận & Theo dõi
        </button>
      )}
    </div>
  );
}


// 2. Component chạy ngầm toàn cục (Mount ở App.jsx)
export function GlobalTracker() {
  const [plans, setPlans] = useState([]);
  
  const loadPlans = () => {
    const stored = JSON.parse(localStorage.getItem('vinbus_plans') || '[]');
    setPlans(stored);
  };

  useEffect(() => {
    loadPlans();
    window.addEventListener('vinbus_plan_updated', loadPlans);
    return () => window.removeEventListener('vinbus_plan_updated', loadPlans);
  }, []);

  useEffect(() => {
    if (plans.length === 0) return;

    let timeoutId;
    let isMounted = true;

    const poll = async () => {
      for (const plan of plans) {
        try {
          const res = await fetch(`http://localhost:8000/api/eta?region_code=${plan.regionCode}&station_id=${plan.boardingStationId}`);
          const data = await res.json();
          if (data.status === "SUCCESS") {
            let fastest_eta = Infinity;
            
            for (const route of data.data) {
              if (route.routeNo === plan.routeNo) {
                for (const bus of route.list) {
                  const eta = Math.ceil(bus.time / 60);
                  if (eta < fastest_eta) fastest_eta = eta;
                }
              }
            }
            
            console.log(`[Tracker ${plan.routeNo}] Fastest ETA: ${fastest_eta} mins`);
            
            // Smart polling interval
            let nextInterval = 60000; // default 1 min
            
            if (fastest_eta !== Infinity) {
              // Báo động!
              if (fastest_eta <= plan.walkTimeMins + 2) {
                new Notification("BẮT ĐẦU DI CHUYỂN!", {
                  body: `Xe ${plan.routeNo} chỉ còn cách bạn ${fastest_eta} phút. Hãy ra bến ngay!`,
                  requireInteraction: true
                });
                
                // Xóa plan sau khi báo động
                const remaining = plans.filter(p => p.id !== plan.id);
                localStorage.setItem('vinbus_plans', JSON.stringify(remaining));
                window.dispatchEvent(new Event('vinbus_plan_updated'));
                return; // Ngừng poll plan này
              }
              
              if (fastest_eta > 10) nextInterval = 180000; // 3 mins
              else if (fastest_eta > 3) nextInterval = 60000; // 1 min
              else nextInterval = 15000; // 15s
            }
            
            if (isMounted) {
              timeoutId = setTimeout(poll, nextInterval);
            }
            return; // Chỉ xử lý 1 plan cùng lúc để đơn giản
          }
        } catch (e) {
          console.error("Tracker poll error", e);
        }
      }
      
      if (isMounted) {
        timeoutId = setTimeout(poll, 60000);
      }
    };

    poll();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [plans]);

  const removePlan = (id) => {
    const remaining = plans.filter(p => p.id !== id);
    localStorage.setItem('vinbus_plans', JSON.stringify(remaining));
    loadPlans();
  };

  if (plans.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {plans.map(plan => (
        <div key={plan.id} className="bg-indigo-900 text-white p-3 rounded-lg shadow-xl border border-indigo-700 flex items-center gap-3 text-sm animate-fade-in-down">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
          <div>
            <p className="font-bold text-emerald-300">Đang theo dõi {plan.routeNo}</p>
            <p className="text-xs text-indigo-200">Trạm: {plan.boardingStationId}</p>
          </div>
          <button onClick={() => removePlan(plan.id)} className="ml-2 text-indigo-300 hover:text-red-400 transition-colors p-1" title="Hủy theo dõi">
            <FiTrash2 size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
