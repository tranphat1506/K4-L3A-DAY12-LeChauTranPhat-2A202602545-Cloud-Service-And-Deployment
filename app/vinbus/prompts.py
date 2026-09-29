"""
🧠 PROMPTS & INSTRUCTION SPECIFICATION
Định nghĩa System Prompts cho Chatbot Baseline (Cấp 2) và ReAct Agent System (Cấp 3).
"""

import os

ARTIFACTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts")
MAX_ITERATIONS = 10

def _load_prompt(filename: str) -> str:
    path = os.path.join(ARTIFACTS_DIR, filename)
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read().strip()
    except Exception as e:
        print(f"⚠️ Lỗi đọc file prompt {filename}: {e}")
        return ""

CHATBOT_BASELINE_PROMPT = _load_prompt("chatbot_baseline.md")
REACT_AGENT_SYSTEM_PROMPT = _load_prompt("react_system_prompt.md")
