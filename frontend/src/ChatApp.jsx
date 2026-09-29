import ReactMarkdown from 'react-markdown';
import { ProposedPlanCard, GlobalTracker } from './components/TripPlanner';
import MapCard from './components/MapCard';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSend, FiUser, FiMap, FiClock, FiSearch, FiMessageSquare, FiNavigation, FiMapPin, FiChevronDown, FiChevronUp, FiTrash2 } from 'react-icons/fi';

// Component bọc map cũ - chỉ render children (và fetch API) khi người dùng bấm mở
function CollapsedMapCard({ label, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-600 transition-colors"
      >
        <span className="flex items-center gap-2">
          <FiMap size={14} className="text-emerald-500" />
          {label}
        </span>
        {open ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
      </button>
      {open && <div className="border-t border-gray-100">{children}</div>}
    </div>
  );
}

function App() {
  const [sessionId] = useState(() => {
    let sid = localStorage.getItem('vinbus_session_id');
    if (!sid) {
      sid = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
      localStorage.setItem('vinbus_session_id', sid);
    }
    return sid;
  });
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('vinbus_chat_history');
    return saved ? JSON.parse(saved) : [];
  });

  // Lưu history mỗi khi messages thay đổi
  useEffect(() => {
    localStorage.setItem('vinbus_chat_history', JSON.stringify(messages));
  }, [messages]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [latestLogs, setLatestLogs] = useState([]);
  const [activeTrackers, setActiveTrackers] = useState([]);
  
  const [location, setLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Tự động lấy GPS nếu đã có quyền
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        if (result.state === 'granted') {
          requestLocation();
        }
      });
    }
  }, []);

  const requestLocation = () => {
    setIsLocating(true);
    setLocationError('');
    
    if (!navigator.geolocation) {
      setLocationError('Trình duyệt không hỗ trợ định vị.');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setIsLocating(false);
      },
      (error) => {
        console.error("Lỗi lấy vị trí:", error);
        setLocationError('Không thể lấy vị trí. Hãy bật quyền truy cập GPS.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userQuery = input;
    
    // TIÊU CHUẨN HÓA CONTEXT WINDOW: 
    // Chỉ lấy text content (bỏ qua thẻ UI như trip_plan/map)
    // Và giữ lại tối đa 10 tin nhắn gần nhất để không vượt quá giới hạn token
    const normalizedHistory = messages
      .filter(msg => !msg.type || msg.type === 'text')
      .slice(-10)
      .map(msg => ({
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      }));
      
    const currentHistory = [...messages];
    
    setMessages([...currentHistory, { role: 'user', content: userQuery }]);
    setInput('');
    setLoading(true);
    setLatestLogs([]);

    let finalQuery = userQuery;
    if (location) {
      finalQuery += `\n(Ghi chú hệ thống: Tọa độ GPS hiện tại của người dùng là Latitude: ${location.lat}, Longitude: ${location.lng}. Nếu người dùng nói "từ chỗ tôi" hoặc "gần tôi", hãy dùng tọa độ này để tra cứu).`;
    }

    try {
      const response = await fetch('http://localhost:8000/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: finalQuery,
          history: normalizedHistory
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let shouldRequestLocation = false;
      let logs = [];

      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete events separated by double newline
        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
          const eventStr = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          
          if (eventStr.startsWith('data: ')) {
            const dataStr = eventStr.replace('data: ', '').trim();
            if (dataStr) {
              try {
                const logData = JSON.parse(dataStr);
                
                if (logData.error) {
                    assistantContent = "Error: " + logData.error;
                    setMessages(prev => [...prev, { role: 'assistant', content: assistantContent }]);
                    break;
                }
                
                // Thu thập log vào debugger panel (giữ nguyên nếu muốn)
                logs = [...logs, logData];
                setLatestLogs(logs);

                // KIẾN TRÚC MỚI: Dựa vào trường `type`
                if (logData.type === "thought") {
                  // Chú ý: Chỉ hiện ở log bên tay phải, KHÔNG đưa vào khung chat chính
                }
                else if (logData.type === "action_confirm_trip") {
                  // Mở card kế hoạch
                  setMessages(prev => [...prev, { 
                    role: 'assistant', 
                    type: 'trip_plan',
                    content: logData.action_data || {},
                    text: logData.message // Kèm thêm tin nhắn
                  }]);
                }
                else if (logData.type === "action_show_map") {
                  // Mở bản đồ
                  setMessages(prev => [...prev, { 
                    role: 'assistant', 
                    type: 'route_map',
                    content: logData.action_data || {},
                    text: logData.message // Kèm thêm tin nhắn
                  }]);
                }
                else if (logData.type === "chat") {
                  // Kết quả chat bình thường (Final Answer)
                  assistantContent = logData.message || "";
                  if (assistantContent.includes("[REQUEST_LOCATION]")) {
                    shouldRequestLocation = true;
                    assistantContent = assistantContent.replace(/\[REQUEST_LOCATION\]/g, "").trim();
                  }
                  
                  // Chèn vào cuối
                  setMessages(prev => [...prev, { role: 'assistant', type: 'chat', content: assistantContent }]);
                  
                  if (shouldRequestLocation) {
                    requestLocation();
                  }
                }
              } catch (e) {
                console.error("Error parsing JSON chunk:", e, dataStr);
              }
            }
          }
          boundary = buffer.indexOf('\n\n');
        }
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Hệ thống đang bảo trì. Vui lòng thử lại sau." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-800">
      
      {/* CỘT TRÁI: GIAO DIỆN CLIENT */}
      <div className="w-full lg:w-2/3 flex flex-col bg-white border-r border-gray-200 z-10 shadow-sm relative">
        
        {/* Header */}
        <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between z-20 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-md flex items-center justify-center text-white shadow-sm">
              <FiMap size={20} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Hỗ trợ lộ trình VinBus</h1>
              <p className="text-sm text-emerald-600 font-medium">Trực tuyến</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/plans')}
              className="hidden sm:flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold hover:bg-emerald-200 transition-colors shadow-sm"
            >
              <FiClock /> Quản lý lộ trình
            </button>
            <button
              onClick={() => {
                if(window.confirm("Bạn có chắc chắn muốn xóa lịch sử chat?")) {
                  setMessages([]);
                  localStorage.removeItem('vinbus_chat_history');
                }
              }}
              className="hidden sm:flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition-colors shadow-sm"
              title="Xóa lịch sử chat"
            >
              <FiTrash2 /> Xóa
            </button>
          
          <button 
            onClick={requestLocation}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-sm border ${
              location 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
            }`}
            title="Sử dụng vị trí hiện tại"
          >
            {isLocating ? (
              <span className="animate-pulse">Đang định vị...</span>
            ) : location ? (
              <>
                <FiMapPin className="text-emerald-500" /> Đã kết nối GPS
              </>
            ) : (
              <>
                <FiNavigation /> Bật định vị
              </>
            )}
          </button>
          </div>
        </div>

        {/* Khung Chat */}
        <div className="flex-1 p-4 sm:p-8 overflow-y-auto scroll-smooth bg-gray-50/50">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-5 animate-fade-in-up">
              <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-2 relative">
                <FiMessageSquare size={36} />
                {location && (
                  <div className="absolute -top-2 -right-2 bg-emerald-500 text-white p-1.5 rounded-full shadow-md">
                    <FiMapPin size={12} />
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-gray-800 mb-2">Xin chào!</h2>
                <p className="text-gray-500 max-w-md mx-auto text-base">
                  Hệ thống có thể định vị tọa độ của bạn để tra cứu xe buýt chính xác hơn. Hãy bật GPS và thử hỏi một câu nhé!
                </p>
                {locationError && (
                  <p className="text-red-500 text-sm mt-2">{locationError}</p>
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-3 mt-4">
                <button 
                  className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:border-emerald-500 hover:text-emerald-700 transition-colors shadow-sm"
                  onClick={() => setInput("Từ chỗ tôi làm sao để đi tới Times City?")}
                >
                  Từ chỗ tôi đi Times City
                </button>
                <button 
                  className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:border-emerald-500 hover:text-emerald-700 transition-colors shadow-sm"
                  onClick={() => setInput("Gần vị trí của tôi có trạm VinBus nào không?")}
                >
                  Tìm trạm gần tôi nhất
                </button>
              </div>
            </div>
          )}
          
          <div className="space-y-6 max-w-3xl mx-auto">
            {(() => {
              const mapTypes = ['trip_plan', 'route_map'];
              const latestMapIndex = messages.reduce((latest, msg, i) =>
                mapTypes.includes(msg.type) ? i : latest, -1);

              return messages.map((msg, index) => {
                const stableKey = msg.type === 'trip_plan'
                  ? `plan-${msg.content?.boarding_station_id}-${msg.content?.route_no}-${index}`
                  : msg.type === 'route_map'
                  ? `map-${msg.content?.start_lat}-${msg.content?.end_lat}-${index}`
                  : `msg-${index}`;

                return (
                  <div key={stableKey} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-9 h-9 bg-emerald-100 rounded-md flex-shrink-0 flex items-center justify-center text-emerald-700 mr-4 mt-1">
                        <FiMap size={18} />
                      </div>
                    )}

                    <div className={`max-w-[85%] rounded-lg p-4 text-[15px] leading-relaxed shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white border border-gray-100 text-gray-800'
                    }`}>

                      {msg.text && (
                        <div className="mb-3 markdown-body text-sm">
                          <ReactMarkdown>{msg.text}</ReactMarkdown>
                        </div>
                      )}

                      {msg.type === 'trip_plan' ? (
                        index === latestMapIndex ? (
                          <ProposedPlanCard
                            regionCode={msg.content.region_code}
                            boardingStationId={msg.content.boarding_station_id}
                            stationName={msg.content.station_name}
                            stationLat={msg.content.station_lat}
                            stationLng={msg.content.station_lng}
                            routeNo={msg.content.route_no}
                            walkTimeMins={msg.content.walk_time_mins}
                            startLat={msg.content.start_lat}
                            startLng={msg.content.start_lng}
                            endLat={msg.content.end_lat}
                            endLng={msg.content.end_lng}
                          />
                        ) : (
                          <CollapsedMapCard label={`Kế hoạch: Tuyến ${msg.content.route_no}`}>
                            <ProposedPlanCard
                              regionCode={msg.content.region_code}
                              boardingStationId={msg.content.boarding_station_id}
                              stationName={msg.content.station_name}
                              stationLat={msg.content.station_lat}
                              stationLng={msg.content.station_lng}
                              routeNo={msg.content.route_no}
                              walkTimeMins={msg.content.walk_time_mins}
                              startLat={msg.content.start_lat}
                              startLng={msg.content.start_lng}
                              endLat={msg.content.end_lat}
                              endLng={msg.content.end_lng}
                            />
                          </CollapsedMapCard>
                        )
                      ) : msg.type === 'route_map' ? (
                        index === latestMapIndex ? (
                          <MapCard
                            startLat={msg.content.start_lat}
                            startLng={msg.content.start_lng}
                            endLat={msg.content.end_lat}
                            endLng={msg.content.end_lng}
                            regionCode={msg.content.region_code}
                          />
                        ) : (
                          <CollapsedMapCard label="Bản đồ lộ trình">
                            <MapCard
                              startLat={msg.content.start_lat}
                              startLng={msg.content.start_lng}
                              endLat={msg.content.end_lat}
                              endLng={msg.content.end_lng}
                              regionCode={msg.content.region_code}
                            />
                          </CollapsedMapCard>
                        )
                      ) : (
                        <div className="markdown-body text-sm">
                          <ReactMarkdown
                            components={{
                              strong: ({node, ...props}) => <strong className="font-bold text-gray-900" {...props} />,
                              a: ({node, ...props}) => <a className="text-emerald-600 underline" {...props} />,
                              ul: ({node, ...props}) => <ul className="list-disc pl-5 my-2 space-y-1" {...props} />,
                              ol: ({node, ...props}) => <ol className="list-decimal pl-5 my-2 space-y-1" {...props} />,
                              li: ({node, ...props}) => <li {...props} />,
                              p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>

                    {msg.role === 'user' && (
                      <div className="w-9 h-9 bg-gray-200 rounded-md flex-shrink-0 flex items-center justify-center text-gray-600 ml-4 mt-1">
                        <FiUser size={18} />
                      </div>
                    )}
                  </div>
                );
              });
            })()}

            
            {loading && (
              <div className="flex justify-start items-center">
                <div className="w-9 h-9 bg-emerald-100 rounded-md flex-shrink-0 flex items-center justify-center text-emerald-700 mr-4">
                  <FiMap size={18} />
                </div>
                <div className="bg-white border border-gray-100 rounded-lg p-4 shadow-sm flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{animationDelay: "0.2s"}}></span>
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{animationDelay: "0.4s"}}></span>
                  </div>
                  <span className="text-sm text-gray-500 font-medium">Đang xử lý phân tích lộ trình...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        
        
        {/* Khung Nhập Liệu */}
        <div className="p-5 bg-white border-t border-gray-100">
          <div className="max-w-3xl mx-auto relative flex items-center">
            <button 
              onClick={requestLocation}
              className={`absolute left-3 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                location ? 'text-emerald-600 bg-emerald-50' : 'text-gray-400 hover:text-emerald-600 hover:bg-gray-100'
              }`}
              title="Đính kèm vị trí"
            >
              <FiNavigation size={16} className={isLocating ? "animate-pulse" : ""} />
            </button>
            <input 
              type="text" 
              className="w-full bg-gray-50 border border-gray-200 text-gray-800 rounded-lg pl-12 pr-14 py-3.5 focus:outline-none focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all"
              placeholder={location ? "Nhập điểm đến (Đã có GPS)..." : "Nhập địa điểm đi và đến..."}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              disabled={loading}
            />
            <button 
              className={`absolute right-2 w-10 h-10 rounded-md flex items-center justify-center transition-colors ${
                loading || !input.trim() 
                  ? 'text-gray-300 cursor-not-allowed' 
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
              }`}
              onClick={handleSend}
              disabled={loading || !input.trim()}
            >
              <FiSend size={16} className={input.trim() && !loading ? "-ml-0.5 mt-0.5" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* CỘT PHẢI: TRACE LOGS CÓ THỂ ĐÓNG MỞ (ACCORDION) */}
      <div className="hidden lg:flex w-1/3 bg-[#1e293b] flex-col text-slate-300">
        <div className="p-5 border-b border-slate-700/50 bg-[#0f172a] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiClock size={16} className="text-emerald-400" />
            <h2 className="text-sm font-semibold tracking-wide text-slate-100">Trace Logs</h2>
          </div>
          <span className="text-xs border border-slate-700 bg-slate-800 px-2.5 py-1 rounded-md text-slate-400">System Activity</span>
        </div>
        
        <div className="flex-1 p-5 overflow-y-auto space-y-5 custom-scrollbar">
          {latestLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
              <span className="text-sm">Chưa có luồng thực thi nào.</span>
            </div>
          ) : (
            latestLogs.map((log, index) => (
              <div key={index} className="pl-4 pb-4 border-l border-slate-700 last:border-l-0 last:pb-0 relative">
                <div className={`absolute -left-[5px] top-0 w-2 h-2 rounded-full ${
                  log.action_type === 'FINAL_ANSWER' ? 'bg-emerald-500' : 'bg-blue-400'
                }`}></div>

                <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4 shadow-sm">
                  <div className="text-xs font-semibold text-slate-200 uppercase tracking-wide flex justify-between items-center mb-3 pb-3 border-b border-slate-700/50">
                    <span className={log.action_type === 'FINAL_ANSWER' ? 'text-emerald-400' : 'text-blue-400'}>
                      {log.action_type === 'FINAL_ANSWER' ? 'Hoàn thành' : log.tool_name}
                    </span>
                    <span className="text-slate-400 font-normal">
                      {log.latency_ms}ms
                    </span>
                  </div>
                  
                  <div className="space-y-4 text-[13px]">
                    <div>
                      <span className="text-slate-500 text-xs block mb-1">Mục đích (Thought):</span>
                      <p className="text-slate-300 leading-relaxed">{log.thought}</p>
                    </div>
                    
                    {log.action_type === 'TOOL_EXECUTION' && (
                      <div className="space-y-3">
                        {/* Collapsible Input JSON */}
                        <details className="bg-[#0f172a] rounded-md border border-slate-700/50 group cursor-pointer [&_summary::-webkit-details-marker]:hidden">
                          <summary className="text-slate-400 hover:text-slate-200 text-xs p-3 font-medium flex justify-between items-center transition-colors">
                            <span>Dữ liệu gửi đi (Input)</span>
                            <FiChevronDown className="transform group-open:rotate-180 transition-transform duration-200" />
                          </summary>
                          <div className="p-3 pt-0 border-t border-slate-700/50 mt-1 cursor-text">
                            <pre className="text-emerald-300/80 font-mono text-xs overflow-x-auto whitespace-pre-wrap break-all">
                              {JSON.stringify(log.arguments, null, 2)}
                            </pre>
                          </div>
                        </details>

                        {/* Collapsible Output JSON */}
                        <details className="bg-[#0f172a] rounded-md border border-slate-700/50 group cursor-pointer [&_summary::-webkit-details-marker]:hidden">
                          <summary className="text-slate-400 hover:text-slate-200 text-xs p-3 font-medium flex justify-between items-center transition-colors">
                            <span>Dữ liệu nhận về (Observation)</span>
                            <FiChevronDown className="transform group-open:rotate-180 transition-transform duration-200" />
                          </summary>
                          <div className="p-3 pt-0 border-t border-slate-700/50 mt-1 cursor-text">
                            <pre className="text-yellow-300/80 font-mono text-xs overflow-x-auto max-h-64 whitespace-pre-wrap break-all custom-scrollbar">
                              {JSON.stringify(log.observation, null, 2)}
                            </pre>
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}

export default App;
