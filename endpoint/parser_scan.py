import re
import sys
import os
import json
import time
import signal
import argparse
from collections import defaultdict
from statistics import median, mean, pstdev
from typing import Optional, Dict, List, Tuple

# --- Regex patterns for tcpdump parsing ---
TS_RE   = re.compile(r"^(\d+\.\d{3,})")
RSSI_RE = re.compile(r"(-?\d{1,3})dBm signal")
MAC_TA  = re.compile(r"\bTA:([0-9A-Fa-f:]{17})\b")
MAC_SA  = re.compile(r"\bSA:([0-9A-Fa-f:]{17})\b")


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


class MacAggregator:
    """
    Aggregates samples per MAC in short windows and emits a single record per window.

    - Call add_sample(...) for each parsed line.
    - Call flush_expired(current_ts) regularly (e.g., each iteration).
    - Call flush_all() at shutdown to not lose trailing samples.
    """
    def __init__(self, window_s: float, emit_cb):
        self.window_s = float(window_s)
        self.emit_cb = emit_cb  # function(dict) -> None
        # mac -> {"samples": List[Tuple[ts, rssi, channel]], "first_ts": float, "last_ts": float}
        self._state: Dict[str, Dict[str, object]] = defaultdict(lambda: {
            "samples": [], "first_ts": None, "last_ts": None
        })

    def add_sample(self, mac: str, rssi: float, ts: float, channel: int = -1):
        st = self._state[mac]
        if st["first_ts"] is None:
            st["first_ts"] = ts
        st["last_ts"] = ts
        samples: List[Tuple[float, float, int]] = st["samples"]  # type: ignore
        samples.append((ts, float(rssi), int(channel)))

        # If the window for this MAC has expired relative to this sample's ts, emit immediately
        if (ts - float(st["first_ts"])) >= self.window_s:
            self._emit(mac)

    def flush_expired(self, current_ts: Optional[float] = None):
        """
        Emit any MAC windows that have expired. If current_ts is provided,
        use it as the reference; otherwise use wall clock time for live stdin.
        """
        if current_ts is None:
            now = time.time()
        else:
            now = float(current_ts)

        to_emit = [
            mac for mac, st in self._state.items()
            if st["first_ts"] is not None and (now - float(st["first_ts"])) >= self.window_s
        ]
        for mac in to_emit:
            self._emit(mac)

    def flush_all(self):
        """Emit whatever is left (use on shutdown)."""
        for mac in list(self._state.keys()):
            self._emit(mac)

    def _emit(self, mac: str):
        st = self._state.get(mac)
        if not st:
            return
        samples: List[Tuple[float, float, int]] = st["samples"]  # type: ignore
        if not samples:
            self._state.pop(mac, None)
            return

        ts_list, rssi_list, ch_list = zip(*samples)
        aggregated = {
            "mac": mac,
            "first_seen": float(st["first_ts"]),         # window start (capture ts)
            "last_seen": float(st["last_ts"]),           # window end   (capture ts)
            "sample_count": len(rssi_list),
            "median_rssi": float(median(rssi_list)),
            "avg_rssi": float(mean(rssi_list)),
            "rssi_stddev": float(pstdev(rssi_list)) if len(rssi_list) > 1 else 0.0,
            "last_channel": int(ch_list[-1]),
            "window_ms": int(self.window_s * 1000),
            "aggregated": True,
        }

        self.emit_cb(aggregated)
        # reset state for fresh window
        self._state.pop(mac, None)


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
    parser.add_argument("--no-meta", action="store_true",
                        help="Do not include 'meta' field on output (compat-only payload)")
    args = parser.parse_args()

    # Open output
    if args.out_path == "-":
        out = sys.stdout
    else:
        # Ensure parent dir exists if needed
        parent = os.path.dirname(os.path.abspath(args.out_path))
        if parent and not os.path.exists(parent):
            os.makedirs(parent, exist_ok=True)
        out = open(args.out_path, "w", encoding="utf-8")

    def _emit_line(obj: Dict[str, object]):
        out.write(json.dumps(obj, ensure_ascii=False) + "\n")
        out.flush()

    # Emit compatibility payload: rssi=median_rssi, timestamp=last_seen
    def _emit_json_compat(agg: Dict[str, object]):
        compat = {
            "mac": agg["mac"],
            "rssi": int(round(float(agg["median_rssi"]))),
            "timestamp": float(agg["last_seen"]),
        }
        if not args.no_meta:
            compat["meta"] = {
                "first_seen": agg["first_seen"],
                "last_seen": agg["last_seen"],
                "sample_count": agg["sample_count"],
                "avg_rssi": agg["avg_rssi"],
                "rssi_stddev": agg["rssi_stddev"],
                "last_channel": agg["last_channel"],
                "window_ms": agg["window_ms"],
                "aggregated": True,
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
                # even if none, allow periodic flush based on last ts seen
                aggr.flush_expired(last_ts_seen)
                continue

            if args.emit_raw:
                _emit_line(record)  # raw single-packet record

            mac = str(record["mac"])
            rssi = int(record["rssi"])
            ts = float(record["timestamp"])
            last_ts_seen = ts

            # Channel not parsed here; pass -1 (can be wired later if you add it)
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
