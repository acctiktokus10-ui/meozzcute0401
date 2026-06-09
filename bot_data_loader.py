"""
bot_data_loader.py
──────────────────────────────────────────────────────────────────
Thay thế _load_donhang() và _load_vitien() trong bot để fetch
dữ liệu từ Vercel thay vì đọc file JSON local.

Cách dùng:
  Thay đầu file bot_v23.py:
    _DONHANG_DATA = _load_donhang("donhang_by_subid.json")
    _VITIEN_DATA  = _load_vitien("vitien_by_subid.json")

  Thành:
    from bot_data_loader import load_donhang_remote, load_vitien_remote
    _DONHANG_DATA = load_donhang_remote()
    _VITIEN_DATA  = load_vitien_remote()

  Và trong hàm _handle_command, thêm reload mỗi lần nhận lệnh:
    # Trước khi xử lý #donhang / #vitien
    from bot_data_loader import load_donhang_remote, load_vitien_remote
    global _DONHANG_DATA, _VITIEN_DATA
    _DONHANG_DATA = load_donhang_remote()   # reload mới nhất
    _VITIEN_DATA  = load_vitien_remote()    # reload mới nhất
──────────────────────────────────────────────────────────────────
"""

import json
import logging
import urllib.request

log = logging.getLogger(__name__)

# ── CẤU HÌNH ────────────────────────────────────────────────────
# Điền URL Vercel của bạn vào đây (không có dấu / cuối)
VERCEL_BASE_URL = "https://meozzcute0401.vercel.app"
# ────────────────────────────────────────────────────────────────

_CACHE: dict = {}


def _fetch_json(url: str, timeout: int = 10) -> dict:
    """Fetch JSON từ URL, raise nếu lỗi."""
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "ZaloBot/1.0", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw)


def load_donhang_remote(fallback_path: str = "donhang_by_subid.json") -> dict:
    """
    Fetch donhang_by_subid từ Vercel.
    Nếu lỗi, fallback đọc file local (nếu có).
    """
    url = f"{VERCEL_BASE_URL}/api/data/donhang"
    try:
        data = _fetch_json(url)
        _CACHE["donhang"] = data
        log.info(f"📦 [Remote] Đã tải {len(data)} sub_id đơn hàng từ {url}")
        return data
    except Exception as e:
        log.warning(f"⚠️ Không lấy được donhang từ Vercel ({e}), thử đọc file local...")
        try:
            with open(fallback_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            log.info(f"📦 [Local fallback] Đọc {len(data)} sub_id từ {fallback_path}")
            return data
        except FileNotFoundError:
            log.warning(f"⚠️ Không tìm thấy {fallback_path} — trả về dữ liệu rỗng")
            return _CACHE.get("donhang", {})


def load_vitien_remote(fallback_path: str = "vitien_by_subid.json") -> dict:
    """
    Fetch vitien_by_subid từ Vercel.
    Nếu lỗi, fallback đọc file local (nếu có).
    """
    url = f"{VERCEL_BASE_URL}/api/data/vitien"
    try:
        data = _fetch_json(url)
        _CACHE["vitien"] = data
        log.info(f"💳 [Remote] Đã tải {len(data)} sub_id ví tiền từ {url}")
        return data
    except Exception as e:
        log.warning(f"⚠️ Không lấy được vitien từ Vercel ({e}), thử đọc file local...")
        try:
            with open(fallback_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            log.info(f"💳 [Local fallback] Đọc {len(data)} sub_id từ {fallback_path}")
            return data
        except FileNotFoundError:
            log.warning(f"⚠️ Không tìm thấy {fallback_path} — trả về dữ liệu rỗng")
            return _CACHE.get("vitien", {})
