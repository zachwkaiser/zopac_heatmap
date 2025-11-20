#!/usr/bin/env python3
"""
Periodic heartbeat sender for the WiFi endpoint.

Reads config from .env via load_config(), builds a proper status URL from the
base SERVER_URL, and POSTs a small JSON heartbeat on a fixed interval.
"""

import sys
import time
import socket
import requests
from urllib.parse import urljoin
from config import load_config


def build_status_url(base_url: str) -> str:
    # Ensure a single trailing slash, then join the route safely
    base = base_url.rstrip("/") + "/"
    return urljoin(base, "api/endpoint/status")


def make_headers(api_key: str) -> dict:
    return {
        "Content-Type": "application/json",
        "x-api-key": api_key,  # must match your server’s auth
        "User-Agent": "WiFiEndpoint/1.0 status",
    }


def build_payload(endpoint_id: str) -> dict:
    return {
        "endpoint_id": endpoint_id,
        "status": "online",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "hostname": socket.gethostname(),
    }


def try_send(url: str, headers: dict, payload: dict, timeout_s: int = 10):
    r = requests.post(url, json=payload, headers=headers, timeout=timeout_s)
    ok = 200 <= r.status_code < 300
    return ok, r.status_code, ("" if ok else (r.text[:500] or ""))


def main():
    # Load config (validates base URL, API key, etc.)
    try:
        cfg = load_config()
    except Exception as e:
        print(f"[HEARTBEAT] Config error: {e}", file=sys.stderr)
        sys.exit(1)

    status_url = build_status_url(cfg.server_url)
    headers = make_headers(cfg.api_key)
    interval = int(getattr(cfg, "heartbeat_sec", 300))  # default 5 min if missing

    print(f"[HEARTBEAT] Posting to {status_url} every {interval} sec")

    # Boot phase: retry every 60s until the first success
    while True:
        try:
            ok, code, body = try_send(
                status_url, headers, build_payload(cfg.endpoint_id)
            )
            if ok:
                print(f"[HEARTBEAT] Initial status sent ({code}).")
                break
            else:
                print(
                    f"[HEARTBEAT] Server responded {code}: {body} ... retrying in 60s"
                )
        except requests.RequestException as e:
            print(f"[HEARTBEAT] Network error: {e} ... retrying in 60s")
        time.sleep(60)

    # Steady-state: send every interval; on failure, retry after 60s until success, then resume schedule
    while True:
        time.sleep(interval)
        while True:
            try:
                ok, code, body = try_send(
                    status_url, headers, build_payload(cfg.endpoint_id)
                )
                if ok:
                    print(f"[HEARTBEAT] Sent ({code}). Next in {interval} sec.")
                    break
                else:
                    print(f"[HEARTBEAT] Server {code}: {body} ... retry in 60s")
            except requests.RequestException as e:
                print(f"[HEARTBEAT] Network error: {e} ... retry in 60s")
            time.sleep(60)


if __name__ == "__main__":
    main()
