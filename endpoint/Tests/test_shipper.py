# endpoint/tests/test_shipper.py
"""
Automated black-box tests for shipper.py (Shipper).

Each test references a Test Case ID (TC-SHIP-###) for traceability in the
test report and traceability matrix.
"""

import json
import sys
from pathlib import Path
from typing import Any, Dict, List

import pytest

# --- Ensure endpoint directory (where shipper.py lives) is on sys.path ---
ENDPOINT_DIR = Path(__file__).resolve().parents[1]
if str(ENDPOINT_DIR) not in sys.path:
    sys.path.insert(0, str(ENDPOINT_DIR))

import shipper  # noqa: E402


# TC-SHIP-001: ctor requires server_url and api_key
def test_shipper_init_requires_server_url_and_api_key():
    with pytest.raises(ValueError):
        shipper.Shipper(server_url="", api_key="abc")

    with pytest.raises(ValueError):
        shipper.Shipper(server_url="http://example.com", api_key="")

    # This one should not raise
    s = shipper.Shipper(server_url="http://example.com", api_key="abc", flush_ms=10)
    s.close()


# TC-SHIP-002: auth_style controls headers (x-api-key vs bearer)
def test_shipper_auth_header_styles():
    s1 = shipper.Shipper(
        server_url="http://example.com",
        api_key="KEY123",
        auth_style="x-api-key",
        flush_ms=10,
    )
    assert s1._base_headers["X-API-Key"] == "KEY123"
    assert "Authorization" not in s1._base_headers
    s1.close()

    s2 = shipper.Shipper(
        server_url="http://example.com",
        api_key="TOKEN456",
        auth_style="bearer",
        flush_ms=10,
    )
    assert s2._base_headers["Authorization"] == "Bearer TOKEN456"
    assert "X-API-Key" not in s2._base_headers
    s2.close()


# TC-SHIP-003: _payload_bytes builds correct structure and injects endpointId
def test_payload_bytes_basic_structure():
    s = shipper.Shipper(
        server_url="http://example.com/api/wifi",
        api_key="abc",
        endpoint_id="ep-123",
        include_endpoint_in_records=True,
        include_endpoint_top_level=True,
        flush_ms=10,
    )

    records = [
        {"mac": "aa:bb:cc:dd:ee:ff", "rssi": -50, "timestamp": 100.0},
        {"mac": "11:22:33:44:55:66", "rssi": -60, "timestamp": 101.0},
    ]

    body = s._payload_bytes(records)
    payload = json.loads(body.decode("utf-8"))

    assert "records" in payload
    assert len(payload["records"]) == 2
    # top-level endpointId present
    assert payload["endpointId"] == "ep-123"

    for rec in payload["records"]:
        # endpoint_id injected into each record
        assert rec["endpoint_id"] == "ep-123"
        # original fields still there
        assert "mac" in rec
        assert "rssi" in rec
        assert "timestamp" in rec

    s.close()


# TC-SHIP-004: _payload_bytes normalizes ts -> timestamp and can convert to ISO
def test_payload_bytes_ts_normalization_and_iso_conversion():
    s = shipper.Shipper(
        server_url="http://example.com/api/wifi",
        api_key="abc",
        endpoint_id=None,
        timestamp_as_iso=True,
        flush_ms=10,
    )

    # Note: using "ts" instead of "timestamp"
    records = [
        {"mac": "aa:bb:cc:dd:ee:ff", "rssi": -50, "ts": 1700000000.0},
    ]

    body = s._payload_bytes(records)
    payload = json.loads(body.decode("utf-8"))

    assert "records" in payload
    rec = payload["records"][0]
    # "ts" should have been renamed to "timestamp"
    assert "ts" not in rec
    assert "timestamp" in rec
    ts_val = rec["timestamp"]
    # Since timestamp_as_iso=True and original was numeric, we should get an ISO string
    assert isinstance(ts_val, str)
    # Rough format check: YYYY-MM-DDTHH:MM:SSZ
    assert len(ts_val) == len("2025-11-23T14:00:00Z")
    assert ts_val.endswith("Z")

    s.close()


# Helper dummy classes for network tests
class DummyResponse:
    def __init__(self, status=200, body="OK"):
        self.status = status
        self._body = body.encode("utf-8")

    def read(self, n=-1):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


# TC-SHIP-005: _post_records succeeds on 2xx and does not retry
def test_post_records_success(monkeypatch):
    calls: List[Dict[str, Any]] = []

    def fake_urlopen(req, timeout):
        # capture request details
        calls.append(
            {
                "full_url": req.full_url,
                "data": req.data,
                "headers": dict(req.headers),
                "timeout": timeout,
            }
        )
        return DummyResponse(status=201, body="Created")

    monkeypatch.setattr(shipper.request, "urlopen", fake_urlopen)

    s = shipper.Shipper(
        server_url="http://example.com/api/wifi",
        api_key="abc",
        endpoint_id="ep-99",
        flush_ms=10,
        max_retries=3,
    )

    records = [{"mac": "aa:bb:cc:dd:ee:ff", "rssi": -42, "timestamp": 100.0}]
    s._post_records(records)
    s.close()

    assert len(calls) == 1
    first = calls[0]
    assert first["full_url"] == "http://example.com/api/wifi"
    assert first["timeout"] == s.timeout_s

    # Check payload structure
    payload = json.loads(first["data"].decode("utf-8"))
    assert payload["endpointId"] == "ep-99"
    assert payload["records"][0]["mac"] == "aa:bb:cc:dd:ee:ff"


# TC-SHIP-006: _post_records retries on retriable HTTP 500 up to max_retries
def test_post_records_retries_on_500(monkeypatch):
    class DummyHTTPError(shipper.error.HTTPError):
        def __init__(self, code):
            super().__init__(
                url="http://example.com/api/wifi",
                code=code,
                msg="Server error",
                hdrs=None,
                fp=None,
            )

    calls = {"count": 0}

    def fake_urlopen(req, timeout):
        calls["count"] += 1
        # Always raise HTTP 500 to trigger retry
        raise DummyHTTPError(500)

    monkeypatch.setattr(shipper.request, "urlopen", fake_urlopen)

    s = shipper.Shipper(
        server_url="http://example.com/api/wifi",
        api_key="abc",
        max_retries=3,
        flush_ms=10,
    )

    # speed up test by monkeypatching time.sleep to no-op
    monkeypatch.setattr(shipper.time, "sleep", lambda *_: None)

    records = [{"mac": "aa:bb:cc:dd:ee:ff", "rssi": -42, "timestamp": 100.0}]
    s._post_records(records)
    s.close()

    # Should have attempted exactly max_retries times
    assert calls["count"] == 3


# TC-SHIP-007: _post_records does NOT retry on non-retriable 400
def test_post_records_no_retry_on_400(monkeypatch):
    class DummyHTTPError(shipper.error.HTTPError):
        def __init__(self, code):
            super().__init__(
                url="http://example.com/api/wifi",
                code=code,
                msg="Bad request",
                hdrs=None,
                fp=None,
            )

    calls = {"count": 0}

    def fake_urlopen(req, timeout):
        calls["count"] += 1
        # Return 400, which should be treated as non-retriable
        raise DummyHTTPError(400)

    monkeypatch.setattr(shipper.request, "urlopen", fake_urlopen)
    monkeypatch.setattr(shipper.time, "sleep", lambda *_: None)

    s = shipper.Shipper(
        server_url="http://example.com/api/wifi",
        api_key="abc",
        max_retries=5,
        flush_ms=10,
    )

    records = [{"mac": "aa:bb:cc:dd:ee:ff", "rssi": -42, "timestamp": 100.0}]
    s._post_records(records)
    s.close()

    # Should only have tried once
    assert calls["count"] == 1
