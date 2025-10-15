from dataclasses import dataclass
import os
from urllib.parse import urlparse


@dataclass(frozen=True)
class Config:
    """Class representing the endpoint configuration. Each field relates to a setting from the .env file. AI was used to suggest the update channel
       and log level

    Attributes:
    endpoint_id (str) Unique identity for this endpoint
    WLAN_iface (str) Interface used to capture WI-Fi data
    server_URL (str) The URL of the server
    api_key (str) Authentication token used to send data to the server
    log_level (str) (DEBUG, INFO, ERROR) Defaults to INFO. Selects which type of data to capture in the config logs
    update_channel (str) Channel used to send updates from the server to the endpoint. Defaults to stable
    heartbeat_sec (int) Intervals between heartbeat messages. Defaults to 30 sec
    batch_max (int) Maximum number of log records to send during the boot process
    batch_interval (int) Maximum time to wait before sending a batch. Defaults to 5 sec
    """

    endpoint_id: str
    WLAN_iface: str
    server_URL: str
    api_key: str
    log_level: str = "INFO"
    update_channel: str = "stable"
    heartbeat_sec: int = 30
    batch_max: int = 200
    batch_interval: int = 5


def _as_int(name: str, value, default: int) -> int:
    """Helper function that will convert values within the .env file from a string to an integer. AI pointed out that this was needed to properly
        read the .env file.

    Args:
        name (str): The name of the key within the config file. Primarily for error messages
        value (str or None): The value from the .env file
        default (int): The default int value if one is not provided in the .env file

    Raises:
        ValueError: If the value is not None and cannot be converted to an integer

    Returns:
        int: integer representation of values within the .env file
    """
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        raise ValueError(f"{name} must be an integer, got {value!r}")


def _validate_https(url: str):
    """Helper function that will validate the URL is formatted correctly and uses HTTPS. ChatGPT helped create this since I am unfamiliar with urlparse

    Args:
        url (str): The URL string from the config file (SERVER_URL)

    Raises:
        ValueError: If the URL is missing, does not include a host, or does not follow HTTPS
    """
    p = urlparse(url)
    if p.scheme != "https" or not p.netloc:
        raise ValueError("SERVER_URL must be a valid https URL")


def load_config() -> Config:
    """Function that initializes the configuration of the endpoint.

    Raises:
        ValueError: If an essential variable is missing from the .env file

    Returns:
        Config: Configuration object
    """
    c = Config(
        endpoint_id=os.getenv("ENDPOINT_ID"),
        WLAN_iface=os.getenv("WLAN_IFACE"),
        server_URL=os.getenv("SERVER_URL"),
        api_key=os.getenv("API_KEY"),
        log_level=os.getenv("LOG_LEVEL", "INFO"),
        update_channel=os.getenv("UPDATE_CHANNEL", "stable"),
        heartbeat_sec=_as_int("HEARTBEAT_SEC", os.getenv("HEARTBEAT_SEC"), 30),
        batch_max=_as_int("BATCH_MAX", os.getenv("BATCH_MAX"), 200),
        batch_interval=_as_int(
            "BATCH_INTERVAL_SEC", os.getenv("BATCH_INTERVAL_SEC"), 5
        ),
    )

    # Requirement check
    required = {
        "ENDPOINT_ID": c.endpoint_id,
        "WLAN_IFACE": c.WLAN_iface,
        "SERVER_URL": c.server_URL,
        "API_KEY": c.api_key,
    }

    missing = []

    # Loop will identify any missing essential fields from the .env file
    for key, value in required.items():
        if not value:
            missing.append(key)

    if missing:
        raise ValueError(f"Missing required settings: {', '.join(missing)}")

    _validate_https(c.server_URL)
    return c
