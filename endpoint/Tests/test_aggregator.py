# endpoint/tests/test_aggregator.py
"""
Automated black-box tests for aggregator.py (MacAggregator).

Each test references a Test Case ID (TC-AGG-###) for traceability in the
test report and traceability matrix.
"""

import sys
from pathlib import Path
from typing import List, Dict

import pytest

# --- Ensure endpoint directory (where aggregator.py lives) is on sys.path ---
ENDPOINT_DIR = Path(__file__).resolve().parents[1]
if str(ENDPOINT_DIR) not in sys.path:
    sys.path.insert(0, str(ENDPOINT_DIR))

import aggregator  # noqa: E402


class CaptureEmit:
    """Helper to capture all emitted aggregated records."""

    def __init__(self):
        self.records: List[Dict[str, object]] = []

    def __call__(self, rec: Dict[str, object]):
        self.records.append(rec)


# TC-AGG-001: No emit when window not expired
def test_no_emit_before_window_expires():
    emit = CaptureEmit()
    aggr = aggregator.MacAggregator(window_s=2.0, emit_cb=emit)

    # Two samples within 1 second -> window_s=2.0 not reached
    aggr.add_sample(mac="aa:bb:cc:dd:ee:ff", rssi=-50, ts=100.0, channel=6)
    aggr.add_sample(mac="aa:bb:cc:dd:ee:ff", rssi=-55, ts=101.0, channel=6)

    # No flush_expired, window hasn't expired by timestamp difference either
    assert emit.records == []


# TC-AGG-002: Emit on add_sample when ts - first_ts >= window_s
def test_emit_on_add_sample_when_window_expires():
    emit = CaptureEmit()
    aggr = aggregator.MacAggregator(window_s=2.0, emit_cb=emit)

    mac = "aa:bb:cc:dd:ee:ff"
    aggr.add_sample(mac=mac, rssi=-50, ts=10.0, channel=1)
    # This sample is 2.5s later -> window should expire and emit
    aggr.add_sample(mac=mac, rssi=-60, ts=12.5, channel=11)

    # Should have exactly one aggregated record
    assert len(emit.records) == 1
    rec = emit.records[0]

    assert rec["mac"] == mac
    assert rec["first_seen"] == pytest.approx(10.0)
    assert rec["last_seen"] == pytest.approx(12.5)
    assert rec["sample_count"] == 2
    # RSSI values were -50 and -60
    assert rec["median_rssi"] == pytest.approx(-55.0)
    assert rec["avg_rssi"] == pytest.approx(-55.0)
    # population stddev for [-50, -60] is 5
    assert rec["rssi_stddev"] == pytest.approx(5.0)
    assert rec["last_channel"] == 11
    assert rec["window_ms"] == 2000
    assert rec["aggregated"] is True

    # After emit, state for this MAC should be cleared; no extra emit on flush_all
    emit.records.clear()
    aggr.flush_all()
    assert emit.records == []


# TC-AGG-003: flush_expired emits windows based on current_ts
def test_flush_expired_uses_current_ts():
    emit = CaptureEmit()
    aggr = aggregator.MacAggregator(window_s=2.0, emit_cb=emit)

    mac = "11:22:33:44:55:66"
    aggr.add_sample(mac=mac, rssi=-70, ts=20.0, channel=6)

    # At current_ts=21.0, less than 2s since first_ts=20.0 -> no emit
    aggr.flush_expired(current_ts=21.0)
    assert emit.records == []

    # At current_ts=22.5, more than 2s since first_ts=20.0 -> emit
    aggr.flush_expired(current_ts=22.5)
    assert len(emit.records) == 1
    rec = emit.records[0]

    assert rec["mac"] == mac
    assert rec["sample_count"] == 1
    assert rec["median_rssi"] == pytest.approx(-70.0)
    assert rec["avg_rssi"] == pytest.approx(-70.0)
    assert rec["rssi_stddev"] == pytest.approx(0.0)
    assert rec["first_seen"] == pytest.approx(20.0)
    assert rec["last_seen"] == pytest.approx(20.0)


# TC-AGG-004: flush_all emits remaining windows even if not yet expired
def test_flush_all_emits_remaining():
    emit = CaptureEmit()
    aggr = aggregator.MacAggregator(window_s=10.0, emit_cb=emit)

    mac = "aa:aa:aa:aa:aa:aa"
    aggr.add_sample(mac=mac, rssi=-40, ts=100.0, channel=1)
    aggr.add_sample(mac=mac, rssi=-42, ts=101.0, channel=1)

    # Window_s is large (10s) so it should not expire yet
    aggr.flush_expired(current_ts=105.0)
    assert emit.records == []

    # flush_all should force emit
    aggr.flush_all()
    assert len(emit.records) == 1
    rec = emit.records[0]
    assert rec["mac"] == mac
    assert rec["sample_count"] == 2


# TC-AGG-005: multiple MACs tracked independently
def test_multiple_macs_tracked_independently():
    emit = CaptureEmit()
    aggr = aggregator.MacAggregator(window_s=1.0, emit_cb=emit)

    aggr.add_sample(mac="aa:bb:cc:dd:ee:ff", rssi=-60, ts=10.0, channel=1)
    aggr.add_sample(mac="11:22:33:44:55:66", rssi=-70, ts=10.2, channel=6)

    # Advance time enough for both to expire
    aggr.flush_expired(current_ts=12.0)

    # Expect one aggregated record per MAC
    assert len(emit.records) == 2
    macs = {rec["mac"] for rec in emit.records}
    assert macs == {"aa:bb:cc:dd:ee:ff", "11:22:33:44:55:66"}
