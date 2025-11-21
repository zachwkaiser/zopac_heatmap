"""
aggregator.py
A small, reusable per-MAC aggregator for short-window RSSI aggregation.

Usage pattern:
    from aggregator import MacAggregator

    def handle_aggregated(rec: dict):
        # do something with aggregated record
        pass

    aggr = MacAggregator(window_s=2.0, emit_cb=handle_aggregated)
    aggr.add_sample(mac, rssi, ts, channel=-1)
    aggr.flush_expired(current_ts)  # call periodically
    aggr.flush_all()                # on shutdown

Emitted record shape (aggregated):
{
  "mac": "<mac>",
  "first_seen": <float>,       # window start (capture ts)
  "last_seen": <float>,        # window end   (capture ts)
  "sample_count": <int>,
  "median_rssi": <float>,
  "avg_rssi": <float>,
  "rssi_stddev": <float>,
  "last_channel": <int>,
  "window_ms": <int>,
  "aggregated": true
}
"""

from __future__ import annotations

import time
from collections import defaultdict
from statistics import median, mean, pstdev
from typing import Callable, Dict, List, Tuple, Optional


class MacAggregator:
    """
    Aggregates samples per MAC across a short time window and emits one summary per window.

    - add_sample(mac, rssi, ts, channel=-1): feed per-packet data
    - flush_expired(current_ts): emit any windows whose (current_ts - first_ts) >= window_s
    - flush_all(): emit whatever remains (e.g., on shutdown)

    The aggregator resets the per-MAC window after emit, so subsequent samples start a new window.
    """

    def __init__(self, window_s: float, emit_cb: Callable[[dict], None]):
        self.window_s = float(window_s)
        self.emit_cb = emit_cb
        # mac -> {"samples": List[Tuple[ts, rssi, channel]], "first_ts": float, "last_ts": float}
        self._state: Dict[str, Dict[str, object]] = defaultdict(
            lambda: {"samples": [], "first_ts": None, "last_ts": None}
        )

    def add_sample(self, mac: str, rssi: float, ts: float, channel: int = -1) -> None:
        st = self._state[mac]
        if st["first_ts"] is None:
            st["first_ts"] = ts
        st["last_ts"] = ts
        samples: List[Tuple[float, float, int]] = st["samples"]  # type: ignore
        samples.append((ts, float(rssi), int(channel)))

        # If the window has expired relative to this sample's timestamp, emit now.
        if (ts - float(st["first_ts"])) >= self.window_s:
            self._emit(mac)

    def flush_expired(self, current_ts: Optional[float] = None) -> None:
        """
        Emit any windows that have expired. If current_ts is not provided, wall clock time is used.
        For stdin live streams, using wall clock is fine; for file replays, pass the latest capture ts.
        """
        now = time.time() if current_ts is None else float(current_ts)
        to_emit = [
            mac
            for mac, st in self._state.items()
            if st["first_ts"] is not None and (now - float(st["first_ts"])) >= self.window_s
        ]
        for mac in to_emit:
            self._emit(mac)

    def flush_all(self) -> None:
        """Emit any remaining windows."""
        for mac in list(self._state.keys()):
            self._emit(mac)

    def _emit(self, mac: str) -> None:
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
        # Reset state for fresh window
        self._state.pop(mac, None)
