"""
🚀 CORE AGENT APPLICATION (DAY 03: CHATBOT VS REACT AGENT)
Thực thi so sánh giữa Chatbot Baseline (Cấp 2) và ReAct Agent kết nối MCP Server (Cấp 3).
"""

import json
import os
import sys
from datetime import datetime, timezone, timedelta
import time
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from app.vinbus.mcp_server import MCPVinBusServer
from app.vinbus.prompts import (
    CHATBOT_BASELINE_PROMPT,
    REACT_AGENT_SYSTEM_PROMPT,
    MAX_ITERATIONS
)
from app.vinbus.providers import get_llm_provider

load_dotenv()

def load_test_cases():
    """Tải danh sách 5 test cases từ config/test_cases.json hoặc config/test_cases.example.json"""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    config_path = os.path.join(base_dir, "config", "test_cases.json")
    if not os.path.exists(config_path):
        example_path = os.path.join(base_dir, "config", "test_cases.example.json")
        if os.path.exists(example_path):
            print("⚠️ [CONFIG NOTICE]: Chưa thấy file 'config/test_cases.json'. Đang dùng mẫu 'config/test_cases.example.json'.")
            print("👉 Hãy chạy: copy config/test_cases.example.json config/test_cases.json và viết test cases theo đề tài của bạn!\n")
            config_path = example_path
        else:
            config_path = "test_cases.json"
    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_waterfall_trace(trace_data: list):
    """Ghi vết log Waterfall Trace Log ra file docs/trace_waterfall.json"""
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    docs_dir = os.path.join(base_dir, "docs")
    os.makedirs(docs_dir, exist_ok=True)
    trace_path = os.path.join(docs_dir, "trace_waterfall.json")
    with open(trace_path, "w", encoding="utf-8") as f:
        json.dump(trace_data, f, ensure_ascii=False, indent=2)
    print(f"📊 [OBSERVABILITY]: Đã lưu {len(trace_data)} sự kiện Waterfall Trace tại '{trace_path}'!")


def run_baseline_chatbot(user_query: str, provider):
    """Chạy Chatbot gốc (Cấp 2) không có công cụ gọi Tool"""
    print(f"\n💬 [CHATBOT BASELINE] Câu hỏi: {user_query}")
    
    vn_tz = timezone(timedelta(hours=7))
    now = datetime.now(vn_tz)
    weekdays_vn = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"]
    time_str = now.strftime(f"%H:%M:%S, {weekdays_vn[now.weekday()]}, ngày %d/%m/%Y")
    dynamic_prompt = CHATBOT_BASELINE_PROMPT + f"\n\n[THÔNG TIN]: Bây giờ là {time_str}."
    
    response = provider.generate(user_query, system_prompt=dynamic_prompt)
    print(f"🤖 Chatbot phản hồi:\n{response}")


def run_react_agent(user_query: str, provider, mcp_server: MCPVinBusServer, chat_history: list = None) -> list:
    """
    [REACT AGENT LOOP] Thực thi vòng lặp Thought -> Action -> Observation với MCP Server
    Trả về danh sách trace log của phiên thực thi.
    """
    print(f"\n🤖 [REACT AGENT] Câu hỏi: {user_query}")
    
    step = 0
    trace_logs = []
    tools_list = mcp_server.list_tools()
    
    # ---------------------------------------------------------------------
    # TIÊM THỜI GIAN THỰC TẾ (PROMPT INJECTION) ĐỂ LLM BIẾT GIỜ HIỆN TẠI
    # ---------------------------------------------------------------------
    vn_tz = timezone(timedelta(hours=7))
    now = datetime.now(vn_tz)
    weekdays_vn = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"]
    time_str = now.strftime(f"%H:%M:%S, {weekdays_vn[now.weekday()]}, ngày %d/%m/%Y")
    
    dynamic_system_prompt = REACT_AGENT_SYSTEM_PROMPT + f"\n\n[THÔNG TIN HỆ THỐNG QUAN TRỌNG]\n- Thời gian hiện tại của hệ thống: {time_str}. BẮT BUỘC SỬ DỤNG MỐC THỜI GIAN NÀY làm chuẩn để tính toán giờ xe buýt tới bến (ETA), dự kiến thời gian di chuyển, và để trả lời nếu User hỏi giờ."
    
    current_prompt = user_query
    loop_history = list(chat_history) if chat_history else []

    while step < MAX_ITERATIONS:
        step += 1
        step_start_time = time.time()
        print(f"\n--- 🔄 Vòng lặp ReAct Loop (Step {step}/{MAX_ITERATIONS}) ---")
        
        # Gọi LLM với Native Tool Calling Specs
        try:
            llm_response = provider.generate_with_tools(current_prompt, tools_list, system_prompt=dynamic_system_prompt, chat_history=loop_history)
        except ValueError as e:
            if "Guardrails" in str(e):
                logs.append({"action_type": "THOUGHT", "output": "🛑 [Guardrails]: Phát hiện prompt có dấu hiệu rủi ro, đã tự động chặn request theo chính sách an toàn."})
                logs.append({"type": "chat", "message": "Xin lỗi bạn, tôi là trợ lý ảo của VinBus nên chỉ có thể giải đáp các thông tin về lộ trình, trạm dừng và dịch vụ xe buýt điện. Vui lòng đặt câu hỏi liên quan đến VinBus nhé!", "action_type": "FINAL_ANSWER", "output": "Xin lỗi bạn, tôi là trợ lý ảo của VinBus nên chỉ có thể giải đáp các thông tin về lộ trình, trạm dừng và dịch vụ xe buýt điện. Vui lòng đặt câu hỏi liên quan đến VinBus nhé!"})
                break
            else:
                raise e
        latency_ms = round((time.time() - step_start_time) * 1000, 2)
        
        thought = llm_response.get("thought", "Đang suy luận...")
        print(f"🧠 [Thought]: {thought}")
        
        # Trường hợp 1: LLM quyết định trả lời bằng văn bản trực tiếp
        if llm_response.get("type") == "text":
            final_content = llm_response.get("content", "")
            if not final_content and llm_response.get("reasoning_details"):
                print("⚠️ [Warning]: Content is empty but reasoning is present. Using reasoning as content.")
                final_content = llm_response.get("reasoning_details")
            print(f"🏁 [Final Answer]: {final_content}")
            
            try:
                start_idx = final_content.find('{')
                end_idx = final_content.rfind('}')
                if start_idx != -1 and end_idx != -1:
                    parsed_event = json.loads(final_content[start_idx:end_idx+1])
                    if "type" not in parsed_event:
                        parsed_event["type"] = "chat"
                else:
                    raise ValueError("Not JSON")
            except Exception:
                parsed_event = {"type": "chat", "message": final_content, "action_data": None}
                
            trace_logs.append({
                "step": step,
                "query": user_query,
                "action_type": "FINAL_ANSWER",
                "thought": thought,
                "output": final_content,
                "parsed_output": parsed_event,
                "latency_ms": latency_ms
            })
            break
            
        # Trường hợp 2: LLM đề xuất gọi Tool (Action)
        elif llm_response.get("type") == "tool_call":
            tool_name = llm_response.get("tool_name")
            arguments = llm_response.get("arguments", {})
            
            print(f"🛠️ [Action Proposed]: {tool_name}({arguments})")
            
            # Thực thi Tool qua MCP Server
            mcp_result = mcp_server.call_tool(tool_name, arguments)
            obs_data = mcp_result.get("result", {})
            
            if not obs_data:
                print(f"👁️ [Observation từ MCP Server]: {{}}")
                print(f"⚠️ [CHÚ Ý]: MCP Server trả về kết quả rỗng! Học viên cần hoàn thành TODO 2.1 trong 'src/mcp_server.py'.")
                obs_str = "Error: Không nhận được dữ liệu từ hệ thống."
            else:
                obs_str = json.dumps(obs_data, ensure_ascii=False)
                print(f"👁️ [Observation từ MCP Server]: {obs_str}")
                
            trace_logs.append({
                "step": step,
                "query": user_query,
                "action_type": "TOOL_EXECUTION",
                "tool_name": tool_name,
                "arguments": arguments,
                "observation": obs_data,
                "latency_ms": latency_ms
            })
            
            # Cập nhật loop_history thay vì nối dài chuỗi user_query
            loop_history.append({"role": "user", "content": current_prompt})
            assistant_msg = {"role": "assistant", "content": f"[Action Proposed]: Quyết định gọi tool '{tool_name}' với tham số {json.dumps(arguments, ensure_ascii=False)}"}
            if "reasoning_details" in llm_response and llm_response["reasoning_details"]:
                assistant_msg["reasoning_details"] = llm_response["reasoning_details"]
            loop_history.append(assistant_msg)
            
            # Prompt cho vòng lặp tiếp theo chỉ chứa kết quả Tool
            current_prompt = f"[System Observation]: Bạn vừa gọi tool '{tool_name}' và nhận được kết quả sau:\n{obs_str}\nHãy phân tích kết quả này. Nếu đã đủ thông tin, hãy trả lời người dùng. Nếu chưa, hãy gọi tool tiếp theo."
            
            # Lưu ý: Không break ở đây, để vòng lặp tiếp tục sang step tiếp theo

    return trace_logs


if __name__ == "__main__":
    print("==========================================================")
    print("🏫 VINUNI AI COURSE - DAY 03 LAB: CHATBOT VS REACT AGENT")
    print("==========================================================")
    
    provider = get_llm_provider()
    mcp_server = MCPVinBusServer()
    
    print(f"🔌 LLM Provider: {provider.__class__.__name__}")
    print(f"🌐 MCP Server: {mcp_server.server_name}\n")
    
    tests = load_test_cases()
    print(f"✅ Đã tải thành công {len(tests)} Test Cases thử nghiệm.\n")
    
    if "--interactive" in sys.argv:
        print("🎮 [INTERACTIVE MODE] Trò chuyện trực tiếp với ReAct Agent:")
        print("💡 Gợi ý câu hỏi thử nghiệm:")
        print("   - Câu hỏi chung: 'Trợ lý Vinbus có thể giúp gì cho tôi?'")
        print("   - Tìm đường: 'Tôi đang đứng ở [21.0029, 105.8202] (Ngã Tư Sở), làm sao để bắt xe bus về Phố Biển 19, Vinhomes Ocean Park?'")
        print("   - Tra cứu trạm: 'Trạm VinUni (ID 1234) có xe nào đi qua không?'")
        print("   - Gõ 'exit' hoặc 'quit' để kết thúc phiên trò chuyện.\n")
        global_chat_history = []
        while True:
            try:
                user_input = input("👤 Sinh viên hỏi: ").strip()
                if not user_input or user_input.lower() in ["exit", "quit"]:
                    print("👋 Tạm biệt! Kết thúc phiên trò chuyện.")
                    break
                logs = run_react_agent(user_input, provider, mcp_server, chat_history=global_chat_history)
                save_waterfall_trace(logs)
                
                # Cập nhật lịch sử chat
                global_chat_history.append({"role": "user", "content": user_input})
                final_answer = ""
                for log in logs:
                    if log.get("action_type") == "FINAL_ANSWER":
                        final_answer = log.get("output", "")
                global_chat_history.append({"role": "assistant", "content": final_answer})
                
            except (KeyboardInterrupt, EOFError):
                print("\n👋 Đã thoát phiên tương tác.")
                break
    elif "--all" in sys.argv:
        print("🚀 [TEST SUITE MODE] Kiểm tra 5 Test Cases:")
        completed_count = 0
        todo_count = 0
        all_traces = []
        
        for tc in tests:
            print(f"\n==================================================")
            print(f"🧪 [{tc['id']}] Loại test: {tc['type']} (Độ phức tạp: {tc['complexity']})")
            print(f"📌 Kỳ vọng: {tc['expected_behavior']}")
            
            if tc["question"].strip().startswith("TODO"):
                print(f"⏸️ [CHƯA KÍCH HOẠT - ĐANG LÀ TODO]:")
                print(f"   {tc['question']}")
                print(f"   👉 Hãy mở file 'config/test_cases.json' để viết câu hỏi thực tế cho Test Case này!")
                todo_count += 1
            else:
                logs = run_react_agent(tc["question"], provider, mcp_server)
                all_traces.extend(logs)
                completed_count += 1
                
        print(f"\n==================================================")
        print(f"📊 [KẾT QUẢ TEST SUITE]: Đã thực thi {completed_count}/{len(tests)} Test Cases | {todo_count} Test Cases đang chờ điền câu hỏi (TODO)")
        if all_traces:
            save_waterfall_trace(all_traces)
        print(f"💡 Để trò chuyện trực tiếp từng câu: Chạy 'python src/app.py --interactive'")
    else:
        # Chế độ mặc định khi chỉ gõ 'python src/app.py'
        print("ℹ️ HƯỚNG DẪN SỬ DỤNG CHƯƠNG TRÌNH:")
        print("  1. Chat trực tiếp liên tục:   python src/app.py --interactive")
        print("  2. Chạy toàn bộ Test Cases:    python src/app.py --all\n")
        
        sample_query = tests[1]["question"]
        print(f"--- 🏁 DEMO CHẠY THỬ 1 TEST CASE MẪU (TC02: Tra cứu trạm VinBus) ---")
        logs = run_react_agent(sample_query, provider, mcp_server)
        save_waterfall_trace(logs)
        print("\n💡 Hãy thử ngay lệnh: python src/app.py --interactive để chat trực tiếp!")


def run_react_agent_stream(user_query: str, provider, mcp_server: MCPVinBusServer, chat_history: list = None) -> list:
    """
    [REACT AGENT LOOP] Thực thi vòng lặp Thought -> Action -> Observation với MCP Server
    Trả về danh sách trace log của phiên thực thi.
    """
    print(f"\n🤖 [REACT AGENT] Câu hỏi: {user_query}")
    
    step = 0
    tools_list = mcp_server.list_tools()
    
    # ---------------------------------------------------------------------
    # TIÊM THỜI GIAN THỰC TẾ (PROMPT INJECTION) ĐỂ LLM BIẾT GIỜ HIỆN TẠI
    # ---------------------------------------------------------------------
    vn_tz = timezone(timedelta(hours=7))
    now = datetime.now(vn_tz)
    weekdays_vn = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"]
    time_str = now.strftime(f"%H:%M:%S, {weekdays_vn[now.weekday()]}, ngày %d/%m/%Y")
    
    dynamic_system_prompt = REACT_AGENT_SYSTEM_PROMPT + f"\n\n[THÔNG TIN HỆ THỐNG QUAN TRỌNG]\n- Thời gian hiện tại của hệ thống: {time_str}. BẮT BUỘC SỬ DỤNG MỐC THỜI GIAN NÀY làm chuẩn để tính toán giờ xe buýt tới bến (ETA), dự kiến thời gian di chuyển, và để trả lời nếu User hỏi giờ."
    
    current_prompt = user_query
    loop_history = list(chat_history) if chat_history else []

    while step < MAX_ITERATIONS:
        step += 1
        step_start_time = time.time()
        print(f"\n--- 🔄 Vòng lặp ReAct Loop (Step {step}/{MAX_ITERATIONS}) ---")
        
        # Gọi LLM với Native Tool Calling Specs
        try:
            llm_response = provider.generate_with_tools(current_prompt, tools_list, system_prompt=dynamic_system_prompt, chat_history=loop_history)
        except ValueError as e:
            if "Guardrails" in str(e):
                yield {"action_type": "THOUGHT", "output": "🛑 [Guardrails]: Phát hiện prompt có dấu hiệu rủi ro, đã tự động chặn request theo chính sách an toàn."}
                yield {"type": "chat", "message": "Xin lỗi bạn, tôi là trợ lý ảo của VinBus nên chỉ có thể giải đáp các thông tin về lộ trình, trạm dừng và dịch vụ xe buýt điện. Vui lòng đặt câu hỏi liên quan đến VinBus nhé!", "action_type": "FINAL_ANSWER", "output": "Xin lỗi bạn, tôi là trợ lý ảo của VinBus nên chỉ có thể giải đáp các thông tin về lộ trình, trạm dừng và dịch vụ xe buýt điện. Vui lòng đặt câu hỏi liên quan đến VinBus nhé!"}
                break
            else:
                raise e
        latency_ms = round((time.time() - step_start_time) * 1000, 2)
        
        thought = llm_response.get("thought", "Đang suy luận...")
        print(f"🧠 [Thought]: {thought}")
        
        # Trường hợp 1: LLM quyết định trả lời bằng văn bản trực tiếp
        if llm_response.get("type") == "text":
            final_content = llm_response.get("content", "")
            if not final_content and llm_response.get("reasoning_details"):
                print("⚠️ [Warning]: Content is empty but reasoning is present. Using reasoning as content.")
                final_content = llm_response.get("reasoning_details")
            print(f"🏁 [Final Answer]: {final_content}")
            
            # Cố gắng parse JSON từ final_content
            try:
                # Tìm cặp ngoặc nhọn nếu LLM vô tình bọc text bên ngoài
                start_idx = final_content.find('{')
                end_idx = final_content.rfind('}')
                if start_idx != -1 and end_idx != -1:
                    json_str = final_content[start_idx:end_idx+1]
                    parsed_event = json.loads(json_str)
                    
                    if "type" not in parsed_event:
                        parsed_event["type"] = "chat"
                else:
                    raise ValueError("Không tìm thấy JSON object")
            except Exception as e:
                print(f"⚠️ [Fallback]: Không thể parse JSON từ LLM ({e}), trả về dạng text.")
                parsed_event = {
                    "type": "chat",
                    "message": final_content,
                    "action_data": None
                }
            
            # Gắn thêm Metadata cho Trace Log UI
            if isinstance(parsed_event.get("message"), dict) or isinstance(parsed_event.get("message"), list):
                import json
                parsed_event["message"] = json.dumps(parsed_event["message"], ensure_ascii=False)
            elif not isinstance(parsed_event.get("message"), str):
                parsed_event["message"] = str(parsed_event.get("message", final_content))

            parsed_event.update({
                "action_type": "FINAL_ANSWER",
                "thought": thought,
                "output": final_content,
                "latency_ms": latency_ms
            })
            yield parsed_event
            break
            
        # Trường hợp 2: LLM đề xuất gọi Tool (Action)
        elif llm_response.get("type") == "tool_call":
            tool_name = llm_response.get("tool_name")
            arguments = llm_response.get("arguments", {})
            
            print(f"🛠️ [Action Proposed]: {tool_name}({arguments})")
            
            # Thực thi Tool qua MCP Server
            mcp_result = mcp_server.call_tool(tool_name, arguments)
            obs_data = mcp_result.get("result", {})
            
            if not obs_data:
                print(f"👁️ [Observation từ MCP Server]: {{}}")
                print(f"⚠️ [CHÚ Ý]: MCP Server trả về kết quả rỗng! Học viên cần hoàn thành TODO 2.1 trong 'src/mcp_server.py'.")
                obs_str = "Error: Không nhận được dữ liệu từ hệ thống."
            else:
                obs_str = json.dumps(obs_data, ensure_ascii=False)
                print(f"👁️ [Observation từ MCP Server]: {obs_str}")
            
            # STREAM RA FRONTEND: Vừa làm UI Event, vừa làm Trace Log
            yield {
                "type": "thought",
                "message": f"🧠 {thought}",
                "tool_called": tool_name,
                "action_type": "TOOL_EXECUTION",
                "tool_name": tool_name,
                "arguments": arguments,
                "observation": obs_data,
                "thought": thought,
                "latency_ms": latency_ms
            }
            
            # Cập nhật loop_history thay vì nối dài chuỗi user_query
            loop_history.append({"role": "user", "content": current_prompt})
            assistant_msg = {"role": "assistant", "content": f"[Action Proposed]: Quyết định gọi tool '{tool_name}' với tham số {json.dumps(arguments, ensure_ascii=False)}"}
            if "reasoning_details" in llm_response and llm_response["reasoning_details"]:
                assistant_msg["reasoning_details"] = llm_response["reasoning_details"]
            loop_history.append(assistant_msg)
            
            # Prompt cho vòng lặp tiếp theo chỉ chứa kết quả Tool
            current_prompt = f"[System Observation]: Bạn vừa gọi tool '{tool_name}' và nhận được kết quả sau:\n{obs_str}\nHãy phân tích kết quả này. Nếu đã đủ thông tin, hãy trả lời người dùng. Nếu chưa, hãy gọi tool tiếp theo."
            
            # Lưu ý: Không break ở đây, để vòng lặp tiếp tục sang step tiếp theo


    