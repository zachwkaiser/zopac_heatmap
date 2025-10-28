import sys
import time
import json
import signal
import logging
import argparse
from typing import Optional

from config import load_config
from parser_scan import parse_line
from shipper import Shipper


_RUNNING = True


def _signal_handler(signum, frame):
    global _RUNNING
    _RUNNING = False


def _iter_lines(source_path: Optional[str]):
    """Yield text lines either from a file (testing) or stdin (production)."""
    if source_path:
        with open(source_path, "r", encoding="utf-8") as f:
            for line in f:
                yield line
    else:
        for line in sys.stdin:
            yield line


def main():
    # CLI args (handy for local testing)
    parser = argparse.ArgumentParser(
        description="Stream tcpdump output → parse → batch → ship to server."
    )
    parser.add_argument(
        "--from",
        dest="source",
        default=None,
        help="Optional path to a file containing tcpdump output (otherwise read from stdin).",
    )
    parser.add_argument(
        "--tee-jsonl",
        dest="tee_path",
        default=None,
        help="Optional path to also write parsed JSONL records locally for debugging.",
    )
    args = parser.parse_args()

    # Load config
    cfg = load_config()

    # Logging setup
    level = getattr(logging, cfg.log_level.upper(), logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s [stream]: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    log = logging.getLogger("stream")

    # Shipper wiring (matches your Config field names)
    ship = Shipper(
        server_url=cfg.server_url,
        api_key=cfg.api_key,
        batch_size=cfg.batch_max,
        flush_ms=cfg.batch_interval * 1000,  # seconds → ms
        timeout_s=cfg.heartbeat_sec,
        use_gzip=True,
    )

    # Optional local JSONL tee file for debugging
    tee_file = None
    if args.tee_path:
        tee_file = open(args.tee_path, "a", encoding="utf-8")
        log.info("Teeing parsed JSONL to %s", args.tee_path)

    # Graceful shutdown on SIGINT/SIGTERM
    signal.signal(signal.SIGINT, _signal_handler)
    signal.signal(signal.SIGTERM, _signal_handler)

    log.info(
        "Starting stream (endpoint_id=%s, iface=%s, server=%s)",
        cfg.endpoint_id,
        cfg.wlan_iface,
        cfg.server_url,
    )

    last_log = time.time()
    stats = {"seen": 0, "parsed": 0, "sent_enqueued": 0}

    try:
        for raw_line in _iter_lines(args.source):
            if not _RUNNING:
                break

            stats["seen"] += 1
            rec = parse_line(raw_line)
            if rec is None:
                # Skip unparseable/noise lines quietly at INFO level; DEBUG shows them.
                if log.isEnabledFor(logging.DEBUG):
                    log.debug("Skipped line: %r", raw_line.strip())
                continue

            stats["parsed"] += 1

            # Optional local tee for quick validation while developing
            if tee_file:
                tee_file.write(json.dumps(rec) + "\n")
                tee_file.flush()

            # Hand off to shipper (batching handled inside Shipper)
            ship.add(rec)
            stats["sent_enqueued"] += 1

            # Periodic progress log
            now = time.time()
            if now - last_log >= 5:
                log.info(
                    "seen=%d parsed=%d enqueued=%d (batch_max=%d, flush=%ds, hb=%ds)",
                    stats["seen"],
                    stats["parsed"],
                    stats["sent_enqueued"],
                    cfg.batch_max,
                    cfg.batch_interval,
                    cfg.heartbeat_sec,
                )
                last_log = now

        log.info("Stopping stream: flushing remaining records...")
        ship.flush()

    except Exception as e:
        log.exception("Fatal error in stream: %s", e)
        # Try to flush what we have before exiting
        try:
            ship.flush()
        except Exception:
            pass
        raise
    finally:
        if tee_file:
            tee_file.close()
        log.info("Stream stopped cleanly.")


if __name__ == "__main__":
    main()
