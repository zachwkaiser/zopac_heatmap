# endpoint/tests/test_heartbeat.py
"""
Automated black-box tests for heartbeat.py (periodic status sender).

Each test references a Test Case ID (TC-HB-###) for traceability in the
test report and traceability matrix.
"""

import re
import sys
from pathlib import Path

import pytest

# --- Ensure endpoint directory (where heartbeat.py + config.py live) is on sys.path ---
ENDPOINT_DIR = Path(__file__).resolve().parents[1]
if str(ENDPOINT_DIR) not in sys.path:
    sys.path.insert(0, str(ENDPOINT_DIR))

import send_status  # noqa: E402


# TC-HB-001: build_status_url normalizes base URL with / without trailing slash
@pytest.mark.parametrize(
    "base_url,expected",
    [
        ("http://example.com", "http://example.com/api/endpoint/status"),
        ("http://example.com/", "http://example.com/api/endpoint/status"),
        ("https://myhost:3000", "https://myhost:3000/api/endpoint/status"),
    ],
)
def test_build_status_url_normalizes(base_url, expected):
    url = send_status.build_status_url(base_url)
    assert url == expected


# TC-HB-002: make_headers builds correct header dict including API key
def test_make_headers_contents():
    api_key = "TEST_API_KEY_123"
    headers = send_status.make_headers(api_key)

    assert headers["Content-Type"] == "application/json"
    assert headers["x-api-key"] == api_key
    # Just sanity check the User-Agent string contains "WiFiEndpoint"
    assert "WiFiEndpoint" in headers.get("User-Agent", "")


# TC-HB-003: build_payload contains required fields and uses endpoint_id
def test_build_payload_shape(monkeypatch):
    # Make hostname deterministic
    monkeypatch.setattr(send_status.socket, "gethostname", lambda: "test-host")

    payload = send_status.build_payload("endpoint-123")

    assert payload["endpoint_id"] == "endpoint-123"
    assert payload["status"] == "online"
    assert payload["hostname"] == "test-host"

    # Check timestamp format: e.g., 2025-11-23T14:05:22Z
    ts = payload["timestamp"]
    assert isinstance(ts, str)
    assert ts.endswith("Z")
    # Rough regex: YYYY-MM-DDTHH:MM:SSZ
    assert re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$", ts)


# TC-HB-004: try_send returns ok=True and empty error body on 2xx
def test_try_send_success(monkeypatch):
    class DummyResponse:
        def __init__(self, status_code=200, text="OK"):
            self.status_code = status_code
            self.text = text

    captured = {}

    def fake_post(url, json=None, headers=None, timeout=None):
        captured["url"] = url
        captured["json"] = json
        captured["headers"] = headers
        captured["timeout"] = timeout
        return DummyResponse(status_code=201, text="Created")

    monkeypatch.setattr(send_status.requests, "post", fake_post)

    url = "http://example.com/api/endpoint/status"
    headers = {"x-api-key": "abc"}
    payload = {"endpoint_id": "ep-1"}

    ok, code, body = send_status.try_send(url, headers, payload, timeout_s=5)

    assert ok is True
    assert code == 201
    assert body == ""  # empty error body on success

    # Also confirm the POST was called with expected args
    assert captured["url"] == url
    assert captured["json"] == payload
    assert captured["headers"] == headers
    assert captured["timeout"] == 5


# TC-HB-005: try_send returns ok=False and trimmed body on non-2xx
def test_try_send_failure(monkeypatch):
    class DummyResponse:
        def __init__(self, status_code=500, text="Internal Server Error"):
            self.status_code = status_code
            self.text = text

    def fake_post(url, json=None, headers=None, timeout=None):
        return DummyResponse(status_code=500, text="Internal Server Error")

    monkeypatch.setattr(send_status.requests, "post", fake_post)

    ok, code, body = send_status.try_send(
        "http://example.com/api/endpoint/status",
        headers={},
        payload={"endpoint_id": "ep-1"},
        timeout_s=10,
    )

    assert ok is False
    assert code == 500
    assert "Internal Server Error" in body


# TC-HB-006: main() exits with code 1 when config load fails
def test_main_exits_on_config_error(monkeypatch, capsys):
    def fake_load_config():
        raise RuntimeError("bad config")

    monkeypatch.setattr(send_status, "load_config", fake_load_config)

    with pytest.raises(SystemExit) as excinfo:
        send_status.main()

    assert excinfo.value.code == 1
    err = capsys.readouterr().err
    assert "Config error" in err
