class VinbusError(Exception):
    """Lớp exception gốc cho Vinbus API."""
    pass

class DecryptionError(VinbusError):
    """Lỗi khi giải mã payload từ API."""
    pass

class APIRequestError(VinbusError):
    """Lỗi khi gọi API (HTTP lỗi, timeout, v.v.)."""
    def __init__(self, message: str, status_code: int = None):
        super().__init__(message)
        self.status_code = status_code
