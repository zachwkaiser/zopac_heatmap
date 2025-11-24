# endpoint/tests/test_parser_scan.py
"""
Automated black-box tests for parser_scan.py.

Each test references a Test Case ID (TC-PS-###) for traceability in the
test report and traceability matrix.
"""

import io
import json
import sys
from pathlib import Path
from typing import List, Dict

import pytest

# --- Ensure endpoint directory (where parser_scan.py and aggregator.py live) is on sys.path ---
ENDPOINT_DIR = Path(__file__).resolve().parents[1]
if str(ENDPOINT_DIR) not in sys.path:
    sys.path.insert(0, str(ENDPOINT_DIR))

import parser_scan  # noqa: E402


# TC-PS-001: parse_line returns dict with mac, rssi, timestamp for a valid TA line
def test_parse_line_valid_ta():
    line = (
        "1700000000.123 802.11 Probe Request -50dBm signal antenna 1 "
        "TA:AA:BB:CC:DD:EE:FF more stuff"
    )

    record = parser_scan.parse_line(line)

    assert record is not None
    assert record["mac"] == "aa:bb:cc:dd:ee:ff"
    assert record["rssi"] == -50
    assert record["timestamp"] == pytest.approx(1700000000.123)


# TC-PS-002: parse_line returns dict for a valid SA line when TA is absent
def test_parse_line_valid_sa_only():
    line = (
        "1700000000.456 802.11 Probe Request -42dBm signal antenna 1 "
        "SA:11:22:33:44:55:66 more stuff"
    )

    record = parser_scan.parse_line(line)

    assert record is not None
    assert record["mac"] == "11:22:33:44:55:66"
    assert record["rssi"] == -42
    assert record["timestamp"] == pytest.approx(1700000000.456)


# TC-PS-003: parse_line returns None if required fields are missing
@pytest.mark.parametrize(
    "line",
    [
        # Missing RSSI
        "1700000000.123 some text TA:AA:BB:CC:DD:EE:FF",
        # Missing MAC
        "1700000000.123 802.11 Probe Request -60dBm signal antenna 1",
        # Missing timestamp
        "no-timestamp-here -60dBm signal TA:AA:BB:CC:DD:EE:FF",
    ],
)
def test_parse_line_missing_fields_returns_none(line):
    record = parser_scan.parse_line(line)
    assert record is None


# TC-PS-004: normal_mac always lowercases the MAC address
def test_normal_mac_lowercases():
    assert parser_scan.normal_mac("AA:BB:CC:DD:EE:FF") == "aa:bb:cc:dd:ee:ff"
    assert parser_scan.normal_mac("aa:bb:cc:dd:ee:ff") == "aa:bb:cc:dd:ee:ff"
    assert parser_scan.normal_mac("Aa:Bb:Cc:Dd:Ee:Ff") == "aa:bb:cc:dd:ee:ff"


class DummyAggregator:
    """
    Dummy MacAggregator for black-box tests of main().

    Instead of doing real windowing/median logic, it immediately invokes
    emit_cb with a simple aggregate dict. This keeps tests independent
    of the real aggregator implementation while still exercising the
    parser_scan main() flow.
    """

    def __init__(self, window_s: float, emit_cb):
        self.window_s = window_s
        self.emit_cb = emit_cb
        self._samples: List[Dict[str, object]] = []

    def add_sample(self, mac: str, rssi: int, ts: float, channel: int):
        self._samples.append({"mac": mac, "rssi": rssi, "ts": ts, "channel": channel})
        # Immediately emit as if this is the aggregate
        self.emit_cb(
            {
                "mac": mac,
                "median_rssi": rssi,
                "last_seen": ts,
            }
        )

    def flush_expired(self, *_):
        # No-op for the dummy
        pass

    def flush_all(self):
        # No-op for the dummy
        pass


# TC-PS-005: main() reads from stdin and emits aggregated JSONL (compat format)
def test_main_stdin_to_stdout_aggregated(monkeypatch, capsys):
    # Patch MacAggregator in parser_scan to our dummy implementation
    monkeypatch.setattr(parser_scan, "MacAggregator", DummyAggregator)

    sample_line = (
        "1700000001.000 802.11 Probe Request -55dBm signal antenna 1 "
        "TA:AA:BB:CC:DD:EE:FF more stuff\n"
    )

    # Simulate CLI: no --from, no --out => stdin/stdout
    monkeypatch.setattr(
        parser_scan.sys,
        "argv",
        ["parser_scan.py"],  # no extra args: uses stdin and stdout
    )
    monkeypatch.setattr(
        parser_scan.sys,
        "stdin",
        io.StringIO(sample_line),
    )

    parser_scan.main()

    out = capsys.readouterr().out.strip()
    assert out, "Expected some JSON output on stdout"

    # Should be a single JSON line from _emit_json_compat
    obj = json.loads(out)
    assert obj["mac"] == "aa:bb:cc:dd:ee:ff"
    assert obj["rssi"] == -55
    # timestamp should be the same as parsed float
    assert obj["timestamp"] == pytest.approx(1700000001.0)


# TC-PS-006: main() with --emit-raw outputs both raw and aggregated records
def test_main_emit_raw_outputs_raw_and_aggregated(monkeypatch, capsys):
    monkeypatch.setattr(parser_scan, "MacAggregator", DummyAggregator)

    sample_line = (
        "1700000002.500 802.11 Probe Request -65dBm signal antenna 1 "
        "SA:11:22:33:44:55:66 other text\n"
    )

    monkeypatch.setattr(
        parser_scan.sys,
        "argv",
        ["parser_scan.py", "--emit-raw"],
    )
    monkeypatch.setattr(
        parser_scan.sys,
        "stdin",
        io.StringIO(sample_line),
    )

    parser_scan.main()

    out_lines = capsys.readouterr().out.strip().splitlines()
    # Expect 2 lines: one raw record + one aggregated record
    assert len(out_lines) == 2

    raw_obj = json.loads(out_lines[0])
    agg_obj = json.loads(out_lines[1])

    # Raw record should have original keys from parse_line
    assert raw_obj["mac"] == "11:22:33:44:55:66"
    assert raw_obj["rssi"] == -65
    assert raw_obj["timestamp"] == pytest.approx(1700000002.5)

    # Aggregated record uses compat format (same mac/rssi/timestamp in this dummy)
    assert agg_obj["mac"] == "11:22:33:44:55:66"
    assert agg_obj["rssi"] == -65
    assert agg_obj["timestamp"] == pytest.approx(1700000002.5)
