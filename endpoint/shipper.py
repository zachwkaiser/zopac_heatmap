# shipper.py
from __future__ import annotations

import json
import time
import gzip
import threading
import queue
import logging
from typing import Any, Dict, List, Optional, Literal
from urllib import request, error


AuthStyle = Literal["x-api-key", "bearer"]


class Shipper:
    """
    Batches parsed records and POSTs them to the server.

    Typical usage (matches stream.py):
        ship = Shipper(
            server_url=ingest_url,
            api_key=cfg.api_key,
            batch_size=cfg.batch_max,
            flush_ms=cfg.batch_interval * 1000,
            timeout_s=15,
            use_gzip=False,
            auth_style="x-api-key",            # or "bearer"
            endpoint_id=cfg.endpoint_id,       # often required server-side
            include_endpoint_in_records=True,  # inject endpointId into each record
            include_endpoint_top_level=True,   # also send { endpointId: ... } at top-level
            timestamp_as_iso=False,            # set True if your server expects ISO strings
        )
        ship.add({"mac": "...", "rssi": -42, "timestamp": 123.456})
        ship.flush()  # on shutdown
    """

    def __init__(
        self,
        server_url: str,
        api_key: str,
        batch_size: int = 200,
        flush_ms: int = 5000,
        timeout_s: int = 30,
        use_gzip: bool = False,
        max_retries: int = 5,
        auth_style: AuthStyle = "x-api-key",
        endpoint_id: Optional[str] = None,
        include_endpoint_in_records: bool = True,
        include_endpoint_top_level: bool = True,
        user_agent: str = "WiFiEndpoint/1.0",
        timestamp_as_iso: bool = False,
    ):
        if not server_url:
            raise ValueError("server_url is required")
        if not api_key:
            raise ValueError("api_key is required")

        self.server_url = server_url
        self.api_key = api_key
        self.batch_size = int(batch_size)
        self.flush_ms = int(flush_ms)
        self.timeout_s = int(timeout_s)
        self.use_gzip = bool(use_gzip)
        self.max_retries = int(max_retries)
        self.auth_style = auth_style
        self.endpoint_id = endpoint_id
        self.include_endpoint_in_records = include_endpoint_in_records
        self.include_endpoint_top_level = include_endpoint_top_level
        self.user_agent = user_agent
        self.timestamp_as_iso = bool(timestamp_as_iso)

        self._q: "queue.Queue[Dict[str, Any]]" = queue.Queue()
        self._lock = threading.Lock()
        self._batch: List[Dict[str, Any]] = []
        self._last_flush = time.time()
        self._running = True

        self._log = logging.getLogger("shipper")
        if not self._log.handlers:
            self._log.addHandler(logging.NullHandler())

        # Precompute static headers (auth header style is configurable)
        self._base_headers: Dict[str, str] = {
            "Content-Type": "application/json; charset=utf-8",
            "Accept": "application/json",
            "User-Agent": self.user_agent,
        }
        if self.auth_style == "x-api-key":
            self._base_headers["X-API-Key"] = self.api_key
        elif self.auth_style == "bearer":
            self._base_headers["Authorization"] = f"Bearer {self.api_key}"
        else:
            raise ValueError(f"Unknown auth_style: {self.auth_style}")

        # Background sender thread
        self._thread = threading.Thread(
            target=self._run, name="ShipperThread", daemon=True
        )
        self._thread.start()

    # ---------------- Public API ----------------

    def add(self, record: Dict[str, Any]) -> None:
        """Enqueue a single parsed record for batching."""
        if not self._running:
            return
        self._q.put(record)

    def flush(self) -> None:
        """Synchronously flush the current batch and drain the queue."""
        self._drain_queue()
        self._send_if_needed(force=True)

    # ---------------- Internal thread ----------------

    def _run(self):
        """Move items from queue into an in-memory batch and send on thresholds."""
        try:
            while self._running:
                try:
                    item = self._q.get(timeout=0.1)
                    with self._lock:
                        self._batch.append(item)
                    self._q.task_done()
                except queue.Empty:
                    pass
                self._send_if_needed(force=False)
        except Exception as e:
            self._log.exception("Shipper thread crashed: %s", e)
        finally:
            try:
                self.flush()
            except Exception:
                pass

    # ---------------- Helpers ----------------

    def _drain_queue(self) -> None:
        """Pull everything currently in the queue into the batch."""
        while True:
            try:
                item = self._q.get_nowait()
            except queue.Empty:
                break
            with self._lock:
                self._batch.append(item)
            self._q.task_done()

    def _send_if_needed(self, force: bool) -> None:
        now = time.time()
        should_time_flush = (now - self._last_flush) * 1000.0 >= self.flush_ms

        with self._lock:
            if not self._batch:
                if force:
                    self._last_flush = now
                return

            if not (force or len(self._batch) >= self.batch_size or should_time_flush):
                return

            # Snapshot and clear current batch
            batch = self._batch
            self._batch = []
            self._last_flush = now

        self._post_records(batch)

    # ---------------- Networking ----------------

    @staticmethod
    def _to_iso8601(ts: float) -> str:
        # Convert seconds (float) to UTC ISO-8601 with Z
        return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(ts))

    def _payload_bytes(self, records: List[Dict[str, Any]]) -> bytes:
        """
        Build the JSON body:
          - Optionally convert numeric timestamps to ISO strings
          - Optionally inject 'endpoint_id' into each record (snake_case)
          - Optionally include a top-level 'endpoint_id'
          - Final shape: {"records": [...], "endpoint_id": "..."} (if configured)
        """
        records_to_send: List[Dict[str, Any]] = []
        for r in records:
            rr = dict(r)  # shallow copy

            # Normalize timestamp key
            if "timestamp" not in rr and "ts" in rr:
                rr["timestamp"] = rr.pop("ts")

            # Optional ISO time conversion
            if self.timestamp_as_iso and isinstance(rr.get("timestamp"), (int, float)):
                rr["timestamp"] = self._to_iso8601(float(rr["timestamp"]))

            if self.endpoint_id and self.include_endpoint_in_records and "endpoint_id" not in rr:
                rr["endpoint_id"] = self.endpoint_id
                rr.pop("endpointId", None)

            records_to_send.append(rr)

        payload: Dict[str, Any] = {"records": records_to_send}
        if self.endpoint_id and self.include_endpoint_top_level:
            payload["endpointId"] = self.endpoint_id

        return json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")

    def _post_records(self, records: List[Dict[str, Any]]) -> None:
        """POST the records to the server with retries/backoff."""
        if not records:
            return

        body_bytes = self._payload_bytes(records)
        headers = dict(self._base_headers)

        if self.use_gzip:
            body_bytes = gzip.compress(body_bytes)
            headers["Content-Encoding"] = "gzip"

        backoff = 0.5
        attempt = 0

        while True:
            attempt += 1
            try:
                req = request.Request(
                    self.server_url, data=body_bytes, headers=headers, method="POST"
                )
                with request.urlopen(req, timeout=self.timeout_s) as resp:
                    status = getattr(resp, "status", 200)
                    if 200 <= status < 300:
                        if self._log.isEnabledFor(logging.DEBUG):
                            self._log.debug("POST ok: sent=%d status=%s", len(records), status)
                        return
                    # Non-2xx: try to read server’s message to help debugging
                    msg = ""
                    try:
                        msg = resp.read(1024).decode("utf-8", "ignore")
                    except Exception:
                        pass
                    raise error.HTTPError(self.server_url, status, msg or f"HTTP {status}", hdrs=None, fp=None)

            except (error.URLError, error.HTTPError, TimeoutError) as e:
                status = getattr(e, "code", None)

                # Try to capture the server response body for diagnostics on 4xx/5xx
                server_msg = ""
                if isinstance(e, error.HTTPError) and e.fp:
                    try:
                        server_msg = e.fp.read(1024).decode("utf-8", "ignore")
                    except Exception:
                        pass

                retriable = True
                # Treat most 4xx (except 408/409/429) as non-retriable (schema/auth issues)
                if isinstance(e, error.HTTPError) and status is not None:
                    if 400 <= status < 500 and status not in (408, 409, 429):
                        retriable = False

                self._log.warning(
                    "POST failed (attempt %d/%d, status=%s, retriable=%s). Server said: %r",
                    attempt,
                    self.max_retries,
                    status,
                    retriable,
                    (server_msg[:1000] if server_msg else str(e)),
                )

                if not retriable or attempt >= self.max_retries:
                    # Drop this batch to avoid blocking forever
                    self._log.error(
                        "Dropping batch of %d after %d attempts (status=%s).",
                        len(records),
                        attempt,
                        status,
                    )
                    return

                time.sleep(backoff)
                backoff = min(backoff * 2, 8.0)

    # ---------------- Context management ----------------

    def close(self):
        """Stop background thread and flush remaining items."""
        self._running = False
        try:
            self._thread.join(timeout=1.0)
        except Exception:
            pass
        self.flush()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        self.close()
