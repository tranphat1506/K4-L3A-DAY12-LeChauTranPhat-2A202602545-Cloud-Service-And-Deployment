import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiPlay, FiMonitor, FiMapPin, FiNavigation, FiMap, FiInfo, FiClock, FiSettings,
  FiMessageSquare, FiDatabase, FiAlertTriangle, FiCheckCircle,
  FiCpu, FiGitBranch, FiTarget, FiBox, FiServer, FiGlobe, FiArrowDown, FiArrowRight, FiGithub
} from 'react-icons/fi';

export default function Presentation() {
  const navigate = useNavigate();

  return (
    <div className="w-full min-h-screen bg-gray-50 font-sans text-gray-800 selection:bg-emerald-200 selection:text-emerald-900">
      
      {/* 1. HERO SECTION */}
      <section className="relative w-full py-32 flex flex-col items-center justify-center bg-white border-b border-gray-200 text-center px-4 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-grid-pattern opacity-[0.03] pointer-events-none"></div>
        <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-3xl border border-emerald-100 flex items-center justify-center mb-8 transform -rotate-6">
          <FiMonitor size={48} />
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight mb-4">Trợ Lý Thông Minh <span className="text-emerald-600">VinBus</span></h1>
        <p className="text-xl md:text-2xl text-gray-500 mb-10 max-w-2xl">
          Giải quyết bài toán Phương tiện Công cộng bằng <br className="hidden md:block" /> <b>ReAct Agent Pattern</b> & <b>Model Context Protocol</b>.
        </p>
        
        <button 
          onClick={() => navigate('/chat')}
          className="group relative flex items-center gap-3 px-10 py-5 bg-gray-900 hover:bg-gray-800 text-white rounded-full font-bold text-lg transition-all hover:bg-gray-800"
        >
          <span>Trải nghiệm Live Demo</span>
          <div className="w-8 h-8 bg-white text-gray-900 rounded-full flex items-center justify-center group-hover:bg-emerald-400 group-hover:text-white transition-colors">
            <FiPlay size={16} className="ml-1" />
          </div>
        </button>

        <div className="mt-12 px-5 py-2 bg-gray-100 rounded-full border border-gray-200 ">
          <p className="text-sm text-gray-600 font-semibold tracking-wide">DEMO DAY 3 - K4A</p>
        </div>
      </section>

      {/* 2. SO SÁNH CHATBOT VS REACT AGENT */}
      <section className="py-24 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Chatbot Truyền Thống vs. ReAct Agent</h2>
            <p className="text-gray-500 text-lg">Tại sao các hệ thống RAG tĩnh không thể giải quyết được bài toán thời gian thực?</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Truyền thống */}
            <div className="bg-white p-8 rounded-3xl border border-red-100 flex flex-col items-center text-center">
              <h3 className="text-xl font-bold text-red-500 mb-8 w-full border-b border-red-50 pb-4">Chatbot Truyền Thống (RAG)</h3>
              <div className="space-y-4 w-full px-4">
                <div className="flex flex-col items-center p-4 bg-gray-50 rounded-2xl border border-gray-200">
                  <FiMessageSquare className="text-gray-500 mb-2" size={24} />
                  <p className="font-medium text-gray-700">"Bao giờ xe buýt tới?"</p>
                </div>
                <div className="flex justify-center text-gray-300 w-full"><FiArrowDown size={24} /></div>
                <div className="flex flex-col items-center p-4 bg-gray-50 rounded-2xl border border-gray-200">
                  <FiDatabase className="text-blue-400 mb-2" size={24} />
                  <p className="font-medium text-gray-600">Tìm kiếm Text trong Database tĩnh</p>
                </div>
                <div className="flex justify-center text-gray-300 w-full"><FiArrowDown size={24} /></div>
                <div className="flex flex-col items-center p-4 bg-red-50 rounded-2xl border border-red-100">
                  <FiAlertTriangle className="text-red-500 mb-2" size={24} />
                  <p className="font-bold text-red-600">Thất bại / Hallucination</p>
                  <p className="text-sm text-red-400 mt-1">Không có dữ liệu Live API</p>
                </div>
              </div>
            </div>

            {/* ReAct */}
            <div className="bg-white p-8 rounded-3xl border-2 border-emerald-400 flex flex-col items-center text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-emerald-500 text-white text-xs font-bold px-4 py-1 rounded-bl-xl">GIẢI PHÁP</div>
              <h3 className="text-xl font-bold text-emerald-600 mb-8 w-full border-b border-emerald-50 pb-4">ReAct Agent VinBus</h3>
              <div className="space-y-4 w-full px-4">
                <div className="flex flex-col items-center p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <FiMessageSquare className="text-emerald-600 mb-2" size={24} />
                  <p className="font-medium text-emerald-800">"Bao giờ xe buýt tới?"</p>
                </div>
                <div className="flex flex-col items-center text-emerald-400 font-bold"><FiArrowDown size={24} /> <span className="text-xs mt-1 uppercase tracking-wider">Lập luận</span></div>
                <div className="flex flex-col items-center p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <FiSettings className="text-blue-500 mb-2 animate-spin-slow" size={24} />
                  <p className="font-medium text-blue-800">Kích hoạt Tool `get_eta()` lấy Live Data</p>
                </div>
                <div className="flex flex-col items-center text-emerald-400 font-bold"><FiArrowDown size={24} /> <span className="text-xs mt-1 uppercase tracking-wider">Quan sát</span></div>
                <div className="flex flex-col items-center p-4 bg-emerald-100 rounded-2xl border border-emerald-200">
                  <FiCheckCircle className="text-emerald-600 mb-2" size={24} />
                  <p className="font-bold text-emerald-900">Phản hồi chính xác!</p>
                  <p className="text-sm text-emerald-700 mt-1">"Xe biển số 29B-1234 sắp tới trong 3 phút"</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. TIÊU CHÍ AGENT FIT */}
      <section className="py-24 px-4 bg-white border-y border-gray-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">4 Tiêu Chí Agent Fit</h2>
            <p className="text-gray-500 text-lg">Tại sao ReAct Agent lại là mảnh ghép hoàn hảo cho bài toán này?</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-8 rounded-3xl bg-gray-50 hover:bg-blue-50 transition-colors border border-gray-200 flex gap-6">
              <div className="bg-blue-500 text-white p-4 rounded-2xl h-fit">
                <FiCpu size={28} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Suy luận đa bước</h3>
                <p className="text-gray-600 leading-relaxed">Agent có khả năng chia nhỏ vấn đề phức tạp: Tìm tọa độ ➔ Tìm lộ trình ➔ Tìm trạm xe ➔ Check thời gian xe tới.</p>
              </div>
            </div>

            <div className="p-8 rounded-3xl bg-gray-50 hover:bg-emerald-50 transition-colors border border-gray-200 flex gap-6">
              <div className="bg-emerald-500 text-white p-4 rounded-2xl h-fit">
                <FiSettings size={28} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Tương tác Công cụ</h3>
                <p className="text-gray-600 leading-relaxed">Agent trực tiếp gọi API thực tế của VinBus để lấy dữ liệu realtime (Live ETA) thông qua MCP Server.</p>
              </div>
            </div>

            <div className="p-8 rounded-3xl bg-gray-50 hover:bg-orange-50 transition-colors border border-gray-200 flex gap-6">
              <div className="bg-orange-500 text-white p-4 rounded-2xl h-fit">
                <FiGitBranch size={28} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Quyết định Động</h3>
                <p className="text-gray-600 leading-relaxed">Dựa vào quan sát thực tế (xe đến quá lâu, trạm đóng cửa), Agent sẽ tự động rẽ nhánh và đề xuất phương án khác.</p>
              </div>
            </div>

            <div className="p-8 rounded-3xl bg-gray-50 hover:bg-purple-50 transition-colors border border-gray-200 flex gap-6">
              <div className="bg-purple-500 text-white p-4 rounded-2xl h-fit">
                <FiTarget size={28} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Mục tiêu dài hạn</h3>
                <p className="text-gray-600 leading-relaxed">Ghi nhớ ngữ cảnh trò chuyện xuyên suốt, hướng dẫn hành khách từ điểm xuất phát cho tới lúc bước lên xe.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. KIẾN TRÚC HỆ THỐNG */}
      <section className="py-24 px-4 bg-gray-900 text-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Kiến trúc Hệ thống ReAct & MCP</h2>
            <p className="text-gray-400 text-lg">Cách các thành phần giao tiếp với nhau trong thời gian thực.</p>
          </div>

          <div className="flex flex-col md:flex-row items-stretch justify-between gap-6 p-8 rounded-3xl bg-gray-800 border border-gray-700">
            {/* Lớp Frontend */}
            <div className="flex flex-col items-center bg-gray-700 p-8 rounded-2xl w-full md:w-1/4">
              <FiMonitor className="text-gray-300 mb-4" size={40} />
              <h4 className="font-bold text-lg text-white">1. Client UI</h4>
              <p className="text-sm text-gray-400 text-center mt-3">Vite + React<br/>Giao tiếp & Bắt GPS Ẩn</p>
            </div>

            <div className="text-gray-500 font-bold hidden md:flex flex-col items-center justify-center"><FiArrowRight size={24} /><span className="text-[10px] uppercase mt-1">REST</span></div>
            <div className="text-gray-500 font-bold flex md:hidden justify-center py-2"><FiArrowDown size={24} /></div>

            {/* Lớp Backend */}
            <div className="flex flex-col items-center bg-blue-900/50 border border-blue-500/30 p-8 rounded-2xl w-full md:w-1/4 relative">
              <div className="absolute -top-3 bg-blue-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">FastAPI</div>
              <FiCpu className="text-blue-400 mb-4" size={40} />
              <h4 className="font-bold text-lg text-blue-100">2. ReAct Agent</h4>
              <p className="text-sm text-blue-300/70 text-center mt-3">LLM (Gemini/OpenAI)<br/>Suy luận & Lên kế hoạch</p>
            </div>

            <div className="text-blue-500/50 font-bold hidden md:flex flex-col items-center justify-center"><FiArrowRight size={24} /><span className="text-[10px] uppercase mt-1">MCP</span></div>
            <div className="text-blue-500/50 font-bold flex md:hidden justify-center py-2"><FiArrowDown size={24} /></div>

            {/* Lớp MCP Server */}
            <div className="flex flex-col items-center bg-emerald-900/50 border border-emerald-500/30 p-8 rounded-2xl w-full md:w-1/4 relative">
              <div className="absolute -top-3 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">Python SDK</div>
              <FiBox className="text-emerald-400 mb-4" size={40} />
              <h4 className="font-bold text-lg text-emerald-100">3. MCP Server</h4>
              <p className="text-sm text-emerald-300/70 text-center mt-3">Đăng ký & Cung cấp<br/>8 Công cụ (Tools)</p>
            </div>

            <div className="text-emerald-500/50 font-bold hidden md:flex flex-col items-center justify-center"><FiArrowRight size={24} /><span className="text-[10px] uppercase mt-1">HTTP</span></div>
            <div className="text-emerald-500/50 font-bold flex md:hidden justify-center py-2"><FiArrowDown size={24} /></div>

            {/* Lớp Database Thực Tế */}
            <div className="flex flex-col items-center bg-red-900/50 border border-red-500/30 p-8 rounded-2xl w-full md:w-1/4 relative">
              <div className="absolute -top-3 bg-red-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">Live Data</div>
              <FiGlobe className="text-red-400 mb-4" size={40} />
              <h4 className="font-bold text-lg text-red-100">4. VinBus API</h4>
              <p className="text-sm text-red-300/70 text-center mt-3">Dữ liệu thời gian thực<br/>(Tọa độ, Lộ trình, ETA)</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. MCP TOOLS */}
      <section className="py-24 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between mb-16 gap-6">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Bộ 8 Công Cụ Giao Tiếp</h2>
              <p className="text-gray-500 text-lg">Các Tools được MCP Server expose cho LLM.</p>
            </div>
            <div className="w-16 h-1 bg-blue-500 rounded-full md:hidden"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-3xl border border-gray-200 border border-gray-200 hover:border-gray-300 transition-all group">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <FiMapPin size={28} />
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-3 font-mono">1. geocoding_search</h4>
              <p className="text-gray-500">Biến đổi tên địa danh thành Tọa độ địa lý (Lat, Lng) để hệ thống hiểu vị trí.</p>
            </div>
            
            <div className="bg-white p-8 rounded-3xl border border-gray-200 border border-gray-200 hover:border-gray-300 transition-all group">
              <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <FiNavigation size={28} />
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-3 font-mono">2. get_directions</h4>
              <p className="text-gray-500">Tìm kiếm các tuyến đường khả thi nối từ Điểm A đến Điểm B, bao gồm số trạm.</p>
            </div>
            
            <div className="bg-white p-8 rounded-3xl border border-gray-200 border border-gray-200 hover:border-gray-300 transition-all group">
              <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <FiMap size={28} />
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-3 font-mono">3. get_near_stations</h4>
              <p className="text-gray-500">Quét bán kính xung quanh vị trí hiện tại của User để liệt kê các trạm gần nhất.</p>
            </div>
            
            <div className="bg-white p-8 rounded-3xl border border-gray-200 border border-gray-200 hover:border-gray-300 transition-all group">
              <div className="w-14 h-14 bg-gray-50 text-gray-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <FiInfo size={28} />
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-3 font-mono">4. get_station_detail</h4>
              <p className="text-gray-500">Tra cứu thông tin tĩnh của một trạm cụ thể (Các tuyến xe chạy qua, giờ hoạt động).</p>
            </div>
            
            <div className="bg-white p-8 rounded-3xl border border-gray-200 hover:border-gray-300 transition-all group">
              <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <FiMapPin size={28} />
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-3 font-mono">5. get_bus_detail</h4>
              <p className="text-gray-500">Tra cứu định vị GPS (Kinh độ/Vĩ độ) theo thời gian thực của một chiếc xe buýt cụ thể.</p>
            </div>
            
            
            <div className="bg-white p-8 rounded-3xl border border-gray-200 hover:border-gray-300 transition-all group">
              <div className="w-14 h-14 bg-pink-50 text-pink-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <FiSearch size={28} />
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-3 font-mono">6. search_route</h4>
              <p className="text-gray-500">Tìm kiếm thông tin danh mục tuyến xe (số tuyến, giờ hoạt động, giãn cách chuyến).</p>
            </div>
            
            
            <div className="bg-white p-8 rounded-3xl border border-gray-200 hover:border-gray-300 transition-all group">
              <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <FiMapPin size={28} />
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-3 font-mono">7. get_route_stations</h4>
              <p className="text-gray-500">Tra cứu toàn bộ danh sách các trạm dừng (station_id) thuộc một tuyến xe buýt cụ thể.</p>
            </div>
            
            <div className="bg-emerald-900 p-8 rounded-3xl border border-emerald-800 transform md:col-span-2 lg:col-span-3 relative overflow-hidden text-white flex flex-col md:flex-row gap-8 items-center justify-between">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500 rounded-full blur-3xl opacity-20 pointer-events-none"></div>
              <div>
                <div className="inline-block bg-emerald-800 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-4 border border-emerald-700">TÍNH NĂNG CỐT LÕI</div>
                <h4 className="text-2xl font-bold mb-3 font-mono">8. get_eta (Real-time)</h4>
                <p className="text-emerald-100/80 leading-relaxed max-w-lg">Lấy thời gian thực xe tới bến (Live ETA). Trả về chính xác Biển số xe, Khoảng cách (mét) và Số giây đếm ngược.</p>
              </div>
              <div className="w-24 h-24 bg-emerald-800 text-emerald-400 rounded-full flex items-center justify-center flex-shrink-0 ">
                <FiClock size={40} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="py-24 px-4 bg-white text-center border-t border-gray-100">
        <h2 className="text-3xl font-bold text-gray-900 mb-8">Sẵn sàng để thử nghiệm?</h2>
        <button 
          onClick={() => navigate('/chat')}
          className="inline-flex items-center gap-3 px-10 py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-bold text-lg transition-all hover:bg-emerald-700"
        >
          <FiPlay size={20} /> Bắt đầu Demo Trực Tiếp
        </button>
      </section>

      {/* FOOTER & CREDITS */}
      <footer className="py-8 px-4 bg-gray-50 border-t border-gray-200 text-center">
        <div className="flex flex-col items-center justify-center gap-4">
          <a 
            href="https://github.com/tranphat1506" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors font-medium"
          >
            <FiGithub size={20} />
            <span>@tranphat1506</span>
          </a>
          <p className="text-sm text-gray-400">
            Open-source Project • VinUni AI Course K4A
          </p>
        </div>
      </footer>

    </div>
  );
}
