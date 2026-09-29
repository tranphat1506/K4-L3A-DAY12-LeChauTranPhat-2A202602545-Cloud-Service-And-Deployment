import os
import json
import requests
from dotenv import load_dotenv
from typing import Any, Union
from Crypto.Cipher import AES
from Crypto.Util.Padding import unpad
from .exceptions import DecryptionError, VinbusError

load_dotenv()

def get_secret_key() -> bytes:
    """
    1. Ưu tiên lấy từ biến môi trường (.env).
    2. Fallback qua HTTP GET tới API của VinBus.
    Nếu cả 2 đều thất bại -> Throw error.
    """
    # 1. Lấy từ biến môi trường
    env_key = os.environ.get("VINBUS_SECRET_KEY")
    if env_key:
        return env_key.encode('utf-8')
    
    # 2. Fallback qua HTTP GET
    # Lưu ý: Cần cấu hình VINBUS_SECRET_KEY_URL trong .env trỏ tới API lấy key thực tế.
    key_url = os.environ.get("VINBUS_SECRET_KEY_URL")
    if not key_url:
        raise VinbusError("Không thể lấy Secret Key: VINBUS_SECRET_KEY và VINBUS_SECRET_KEY_URL đều không được cấu hình.")

    try:
        response = requests.get(key_url, timeout=5)
        if response.ok and response.text.strip():
            # Xoá dấu nháy kép thừa nếu server trả về dạng string JSON (ví dụ: "ViNbus2o21...")
            raw_key = response.text.strip().strip('"')
            return raw_key.encode('utf-8')
    except Exception as e:
        raise VinbusError(f"Lỗi khi gọi HTTP GET tới API Secret Key: {e}") from e
        
    # Nếu HTTP GET thành công nhưng không thoả mãn response.ok (vd: 404, 500)
    raise VinbusError(f"Không thể lấy Secret Key. HTTP GET trả về mã lỗi: {response.status_code}")


def decrypt_payload(encrypted_hex: str, secret_key: Union[str, bytes, None] = None) -> Any:
    """
    Giải mã payload Hex (AES-256-CBC) trả về từ API VinBus.
    """
    if not secret_key:
        secret_key = get_secret_key()
        
    if not encrypted_hex:
        return None

    try:
        encrypted_bytes = bytes.fromhex(encrypted_hex)
        iv = encrypted_bytes[:16]
        ciphertext = encrypted_bytes[16:]
        
        key_bytes = secret_key.encode('utf-8') if isinstance(secret_key, str) else secret_key
            
        cipher = AES.new(key_bytes, AES.MODE_CBC, iv)
        decrypted_padded = cipher.decrypt(ciphertext)
        decrypted_bytes = unpad(decrypted_padded, AES.block_size)
        
        decrypted_text = decrypted_bytes.decode('utf-8')
        
        try:
            return json.loads(decrypted_text)
        except json.JSONDecodeError:
            return decrypted_text
            
    except Exception as e:
        raise DecryptionError(f"Không thể giải mã dữ liệu VinBus: {str(e)}") from e
