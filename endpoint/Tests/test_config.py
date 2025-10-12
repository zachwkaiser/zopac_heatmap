# This file was mostly written by ChatGPT with some modifications by me.
# It tests the config.py file to ensure that the configuration loading and validation works as expected.
import pytest
from endpoint import config as cfg

CFG_KEYS = {
    "ENDPOINT_ID", "WLAN_IFACE", "SERVER_URL", "API_KEY",
    "LOG_LEVEL", "UPDATE_CHANNEL", "HEARTBEAT_SEC", "BATCH_MAX", "BATCH_INTERVAL_SEC"
}

def clear_cfg_env(monkeypatch):
    for k in CFG_KEYS:
        monkeypatch.delenv(k, raising=False)

def set_min_env(monkeypatch, **overrides):
    base = {
        "ENDPOINT_ID": "dev-01",
        "WLAN_IFACE": "wlan1",
        "SERVER_URL": "https://api.example.com/v1",
        "API_KEY": "secret-token",
    }
    base.update(overrides)
    for k, v in base.items():
        monkeypatch.setenv(k, v)
    return base

def test_load_minimal_env_success(monkeypatch):
    clear_cfg_env(monkeypatch)
    set_min_env(monkeypatch)

    c = cfg.load_config()
    assert isinstance(c, cfg.Config)
    assert c.endpoint_id == "dev-01"
    assert c.WLAN_iface == "wlan1"
    assert c.server_URL == "https://api.example.com/v1"
    assert c.api_key == "secret-token"

    assert c.log_level == "INFO"
    assert c.update_channel == "stable"
    assert c.heartbeat_sec == 30
    assert c.batch_max == 200
    assert c.batch_interval == 5

@pytest.mark.parametrize("missing_key", ["ENDPOINT_ID", "WLAN_IFACE", "SERVER_URL", "API_KEY"])
def test_missing_required_raises(monkeypatch, missing_key):
    clear_cfg_env(monkeypatch)
    set_min_env(monkeypatch)
    monkeypatch.delenv(missing_key, raising=False)
    with pytest.raises(ValueError) as e:
        cfg.load_config()
    assert missing_key in str(e.value)

@pytest.mark.parametrize("bad_url", [
    "http://api.example.com/v1",  # not https
    "https://",                   # missing host
    "",                           # empty
])
def test_https_validation(monkeypatch, bad_url):
    clear_cfg_env(monkeypatch)
    set_min_env(monkeypatch, SERVER_URL=bad_url)
    with pytest.raises(ValueError):
        cfg.load_config()

def test_numeric_fields_parsed(monkeypatch):
    clear_cfg_env(monkeypatch)
    set_min_env(monkeypatch,
        HEARTBEAT_SEC="45",
        BATCH_MAX="500",
        BATCH_INTERVAL_SEC="2",
    )
    c = cfg.load_config()
    assert c.heartbeat_sec == 45
    assert c.batch_max == 500
    assert c.batch_interval == 2

def test__as_int():
    assert cfg._as_int("X", None, 30) == 30
    assert cfg._as_int("X", "5", 30) == 5
    with pytest.raises(ValueError):
        cfg._as_int("X", "fast", 30)

def test__validate_https_ok():
    cfg._validate_https("https://api.example.com/v1")

@pytest.mark.parametrize("bad", ["http://a", "https://", "api.example.com", ""])
def test__validate_https_bad(bad):
    with pytest.raises(ValueError):
        cfg._validate_https(bad)
