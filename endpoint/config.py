from dataclasses import dataclass
import os
from urllib.parse import urlparse
from dotenv import load_dotenv

load_dotenv()  # take environment variables from .env file


@dataclass(frozen=True)
class Config:
    """Endpoint configuration loaded from environment variables (.env).

    Attributes:
        endpoint_id (str): Unique identity for this endpoint.
        wlan_iface (str): Interface used to capture Wi-Fi data (e.g., wlan1).
        server_url (str): The ingest URL of the server. HTTPS required unless ALLOW_INSECURE_HTTP=true.
        api_key (str): Authentication token used to send data to the server.
        log_level (str): One of {DEBUG, INFO, WARNING, ERROR, CRITICAL}. Defaults to INFO.
        update_channel (str): Update channel for server→endpoint updates. Defaults to 'stable'.
        heartbeat_sec (int): Interval between heartbeat messages (seconds). Defaults to 30.
        batch_max (int): Max number of log records per batch. Defaults to 200.
        batch_interval (int): Max seconds to wait before sending a batch. Defaults to 5.
    """

    endpoint_id: str
    wlan_iface: str
    server_url: str
    api_key: str
    log_level: str = "INFO"
    update_channel: str = "stable"
    heartbeat_sec: int = 30
    batch_max: int = 200
    batch_interval: int = 5


def _require(env_name: str) -> str:
    val = os.getenv(env_name, "").strip()
    if not val:
        raise ValueError(f"Missing required setting: {env_name}")
    return val


def _as_int(name: str, value, default: int) -> int:
    """Convert a string env value to int, or use default."""
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        raise ValueError(f"{name} must be an integer, got {value!r}")


def _is_truthy(s: str | None) -> bool:
    """Interpret common true-ish strings as True."""
    return str(s or "").strip().lower() in {"1", "true", "yes", "on"}


def _validate_url(url: str, allow_insecure_http: bool):
    """Validate that the URL has a scheme+host and (unless allowed) uses HTTPS."""
    p = urlparse(url)
    if not p.scheme or not p.netloc:
        raise ValueError("SERVER_URL must be a valid URL with scheme and host")
    if not allow_insecure_http and p.scheme != "https":
        raise ValueError("SERVER_URL must use https unless ALLOW_INSECURE_HTTP=true")


def load_config() -> Config:
    """Initialize and validate configuration from environment variables."""
    # Required values
    endpoint_id = _require("ENDPOINT_ID")
    wlan_iface = _require("WLAN_IFACE")
    server_url = _require("SERVER_URL")
    api_key = _require("API_KEY")

    # Toggle: allow HTTP (insecure) for local/dev if ALLOW_INSECURE_HTTP=true
    allow_insecure_http = _is_truthy(os.getenv("ALLOW_INSECURE_HTTP"))
    _validate_url(server_url, allow_insecure_http)

    # Optional values
    log_level = os.getenv("LOG_LEVEL", "INFO").strip().upper()
    update_channel = os.getenv("UPDATE_CHANNEL", "stable").strip()
    heartbeat_sec = _as_int("HEARTBEAT_SEC", os.getenv("HEARTBEAT_SEC"), 30)
    batch_max = _as_int("BATCH_MAX", os.getenv("BATCH_MAX"), 200)
    batch_interval = _as_int("BATCH_INTERVAL_SEC", os.getenv("BATCH_INTERVAL_SEC"), 5)

    # Validate log level
    valid_levels = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
    if log_level not in valid_levels:
        raise ValueError(f"LOG_LEVEL must be one of {valid_levels}, got {log_level!r}")

    # Return a validated, immutable Config instance
    return Config(
        endpoint_id=endpoint_id,
        wlan_iface=wlan_iface,
        server_url=server_url,
        api_key=api_key,
        log_level=log_level,
        update_channel=update_channel,
        heartbeat_sec=heartbeat_sec,
        batch_max=batch_max,
        batch_interval=batch_interval,
    )
