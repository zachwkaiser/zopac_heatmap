import json
import time
import gzip
import threading
import queue
import logging
from typing import Any, Dict, List
from urllib import request, error


class Shipper:
    """
    Batches parsed records and POSTs them to the server.

    Expected usage (matches your stream.py):
        ship = Shipper(server_url=..., api_key=..., batch_size=..., flush_ms=..., timeout_s=..., use_gzip=True)
        ship.add({"mac": "...", "rssi": -42, "ts": 123.456})
        ...
        ship.flush()  # on shutdown

    POST body shape (as discussed previously):
        {"records": [ {...}, {...}, ... ]}
    """

    def __init__(
        self,
        server_url: str,
        api_key: str,
        batch_size: int = 200,
        flush_ms: int = 5000,
        timeout_s: int = 30,
        use_gzip: bool = True,
        max_retries: int = 5,
    ):
        self.server_url = server_url
        self.api_key = api_key
        self.batch_size = int(batch_size)
        self.flush_ms = int(flush_ms)
        self.timeout_s = int(timeout_s)
        self.use_gzip = bool(use_gzip)
        self.max_retries = int(max_retries)

        self._q: "queue.Queue[Dict[str, Any]]" = queue.Queue()
        self._lock = threading.Lock()
        self._batch: List[Dict[str, Any]] = []
        self._last_flush = time.time()
        self._running = True

        self._log = logging.getLogger("shipper")
        if not self._log.handlers:
            # Inherit handlers/level from root; stream.py initializes logging.
            self._log.addHandler(logging.NullHandler())

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
        """
        Synchronously flush the current batch and drain the queue.
        Called by stream.py at shutdown.
        """
        # Drain queue into batch
        self._drain_queue()
        # Send whatever is in the batch
        self._send_if_needed(force=True)

    # ---------------- Internal thread ----------------

    def _run(self):
        """
        Continuously move items from the queue into an in-memory batch and
        send either when batch_size reached or flush_ms elapsed.
        """
        try:
            while self._running:
                # Wait a bit for new items
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
            # Try a last-ditch flush on thread exit
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
        """
        Send the batch if:
          - force=True, or
          - batch size reached, or
          - time since last flush >= flush_ms
        """
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

    def _post_records(self, records: List[Dict[str, Any]]) -> None:
        """POST the records to the server with retries/backoff."""
        if not records:
            return

        body_bytes = json.dumps({"records": records}).encode("utf-8")
        headers = {
            "Content-Type": "application/json; charset=utf-8",
            "Accept": "application/json",
            "x-api-key": self.api_key,
            "User-Agent": "WiFiEndpoint/1.0",
        }

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
                        # Success
                        if self._log.isEnabledFor(logging.DEBUG):
                            self._log.debug(
                                "POST ok: sent=%d status=%s", len(records), status
                            )
                        return
                    else:
                        raise error.HTTPError(
                            self.server_url,
                            status,
                            f"HTTP {status}",
                            hdrs=None,
                            fp=None,
                        )

            except (error.URLError, error.HTTPError, TimeoutError) as e:
                retriable = True
                status = getattr(e, "code", None)
                # Treat 4xx (except 429) as non-retriable (bad request/auth)
                if (
                    isinstance(e, error.HTTPError)
                    and status is not None
                    and 400 <= status < 500
                    and status != 429
                ):
                    retriable = False

                self._log.warning(
                    "POST failed (attempt %d/%d, retriable=%s): %s",
                    attempt,
                    self.max_retries,
                    retriable,
                    e,
                )

                if not retriable or attempt >= self.max_retries:
                    # Give up—drop this batch to avoid blocking pipeline forever
                    self._log.error(
                        "Dropping batch of %d after %d attempts.", len(records), attempt
                    )
                    return

                time.sleep(backoff)
                backoff = min(backoff * 2, 8.0)

    # ---------------- Context management (optional) ----------------

    def close(self):
        """Stop background thread and flush remaining items."""
        self._running = False
        # Give the thread a moment to exit its wait loop
        try:
            self._thread.join(timeout=1.0)
        except Exception:
            pass
        self.flush()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        self.close()
