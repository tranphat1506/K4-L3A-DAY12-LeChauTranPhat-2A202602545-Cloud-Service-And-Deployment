import React, { useState, useEffect } from 'react';
import { FiClock, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';

export default function JitTrackerCard({ regionCode, boardingStationId, routeNo, walkTimeMins }) {
  const [trackerData, setTrackerData] = useState({
    buses: [],
    fastest_eta: null,
    alert: "",
    status: "Đang kết nối..."
  });

  useEffect(() => {
    // Connect to WebSocket
    const params = new URLSearchParams({
      region_code: regionCode,
      boarding_station_id: boardingStationId,
      route_no: routeNo,
      walk_time_mins: walkTimeMins
    });
    
    const ws = new WebSocket(`ws://localhost:8000/api/ws/tracker?${params.toString()}`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.error) {
        setTrackerData(prev => ({ ...prev, status: "Lỗi: " + data.error }));
      } else {
        setTrackerData(data);
      }
    };
    
    ws.onclose = () => {
      setTrackerData(prev => ({ ...prev, status: "Đã ngắt kết nối." }));
    };

    return () => {
      ws.close();
    };
  }, [regionCode, boardingStationId, routeNo, walkTimeMins]);

  return (
    <div className="bg-indigo-900 border border-indigo-700 rounded-xl p-4 shadow-2xl my-4 text-white font-sans max-w-sm">
      <div className="flex items-center gap-2 mb-3 border-b border-indigo-700 pb-2">
        <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center animate-pulse">
          <FiClock size={16} className="text-white" />
        </div>
        <div>
          <h3 className="font-bold text-lg text-emerald-300">Live Tracker: Tuyến {routeNo}</h3>
          <p className="text-xs text-indigo-300">Trạm đón: {boardingStationId}</p>
        </div>
      </div>

      {trackerData.alert ? (
        <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 mb-3 flex items-start gap-3">
          <FiAlertCircle className="text-red-400 mt-1 flex-shrink-0" size={20} />
          <p className="text-red-200 font-medium text-sm">{trackerData.alert}</p>
        </div>
      ) : (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 mb-3 flex items-center gap-2">
          <FiCheckCircle className="text-emerald-400" />
          <p className="text-emerald-100 text-sm">Đang theo dõi. Cứ thong thả nhé!</p>
        </div>
      )}

      <div className="space-y-2 mb-4">
        {trackerData.buses && trackerData.buses.length > 0 ? (
          trackerData.buses.map((bus, idx) => (
            <div key={idx} className="flex justify-between items-center bg-indigo-800/50 p-2 rounded">
              <span className="text-sm text-indigo-200">{bus.vehicleNumber || bus.busId}</span>
              <span className="font-mono text-emerald-400 font-bold">
                {Math.ceil(bus.time / 60)} phút
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm text-indigo-300 italic text-center py-2">Chưa có xe trên tuyến...</p>
        )}
      </div>

      <div className="flex justify-between items-center text-xs text-indigo-400 border-t border-indigo-700 pt-2">
        <span>Đi bộ ước tính: {walkTimeMins}p</span>
        <span>{trackerData.status}</span>
      </div>
    </div>
  );
}
