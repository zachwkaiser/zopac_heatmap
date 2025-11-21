"""
parser_scan.py
Parses tcpdump lines to JSONL. With aggregation enabled, it emits one record per MAC
per small time window (median RSSI). Output remains compatibility-safe for existing
shipper/server: {mac, rssi, timestamp} ONLY.
"""

from __future__ import annotations

import re
import sys
import os
import json
import signal
import argparse
from typing import Optional, Dict

from aggregator import MacAggregator  # local module

# --- Regex patterns for tcpdump parsing ---
TS_RE = re.compile(r"^(\d+\.\d{3,})")
RSSI_RE = re.compile(r"(-?\d{1,3})dBm signal")
MAC_TA = re.compile(r"\bTA:([0-9A-Fa-f:]{17})\b")
MAC_SA = re.compile(r"\bSA:([0-9A-Fa-f:]{17})\b")


def normal_mac(m: str) -> str:
    """Normalize MAC address to lowercase."""
    return m.lower()


def parse_line(line: str) -> Optional[Dict[str, object]]:
    """
    Parse one tcpdump line and extract timestamp, RSSI, and MAC.
    Returns None if required fields are missing.
    """
    ts_match = TS_RE.search(line)
    rssi_match = RSSI_RE.search(line)
    mac_match = MAC_TA.search(line) or MAC_SA.search(line)

    if not (ts_match and rssi_match and mac_match):
        return None

    ts = float(ts_match.group(1))
    rssi = int(rssi_match.group(1))
    mac = normal_mac(mac_match.group(1))
    return {"mac": mac, "rssi": rssi, "timestamp": ts}


def _iter_lines(source_path: Optional[str]):
    """Yield lines from file or stdin."""
    if source_path:
        with open(source_path, "r", encoding="utf-8") as f:
            for line in f:
                yield line
    else:
        for line in sys.stdin:
            yield line


def main():
    parser = argparse.ArgumentParser(
        description="Parse tcpdump output to JSONL with per-MAC aggregation (median RSSI)."
    )
    parser.add_argument("--from", dest="source", default=None,
                        help="Read input from file (default: stdin)")
    parser.add_argument("--out", dest="out_path", default="-",
                        help="Write output JSONL to file (default: stdout)")
    parser.add_argument("--agg-window", type=float, default=2.0,
                        help="Aggregation window in seconds (default: 2.0)")
    parser.add_argument("--emit-raw", action="store_true",
                        help="Also emit raw per-packet records (debug)")
    args = parser.parse_args()

    # Open output
    if args.out_path == "-":
        out = sys.stdout
    else:
        parent = os.path.dirname(os.path.abspath(args.out_path))
        if parent and not os.path.exists(parent):
            os.makedirs(parent, exist_ok=True)
        out = open(args.out_path, "w", encoding="utf-8")

    def _emit_line(obj: Dict[str, object]) -> None:
        # Use default ensure_ascii=True to avoid non-ASCII issues.
        out.write(json.dumps(obj) + "\n")
        out.flush()

    # Compatibility emitter: rssi=median_rssi, timestamp=last_seen
    def _emit_json_compat(agg: Dict[str, object]) -> None:
        compat = {
            "mac": agg["mac"],
            "rssi": int(round(float(agg["median_rssi"]))),
            "timestamp": float(agg["last_seen"]),
        }
        _emit_line(compat)

    aggr = MacAggregator(window_s=args.agg_window, emit_cb=_emit_json_compat)

    shutdown = False

    def _graceful(*_):
        nonlocal shutdown
        shutdown = True

    signal.signal(signal.SIGINT, _graceful)
    signal.signal(signal.SIGTERM, _graceful)

    try:
        last_ts_seen: Optional[float] = None
        for line in _iter_lines(args.source):
            if shutdown:
                break

            record = parse_line(line)
            if record is None:
                # Even if no record, allow periodic flush based on last capture ts (if any)
                aggr.flush_expired(last_ts_seen)
                continue

            if args.emit_raw:
                _emit_line(record)  # raw per-packet record

            mac = str(record["mac"])
            rssi = int(record["rssi"])
            ts = float(record["timestamp"])
            last_ts_seen = ts

            # We are not parsing channel yet; pass -1 as placeholder
            aggr.add_sample(mac=mac, rssi=rssi, ts=ts, channel=-1)

            # Flush any windows that have expired relative to this capture timestamp
            aggr.flush_expired(last_ts_seen)

        # graceful shutdown
        aggr.flush_all()
    finally:
        if out is not sys.stdout:
            out.close()


if __name__ == "__main__":
    main()
