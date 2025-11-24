# endpoint/tests/test_config.py
"""
Automated black-box tests for config.py (load_config and helpers).

Each test references a Test Case ID (TC-CFG-###) for traceability in the
test report and traceability matrix.
"""

import sys
from pathlib import Path

import pytest

# --- Ensure endpoint directory (where config.py lives) is on sys.path ---
ENDPOINT_DIR = Path(__file__).resolve().parents[1]
if str(ENDPOINT_DIR) not in sys.path:
    sys.path.insert(0, str(ENDPOINT_DIR))

import config  # noqa: E402


# Helper: minimal valid env for load_config
def _set_min_env(monkeypatch):
    monkeypatch.setenv("ENDPOINT_ID", "ep-test")
    monkeypatch.setenv("WLAN_IFACE", "wlan1")
    monkeypatch.setenv("SERVER_URL", "https://example.com")
    monkeypatch.setenv("API_KEY", "TEST_KEY")


# TC-CFG-001: load_config returns Config with defaults when optional envs unset
def test_load_config_minimal_env(monkeypatch):
    # Clear any existing relevant env
    for key in [
        "ENDPOINT_ID",
        "WLAN_IFACE",
        "SERVER_URL",
        "API_KEY",
        "LOG_LEVEL",
        "UPDATE_CHANNEL",
        "HEARTBEAT_SEC",
        "BATCH_MAX",
        "BATCH_INTERVAL_SEC",
        "ALLOW_INSECURE_HTTP",
    ]:
        monkeypatch.delenv(key, raising=False)

    _set_min_env(monkeypatch)

    cfg = config.load_config()

    assert isinstance(cfg, config.Config)
    assert cfg.endpoint_id == "ep-test"
    assert cfg.wlan_iface == "wlan1"
    assert cfg.server_url == "https://example.com"
    assert cfg.api_key == "TEST_KEY"

    # Defaults
    assert cfg.log_level == "INFO"
    assert cfg.update_channel == "stable"
    assert cfg.heartbeat_sec == 30
    assert cfg.batch_max == 200
    assert cfg.batch_interval == 5


# TC-CFG-002: load_config respects optional overrides for ints and log_level
def test_load_config_respects_overrides(monkeypatch):
    _set_min_env(monkeypatch)
    monkeypatch.setenv("LOG_LEVEL", "debug")          # lower-case, should upper-case
    monkeypatch.setenv("UPDATE_CHANNEL", "beta")
    monkeypatch.setenv("HEARTBEAT_SEC", "45")
    monkeypatch.setenv("BATCH_MAX", "500")
    monkeypatch.setenv("BATCH_INTERVAL_SEC", "10")

    cfg = config.load_config()

    assert cfg.log_level == "DEBUG"
    assert cfg.update_channel == "beta"
    assert cfg.heartbeat_sec == 45
    assert cfg.batch_max == 500
    assert cfg.batch_interval == 10


# TC-CFG-003: load_config fails when required env var is missing
@pytest.mark.parametrize("missing_var", ["ENDPOINT_ID", "WLAN_IFACE", "SERVER_URL", "API_KEY"])
def test_load_config_missing_required(monkeypatch, missing_var):
    _set_min_env(monkeypatch)
    monkeypatch.delenv(missing_var, raising=False)

    with pytest.raises(ValueError) as excinfo:
        config.load_config()

    assert "Missing required setting" in str(excinfo.value)


# TC-CFG-004: load_config enforces HTTPS unless ALLOW_INSECURE_HTTP is true
def test_load_config_rejects_http_without_allow_insecure(monkeypatch):
    _set_min_env(monkeypatch)
    monkeypatch.setenv("SERVER_URL", "http://example.com")
    monkeypatch.delenv("ALLOW_INSECURE_HTTP", raising=False)

    with pytest.raises(ValueError) as excinfo:
        config.load_config()

    # Should complain about https requirement
    assert "https" in str(excinfo.value)


def test_load_config_allows_http_when_flag_true(monkeypatch):
    _set_min_env(monkeypatch)
    monkeypatch.setenv("SERVER_URL", "http://example.com")
    monkeypatch.setenv("ALLOW_INSECURE_HTTP", "true")

    cfg = config.load_config()
    assert cfg.server_url == "http://example.com"


# TC-CFG-005: load_config validates SERVER_URL structure
def test_load_config_invalid_server_url(monkeypatch):
    _set_min_env(monkeypatch)
    monkeypatch.setenv("SERVER_URL", "not-a-url")

    with pytest.raises(ValueError) as excinfo:
        config.load_config()

    assert "valid URL" in str(excinfo.value)


# TC-CFG-006: load_config rejects invalid LOG_LEVEL values
def test_load_config_invalid_log_level(monkeypatch):
    _set_min_env(monkeypatch)
    monkeypatch.setenv("LOG_LEVEL", "NOPE")

    with pytest.raises(ValueError) as excinfo:
        config.load_config()

    assert "LOG_LEVEL must be one of" in str(excinfo.value)


# TC-CFG-007: _as_int converts valid values and raises on invalid
def test_as_int_valid_and_invalid():
    # Valid conversions
    assert config._as_int("BATCH_MAX", "123", 200) == 123
    assert config._as_int("BATCH_MAX", None, 200) == 200

    # Invalid raises ValueError
    with pytest.raises(ValueError) as excinfo:
        config._as_int("BATCH_MAX", "abc", 200)
    assert "must be an integer" in str(excinfo.value)


# TC-CFG-008: _is_truthy interprets common true-ish strings
@pytest.mark.parametrize(
    "value,expected",
    [
        ("1", True),
        ("true", True),
        ("TRUE", True),
        ("yes", True),
        ("on", True),
        ("0", False),
        ("false", False),
        ("", False),
        (None, False),
    ],
)
def test_is_truthy_values(value, expected):
    assert config._is_truthy(value) is expected
