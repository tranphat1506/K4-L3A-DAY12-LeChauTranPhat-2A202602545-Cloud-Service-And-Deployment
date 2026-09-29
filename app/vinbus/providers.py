from abc import ABC, abstractmethod
"""
🔌 MULTI-PROVIDER LLM ADAPTER (Google Gemini, OpenAI & Offline Mock)
Hỗ trợ Native Tool Calling và chuyển đổi linh hoạt qua biến môi trường LLM_PROVIDER.
"""

import os
import sys
import json
from typing import Dict, Any, List
from dotenv import load_dotenv

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

load_dotenv()

class BaseLLMProvider(ABC):
    """Lớp trừu tượng cho các LLM Providers"""
    
    @abstractmethod
    def generate(self, prompt: str, system_prompt: str = "") -> str:
        pass

    @abstractmethod
    def generate_with_tools(self, prompt: str, tools_schema: List[Dict[str, Any]], system_prompt: str = "", chat_history: List[Dict[str, str]] = None) -> Dict[str, Any]:
        """Thực thi suy luận có gọi Tool. Trả về dict chứa type ('text' hoặc 'tool_call') và dữ liệu tương ứng."""
        pass


class MockOfflineProvider(BaseLLMProvider):
    """Offline Mock Provider dùng để chạy thử mà không tốn API Key"""
    def __init__(self):
        self.model_name = "Offline-Mock-Model-2026"

    def generate(self, prompt: str, system_prompt: str = "") -> str:
        return f"[Mock VinBus Agent]: Xin chào! Tôi đã nhận được câu hỏi '{prompt}'. (Chế độ Mock Offline không thể gọi API thật)."

    def generate_with_tools(self, prompt: str, tools_schema: List[Dict[str, Any]], system_prompt: str = "", chat_history: List[Dict[str, str]] = None) -> Dict[str, Any]:
        prompt_lower = prompt.lower()
        
        # Mô phỏng nhận diện intent gọi Tool
        if "vinuni" in prompt_lower or "1234" in prompt_lower:
            return {
                "type": "tool_call",
                "tool_name": "get_station_detail",
                "arguments": {"station_id": 1234, "region_code": "hn"},
                "thought": "Người dùng muốn tra cứu thông tin trạm xe buýt VinUni. Tôi sẽ gọi tool get_station_detail."
            }
        elif "ngã tư sở" in prompt_lower or "s2.05" in prompt_lower or "phố biển 19" in prompt_lower:
            return {
                "type": "tool_call",
                "tool_name": "geocoding_search",
                "arguments": {"region_code": "hn", "content": "Ngã tư Sở"},
                "thought": "Người dùng cung cấp địa danh, tôi cần gọi geocoding_search để lấy toạ độ."
            }
        elif "999999" in prompt_lower:
            return {
                "type": "tool_call",
                "tool_name": "get_eta",
                "arguments": {"station_id": 999999, "region_code": "hn"},
                "thought": "Tra cứu ETA cho trạm 999999."
            }
        else:
            return {
                "type": "text",
                "content": f"[Mock VinBus Agent]: Chào bạn! Hệ thống xe buýt điện VinBus (Mock) hiện tại đang chạy mượt mà. Vui lòng cung cấp mã trạm hoặc tên địa điểm để tôi tra cứu nhé.",
                "thought": "Câu hỏi chung chung, trả lời trực tiếp."
            }


class GeminiProvider(BaseLLMProvider):
    """Google Gemini Provider (Native Tool Calling với Google GenAI SDK)"""
    def __init__(self, api_key: str = None, model: str = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model_name = model or os.getenv("LLM_MODEL") or "gemini-2.5-flash"

    def generate(self, prompt: str, system_prompt: str = "") -> str:
        if not self.api_key or self.api_key == "your_gemini_api_key_here":
            return "[Gemini Error]: Chưa cấu hình GEMINI_API_KEY trong file .env! Đang sử dụng chế độ Mock."
        try:
            from google import genai
            client = genai.Client(api_key=self.api_key)
            contents = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
            response = client.models.generate_content(model=self.model_name, contents=contents)
            return response.text
        except Exception as e:
            return f"[Gemini Exception]: {str(e)}"

    def generate_with_tools(self, prompt: str, tools_schema: List[Dict[str, Any]], system_prompt: str = "", chat_history: List[Dict[str, str]] = None) -> Dict[str, Any]:
        if not self.api_key or self.api_key == "your_gemini_api_key_here":
            print("ℹ️ [Gemini Provider]: Chưa tìm thấy GEMINI_API_KEY hợp lệ. Tự động chuyển sang Mock Offline.")
            return MockOfflineProvider().generate_with_tools(prompt, tools_schema, system_prompt, chat_history)
        
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=self.api_key)
            
            # Chuẩn hóa function declarations cho Gemini SDK
            function_declarations = []
            for tool in tools_schema:
                # Bỏ qua các tool schema chưa được định nghĩa hoàn chỉnh
                if not tool.get("name") or not tool.get("parameters"):
                    continue
                function_declarations.append({
                    "name": tool["name"],
                    "description": tool.get("description", ""),
                    "parameters": tool.get("parameters", {})
                })

            config = types.GenerateContentConfig(
                system_instruction=system_prompt if system_prompt else None,
                tools=[{"function_declarations": function_declarations}] if function_declarations else None,
                temperature=0.2
            )

            # Chuyển đổi chat_history sang định dạng Gemini Content
            contents = []
            if chat_history:
                for msg in chat_history:
                    # Chuyển "assistant" thành "model" cho Gemini
                    role = "model" if msg["role"] == "assistant" else "user"
                    contents.append(types.Content(role=role, parts=[types.Part.from_text(text=msg["content"])]))
            # Thêm prompt hiện tại
            contents.append(types.Content(role="user", parts=[types.Part.from_text(text=prompt)]))

            response = client.models.generate_content(
                model=self.model_name,
                contents=contents,
                config=config
            )

            # Kiểm tra xem Gemini có trả về Tool Call không
            if response.function_calls:
                call = response.function_calls[0]
                args = dict(call.args) if hasattr(call, 'args') and call.args else {}
                return {
                    "type": "tool_call",
                    "tool_name": call.name,
                    "arguments": args,
                    "thought": f"Gemini quyết định gọi công cụ '{call.name}' với tham số: {json.dumps(args, ensure_ascii=False)}"
                }
            else:
                return {
                    "type": "text",
                    "content": response.text or "",
                    "thought": "Gemini phản hồi trực tiếp bằng văn bản (không cần gọi công cụ)."
                }

        except Exception as e:
            print(f"⚠️ [Gemini API Warning]: Không thể kết nối live API ({str(e)}). Tự động fallback về Mock.")
            return MockOfflineProvider().generate_with_tools(prompt, tools_schema, system_prompt, chat_history)


class OpenAIProvider(BaseLLMProvider):
    """OpenAI Provider (Native Tool Calling với OpenAI SDK)"""
    def __init__(self, api_key: str = None, model: str = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.model_name = model or os.getenv("LLM_MODEL") or "gpt-4o-mini"

    def generate(self, prompt: str, system_prompt: str = "") -> str:
        if not self.api_key or self.api_key == "your_openai_api_key_here":
            return "[OpenAI Error]: Chưa cấu hình OPENAI_API_KEY trong file .env! Đang sử dụng chế độ Mock."
        try:
            from openai import OpenAI
            client = OpenAI(api_key=self.api_key)
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            if chat_history:
                messages.extend(chat_history)
            messages.append({"role": "user", "content": prompt})
            response = client.chat.completions.create(model=self.model_name, messages=messages)
            return response.choices[0].message.content or ""
        except Exception as e:
            return f"[OpenAI Exception]: {str(e)}"

    def generate_with_tools(self, prompt: str, tools_schema: List[Dict[str, Any]], system_prompt: str = "", chat_history: List[Dict[str, str]] = None) -> Dict[str, Any]:
        if not self.api_key or self.api_key == "your_openai_api_key_here":
            print("ℹ️ [OpenAI Provider]: Chưa tìm thấy OPENAI_API_KEY hợp lệ. Tự động chuyển sang Mock Offline.")
            return MockOfflineProvider().generate_with_tools(prompt, tools_schema, system_prompt, chat_history)

        try:
            from openai import OpenAI
            client = OpenAI(api_key=self.api_key)

            tools = []
            for tool in tools_schema:
                if not tool.get("name"):
                    continue
                tools.append({
                    "type": "function",
                    "function": {
                        "name": tool["name"],
                        "description": tool.get("description", ""),
                        "parameters": tool.get("parameters", {})
                    }
                })

            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            if chat_history:
                messages.extend(chat_history)
            messages.append({"role": "user", "content": prompt})

            response = client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                tools=tools if tools else None,
                tool_choice="auto" if tools else None
            )

            msg = response.choices[0].message
            if msg.tool_calls:
                call = msg.tool_calls[0]
                args = json.loads(call.function.arguments) if call.function.arguments else {}
                return {
                    "type": "tool_call",
                    "tool_name": call.function.name,
                    "arguments": args,
                    "thought": f"OpenAI quyết định gọi công cụ '{call.function.name}' với tham số: {json.dumps(args, ensure_ascii=False)}"
                }
            else:
                return {
                    "type": "text",
                    "content": msg.content or "",
                    "thought": "OpenAI phản hồi trực tiếp bằng văn bản (không cần gọi công cụ)."
                }
        except Exception as e:
            print(f"⚠️ [OpenAI API Warning]: Không thể kết nối live API ({str(e)}). Tự động fallback về Mock.")
            return MockOfflineProvider().generate_with_tools(prompt, tools_schema, system_prompt, chat_history)



class OpenRouterProvider(BaseLLMProvider):
    """OpenRouter Provider (sử dụng OpenAI SDK nhưng đổi base_url, hỗ trợ reasoning)"""
    def __init__(self, api_key: str = None, model: str = None):
        import os
        self.api_key = api_key or os.getenv("OPENROUTER_API_KEY")
        self.model_name = model or os.getenv("LLM_MODEL") or "google/gemma-4-26b-a4b-it:free"

    def generate(self, prompt: str, system_prompt: str = "") -> str:
        if not self.api_key or self.api_key == "your_openrouter_api_key_here":
            return "[OpenRouter Error]: Chưa cấu hình OPENROUTER_API_KEY trong file .env! Đang sử dụng chế độ Mock."
        try:
            from openai import OpenAI
            client = OpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=self.api_key,
            )
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})
            response = client.chat.completions.create(
                model=self.model_name, 
                messages=messages,
                extra_body={"reasoning": {"enabled": True}}
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            return f"[OpenRouter Exception]: {str(e)}"

    def generate_with_tools(self, prompt: str, tools_schema: list, system_prompt: str = "", chat_history: list = None) -> dict:
        import os, json
        if not self.api_key or self.api_key == "your_openrouter_api_key_here":
            print("ℹ️ [OpenRouter Provider]: Chưa tìm thấy OPENROUTER_API_KEY hợp lệ. Tự động chuyển sang Mock Offline.")
            return MockOfflineProvider().generate_with_tools(prompt, tools_schema, system_prompt, chat_history)

        try:
            from openai import OpenAI
            client = OpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=self.api_key,
            )

            tools = []
            for tool in tools_schema:
                if not tool.get("name"):
                    continue
                tools.append({
                    "type": "function",
                    "function": {
                        "name": tool["name"],
                        "description": tool.get("description", ""),
                        "parameters": tool.get("parameters", {})
                    }
                })

            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            
            if chat_history:
                # Cần pass back reasoning_details nếu có trong history (nếu app lưu lại)
                for msg in chat_history:
                    m = {"role": msg["role"], "content": msg["content"]}
                    if "reasoning_details" in msg and msg["reasoning_details"]:
                        m["reasoning_details"] = msg["reasoning_details"]
                    messages.append(m)
                    
            messages.append({"role": "user", "content": prompt})

            response = client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                tools=tools if tools else None,
                tool_choice="auto" if tools else None,
                extra_body={"reasoning": {"enabled": True}}
            )

            msg = response.choices[0].message
            
            # Lấy reasoning nếu có
            reasoning_text = ""
            if hasattr(msg, "reasoning_details") and msg.reasoning_details:
                reasoning_text = f" (Reasoning details included)"

            if msg.tool_calls:
                call = msg.tool_calls[0]
                args = json.loads(call.function.arguments) if call.function.arguments else {}
                return {
                    "type": "tool_call",
                    "tool_name": call.function.name,
                    "arguments": args,
                    "thought": f"OpenRouter quyết định gọi công cụ '{call.function.name}' với tham số: {json.dumps(args, ensure_ascii=False)}{reasoning_text}",
                    "reasoning_details": msg.reasoning_details if hasattr(msg, "reasoning_details") else None
                }
            else:
                return {
                    "type": "text",
                    "content": msg.content or "",
                    "thought": f"OpenRouter phản hồi trực tiếp bằng văn bản (không cần gọi công cụ).{reasoning_text}",
                    "reasoning_details": msg.reasoning_details if hasattr(msg, "reasoning_details") else None
                }
        except Exception as e:
            err_msg = str(e).lower()
            if "403" in err_msg and ("blocked" in err_msg or "injection" in err_msg or "safety" in err_msg):
                raise ValueError("OpenRouter Guardrails Blocked: " + str(e))
            print(f"⚠️ [OpenRouter API Warning]: Không thể kết nối live API ({str(e)}). Tự động fallback về Mock.")
            return MockOfflineProvider().generate_with_tools(prompt, tools_schema, system_prompt, chat_history)



def get_llm_provider() -> BaseLLMProvider:
    """Factory function khởi tạo Provider theo LLM_PROVIDER env variable"""
    provider_type = os.getenv("LLM_PROVIDER", "gemini").lower()
    
    if provider_type == "gemini":
        key = os.getenv("GEMINI_API_KEY")
        if key and key != "your_gemini_api_key_here":
            return GeminiProvider()
        else:
            return MockOfflineProvider()
    elif provider_type == "openrouter":
        key = os.getenv("OPENROUTER_API_KEY")
        if key and key != "your_openrouter_api_key_here":
            return OpenRouterProvider()
        else:
            return MockOfflineProvider()
    elif provider_type == "openai":
        key = os.getenv("OPENAI_API_KEY")
        if key and key != "your_openai_api_key_here":
            return OpenAIProvider()
        else:
            return MockOfflineProvider()
    elif provider_type == "mock":
        return MockOfflineProvider()
    else:
        return MockOfflineProvider()
