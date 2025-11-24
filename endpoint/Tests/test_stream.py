# endpoint/tests/test_stream.py
"""
Automated black-box tests for stream.py (tcpdump → parse → ship pipeline).

Each test references a Test Case ID (TC-STR-###) for traceability in the
test report and traceability matrix.
"""

import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional


# --- Ensure endpoint directory (where stream.py lives) is on sys.path ---
ENDPOINT_DIR = Path(__file__).resolve().parents[1]
if str(ENDPOINT_DIR) not in sys.path:
    sys.path.insert(0, str(ENDPOINT_DIR))

import stream  # change to `import steam` if your file is actually named steam.py  # noqa: E402


# TC-STR-001: _iter_lines reads all lines from a file path
def test_iter_lines_reads_file(tmp_path):
    # Create a temporary input file
    p = tmp_path / "input.log"
    lines = ["line1\n", "line2\n", "line3\n"]
    p.write_text("".join(lines), encoding="utf-8")

    out = list(stream._iter_lines(str(p)))
    assert out == lines


# TC-STR-002: _signal_handler sets _RUNNING to False
def test_signal_handler_sets_running_false():
    # Ensure starting state
    stream._RUNNING = True
    stream._signal_handler(signum=2, frame=None)
    assert stream._RUNNING is False
    # Reset for other tests
    stream._RUNNING = True


class DummyCfg:
    """Fake config object to satisfy load_config() in stream.main()."""

    def __init__(self):
        self.server_url = "http://example.com"
        self.log_level = "INFO"
        self.endpoint_id = "ep-123"
        self.wlan_iface = "wlan1"
        self.api_key = "TEST_API_KEY"
        self.batch_max = 100
        self.batch_interval = 5  # seconds


class DummyShipper:
    """Fake Shipper to capture init args and added records."""

    def __init__(
        self,
        server_url: str,
        api_key: str,
        batch_size: int,
        flush_ms: int,
        timeout_s: int,
        use_gzip: bool,
        auth_style: str,
        endpoint_id: Optional[str] = None,
    ):
        self.server_url = server_url
        self.api_key = api_key
        self.batch_size = batch_size
        self.flush_ms = flush_ms
        self.timeout_s = timeout_s
        self.use_gzip = use_gzip
        self.auth_style = auth_style
        self.endpoint_id = endpoint_id
        self.add_calls: List[Dict[str, Any]] = []
        self.flush_called = False

    def add(self, rec: Dict[str, Any]) -> None:
        self.add_calls.append(rec)

    def flush(self) -> None:
        self.flush_called = True


# TC-STR-003: main() wires parse_line → Shipper.add and builds correct ingest URL
def test_main_processes_lines_and_calls_shipper_add(tmp_path, monkeypatch):
    # Prepare a fake input file
    input_file = tmp_path / "tcpdump.log"
    raw_lines = ["valid1\n", "invalid\n"]
    input_file.write_text("".join(raw_lines), encoding="utf-8")

    # Fake config
    monkeypatch.setattr(stream, "load_config", lambda: DummyCfg())

    # Fake parse_line: only first line is valid
    def fake_parse_line(line: str):
        if "valid1" in line:
            return {"mac": "aa:bb:cc:dd:ee:ff", "rssi": -50, "timestamp": 100.0}
        return None

    monkeypatch.setattr(stream, "parse_line", fake_parse_line)

    # Capture Shipper usage
    created_shippers: List[DummyShipper] = []

    def fake_shipper_ctor(*args, **kwargs):
        s = DummyShipper(*args, **kwargs)
        created_shippers.append(s)
        return s

    monkeypatch.setattr(stream, "Shipper", fake_shipper_ctor)

    # Avoid installing real signal handlers
    monkeypatch.setattr(stream.signal, "signal", lambda *a, **k: None)
    # Avoid global logging configuration noise
    monkeypatch.setattr(stream.logging, "basicConfig", lambda *a, **k: None)

    # Simulate CLI: use --from with our temp file
    monkeypatch.setattr(
        stream.sys,
        "argv",
        ["stream.py", "--from", str(input_file)],
    )

    # Ensure _RUNNING starts True
    stream._RUNNING = True

    # Run main
    stream.main()

    # Assertions
    assert len(created_shippers) == 1
    s = created_shippers[0]

    # ingest_url should be base + /api/endpoint/scan-data
    assert s.server_url == "http://example.com/api/endpoint/scan-data"
    assert s.api_key == "TEST_API_KEY"
    # Only one valid line -> one add() call
    assert len(s.add_calls) == 1
    assert s.add_calls[0]["mac"] == "aa:bb:cc:dd:ee:ff"
    # main should flush before exit
    assert s.flush_called is True


# TC-STR-004: main() writes tee JSONL when --tee-jsonl is provided
def test_main_writes_tee_jsonl(tmp_path, monkeypatch):
    # Prepare a fake input file
    input_file = tmp_path / "tcpdump.log"
    raw_lines = ["valid1\n", "valid2\n"]
    input_file.write_text("".join(raw_lines), encoding="utf-8")

    tee_file = tmp_path / "parsed.jsonl"

    # Fake config
    monkeypatch.setattr(stream, "load_config", lambda: DummyCfg())

    # Fake parse_line: always return a small record
    def fake_parse_line(line: str):
        return {
            "mac": "11:22:33:44:55:66",
            "rssi": -60,
            "timestamp": 123.456,
        }

    monkeypatch.setattr(stream, "parse_line", fake_parse_line)

    # Dummy shipper that just records adds
    def fake_shipper_ctor(*args, **kwargs):
        return DummyShipper(*args, **kwargs)

    monkeypatch.setattr(stream, "Shipper", fake_shipper_ctor)

    # Avoid signal + logging side effects
    monkeypatch.setattr(stream.signal, "signal", lambda *a, **k: None)
    monkeypatch.setattr(stream.logging, "basicConfig", lambda *a, **k: None)

    # Simulate CLI: --from and --tee-jsonl
    monkeypatch.setattr(
        stream.sys,
        "argv",
        ["stream.py", "--from", str(input_file), "--tee-jsonl", str(tee_file)],
    )

    stream._RUNNING = True
    stream.main()

    # Tee file should contain one JSON line per parsed record
    content = tee_file.read_text(encoding="utf-8").strip().splitlines()
    # We had 2 raw lines, parse_line always returns a record, so 2 JSONL lines
    assert len(content) == 2

    # Validate JSON shape of first line
    rec0 = json.loads(content[0])
    assert rec0["mac"] == "11:22:33:44:55:66"
    assert rec0["rssi"] == -60
    assert rec0["timestamp"] == 123.456
