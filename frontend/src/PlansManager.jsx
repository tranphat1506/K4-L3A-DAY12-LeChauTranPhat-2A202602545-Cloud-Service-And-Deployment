import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiClock, FiMapPin, FiNavigation, FiTrash2, FiBell, FiAlertCircle } from 'react-icons/fi';
import MapCard from './components/MapCard';

export default function PlansManager() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [liveData, setLiveData] = useState(null);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('vinbus_plans') || '[]');
    setPlans(stored);
  }, []);

  // Auto-fetch station name if missing
  useEffect(() => {
    if (selectedPlan && selectedPlan.boardingStationId && (!selectedPlan.stationName || selectedPlan.stationName.startsWith("Trạm "))) {
      fetch(`http://localhost:8000/api/station/${selectedPlan.boardingStationId}?region_code=${selectedPlan.regionCode || 'hn'}`)
        .then(res => res.json())
        .then(data => {
          if (data.status === "SUCCESS" && data.data && data.data.stationName) {
            setSelectedPlan(prev => ({ ...prev, stationName: data.data.stationName }));
            setPlans(prevPlans => {
              const newPlans = prevPlans.map(p => p.id === selectedPlan.id ? { ...p, stationName: data.data.stationName } : p);
              localStorage.setItem('vinbus_plans', JSON.stringify(newPlans));
              return newPlans;
            });
          }
        }).catch(console.error);
    }
  }, [selectedPlan?.id, selectedPlan?.boardingStationId]);

  // Poll ETA cho plan đang được chọn xem chi tiết
  useEffect(() => {
    if (!selectedPlan) return;
    
    let isMounted = true;
    let localLiveDataRef = null;
    let slowIntervalId;
    let fastIntervalId;

    const fetchEta = () => {
      fetch(`http://localhost:8000/api/eta?region_code=${selectedPlan.regionCode}&station_id=${selectedPlan.boardingStationId}`)
        .then(res => res.json())
        .then(async data => {
          if (data.status === "SUCCESS" && data.data && isMounted) {
            const liveDataCopy = [...data.data];
            const safeTarget = String(selectedPlan.routeNo).trim();
            const routeInfo = liveDataCopy.find(r => String(r.routeNo).trim() === safeTarget || String(r.routeId) === safeTarget);
            if (routeInfo && routeInfo.list) {
              const promises = routeInfo.list.map(async (bus) => {
                if (!bus.busId) return bus;
                try {
                  const locRes = await fetch(`http://localhost:8000/api/bus-location?region_code=${selectedPlan.regionCode || 'hn'}&station_id=${selectedPlan.boardingStationId}&route_id=${routeInfo.routeId}&bus_id=${bus.busId}`);
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
            if (isMounted) {
              localLiveDataRef = liveDataCopy;
              setLiveData(liveDataCopy);
            }
          }
        }).catch(e => console.error(e));
    };

    const fetchNearestBusLocation = async () => {
      if (!localLiveDataRef || !isMounted) return;
      const liveDataCopy = [...localLiveDataRef];
      const safeTarget = String(selectedPlan.routeNo).trim();
      const routeInfo = liveDataCopy.find(r => String(r.routeNo).trim() === safeTarget || String(r.routeId) === safeTarget);
      
      if (routeInfo && routeInfo.list && routeInfo.list.length > 0) {
        const validBuses = routeInfo.list.filter(b => b.busId && b.time != null);
        if (validBuses.length === 0) return;
        
        const nearestBus = validBuses.reduce((prev, curr) => (prev.time < curr.time) ? prev : curr);
        
        if (nearestBus.time <= 900) {
          try {
            const locRes = await fetch(`http://localhost:8000/api/bus-location?region_code=${selectedPlan.regionCode || 'hn'}&station_id=${selectedPlan.boardingStationId}&route_id=${routeInfo.routeId}&bus_id=${nearestBus.busId}`);
            const locData = await locRes.json();
            if (locData.status === "SUCCESS" && locData.data && isMounted) {
              const targetBus = routeInfo.list.find(b => b.busId === nearestBus.busId);
              if (targetBus) {
                targetBus.lat = locData.data.lat;
                targetBus.lng = locData.data.lng;
                localLiveDataRef = liveDataCopy;
                setLiveData([...liveDataCopy]);
              }
            }
          } catch (e) {}
        }
      }
    };

    setLiveData(null);
    fetchEta();
    slowIntervalId = setInterval(fetchEta, 30000);
    fastIntervalId = setInterval(fetchNearestBusLocation, 5000);

    return () => {
      isMounted = false;
      clearInterval(slowIntervalId);
      clearInterval(fastIntervalId);
    };
  }, [selectedPlan?.id, selectedPlan?.boardingStationId, selectedPlan?.routeNo, selectedPlan?.regionCode]);

  const handleDelete = (id, e) => {
    if (e) e.stopPropagation();
    const newPlans = plans.filter(p => p.id !== id);
    localStorage.setItem('vinbus_plans', JSON.stringify(newPlans));
    setPlans(newPlans);
    if (selectedPlan?.id === id) setSelectedPlan(null);
    window.dispatchEvent(new Event('vinbus_plan_updated'));
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      {/* Sidebar Danh sách Plan */}
      <div className="w-full md:w-1/3 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center gap-3">
          <button onClick={() => navigate('/chat')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <FiArrowLeft size={20} />
          </button>
          <h1 className="font-bold text-lg text-emerald-800">Kế Hoạch Của Tôi</h1>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {plans.length === 0 ? (
            <div className="text-center text-gray-500 mt-10">
              <p>Chưa có kế hoạch nào.</p>
              <button onClick={() => navigate('/chat')} className="mt-4 text-emerald-600 font-medium hover:underline">Quay lại Chat để lập kế hoạch</button>
            </div>
          ) : (
            plans.map(plan => (
              <div 
                key={plan.id}
                onClick={() => setSelectedPlan(plan)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedPlan?.id === plan.id 
                    ? 'border-emerald-500 bg-emerald-50 shadow-sm' 
                    : 'border-gray-100 bg-white hover:border-emerald-300'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded text-xs font-bold">Tuyến {plan.routeNo}</span>
                  <button onClick={(e) => handleDelete(plan.id, e)} className="text-gray-400 hover:text-red-500">
                    <FiTrash2 size={16} />
                  </button>
                </div>
                <div className="text-sm text-gray-600 flex items-center gap-2 mt-2">
                  <FiMapPin className="text-gray-400" /> Trạm đón: {plan.boardingStationId}
                </div>
                <div className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                  <FiNavigation className="text-gray-400" /> Đi bộ: {plan.walkTimeMins} phút
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content Chi tiết Plan */}
      <div className="hidden md:flex flex-1 flex-col bg-slate-50">
        {selectedPlan ? (
          <div className="p-8 h-full overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-2xl mx-auto">
              <div className="flex justify-between items-center mb-6 pb-6 border-b border-gray-100">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Chi Tiết Lộ Trình</h2>
                  <p className="text-emerald-600 font-medium flex items-center gap-2 mt-1">
                    <FiBell /> Đang theo dõi tự động
                  </p>
                </div>
                <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center">
                  <span className="font-black text-2xl text-emerald-700">{selectedPlan.routeNo}</span>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-emerald-100 shadow-sm mb-8 p-5">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <FiNavigation className="text-emerald-500" /> Hướng dẫn di chuyển
                </h3>
                
                <div className="relative border-l-2 border-emerald-200 ml-3 pl-6 space-y-6">
                  {/* Điểm xuất phát */}
                  <div className="relative">
                    <div className="absolute -left-[33px] top-0 w-4 h-4 bg-white border-4 border-emerald-500 rounded-full"></div>
                    <h4 className="font-bold text-gray-800 text-lg">Vị trí của bạn</h4>
                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                      <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">Bắt đầu đi bộ {selectedPlan.walkTimeMins} phút</span>
                    </p>
                  </div>
                  
                  {/* Trạm đón */}
                  <div className="relative">
                    <div className="absolute -left-[33px] top-0 w-4 h-4 bg-emerald-500 border-4 border-emerald-100 rounded-full"></div>
                    <h4 className="font-bold text-emerald-700 text-lg">{selectedPlan.stationName || `Trạm ${selectedPlan.boardingStationId}`}</h4>
                    <p className="text-sm text-emerald-600 flex items-center gap-1 mt-1 font-medium bg-emerald-50 inline-block px-3 py-1 rounded-full border border-emerald-100">
                      🚌 Đón xe tuyến {selectedPlan.routeNo}
                    </p>
                  </div>
                  
                  {/* Điểm đến */}
                  <div className="relative">
                    <div className="absolute -left-[33px] top-0 w-4 h-4 bg-white border-4 border-orange-400 rounded-full"></div>
                    <h4 className="font-bold text-gray-800 text-lg">Điểm đến của bạn</h4>
                    <p className="text-sm text-gray-500 mt-1">Kết thúc hành trình</p>
                  </div>
                </div>
              </div>

              <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
                <FiMapPin className="text-emerald-500" /> Bản đồ Live Tracking
              </h3>
              
              <MapCard 
                startLat={selectedPlan.startLat} 
                startLng={selectedPlan.startLng} 
                endLat={selectedPlan.endLat}
                endLng={selectedPlan.endLng}
                regionCode={selectedPlan.regionCode}
                liveData={liveData}
                targetRoute={selectedPlan.routeNo}
                showToolbar={true}
              />
              
              <h3 className="font-bold text-lg text-gray-800 mt-6 mb-4 flex items-center gap-2">
                <FiClock className="text-emerald-500" /> Danh sách xe (Real-time)
              </h3>
              
              <div className="space-y-3">
                {!liveData ? (
                  <div className="p-4 bg-gray-50 rounded-xl text-center text-gray-500 animate-pulse">Đang cập nhật vệ tinh...</div>
                ) : (
                  (() => {
                    let found = false;
                    const routesUI = liveData.map((route, r_idx) => {
                      const safeTarget = String(selectedPlan.routeNo).trim();
                      if (String(route.routeNo).trim() === safeTarget || String(route.routeId) === safeTarget) {
                        found = true;
                        if (!route.list || route.list.length === 0) {
                          return <div key={r_idx} className="p-4 bg-orange-50 text-orange-700 rounded-xl flex items-center gap-3"><FiAlertCircle /> Không có xe nào khả dụng (có thể xe đã đi qua hoặc chưa xuất bến).</div>;
                        }
                        const sortedBuses = [...route.list].sort((a, b) => a.time - b.time);
                        return sortedBuses.map((bus, b_idx) => {
                          const eta = Math.ceil(bus.time / 60);
                          const isCatchable = eta >= selectedPlan.walkTimeMins + 2;
                          return (
                            <div key={`${r_idx}-${b_idx}`} className={`p-4 rounded-xl flex justify-between items-center ${isCatchable ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
                              <div>
                                <p className="font-bold text-gray-800 flex items-center gap-2">
                                  Xe {bus.vehicleNumber || bus.busId}
                                  <span className="text-xs bg-white bg-opacity-50 px-2 py-0.5 rounded font-normal border border-gray-200">Tuyến {selectedPlan.routeNo}</span>
                                </p>
                                <p className="text-sm text-gray-600 mt-1">Cách trạm đón: {(bus.distance/1000).toFixed(1)} km</p>
                              </div>
                              <div className="text-right">
                                <p className={`text-2xl font-black ${isCatchable ? 'text-emerald-600' : 'text-red-500'}`}>{eta} <span className="text-base font-normal">phút</span></p>
                                {!isCatchable && <p className="text-xs text-red-500 mt-1 font-medium">Không kịp đón!</p>}
                              </div>
                            </div>
                          );
                        });
                      }
                      return null;
                    });
                    
                    if (!found) return <div className="p-4 bg-gray-50 rounded-xl text-center text-gray-500">Tuyến xe này hiện không hoạt động.</div>;
                    return routesUI;
                  })()
                )}
              </div>
              
              <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                <button onClick={() => handleDelete(selectedPlan.id)} className="text-red-500 font-medium hover:underline text-sm">Hủy bỏ kế hoạch này</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400 flex-col gap-4">
            <FiMapPin size={48} className="opacity-20" />
            <p>Chọn một kế hoạch bên trái để xem chi tiết</p>
          </div>
        )}
      </div>
    </div>
  );
}
