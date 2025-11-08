#!/usr/bin/env python3
import json
import socket
import time
import requests
from config import Config  # your existing Config dataclass

STATUS_URL = f"{Config.server_url}/api/endpoint/status"
HEADERS = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {Config.api_key}",
}

def payload():
    return {
        "endpoint_id": Config.endpoint_id,
        "status": "online",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "hostname": socket.gethostname(),
    }

def try_send():
    r = requests.post(STATUS_URL, json=payload(), headers=HEADERS, timeout=10)
    return 200 <= r.status_code < 300, r.status_code

def main():
    # Boot phase: retry every 60s until first success
    while True:
        try:
            ok, code = try_send()
            if ok:
                print(f"[HEARTBEAT] Initial status sent ({code}).")
                break
            else:
                print(f"[HEARTBEAT] Server responded {code}; retrying in 60s...")
        except requests.RequestException as e:
            print(f"[HEARTBEAT] Network error: {e}; retrying in 60s...")
        time.sleep(60)

    # Steady-state: send every 5 minutes; if a send fails, retry after 60s,
    # then resume the 5-minute schedule on the next success.
    while True:
        time.sleep(300)  # 5 minutes
        while True:
            try:
                ok, code = try_send()
                if ok:
                    print(f"[HEARTBEAT] Sent ({code}). Next in 5 min.")
                    break
                else:
                    print(f"[HEARTBEAT] Server {code}; retry in 60s...")
            except requests.RequestException as e:
                print(f"[HEARTBEAT] Network error: {e}; retry in 60s...")
            time.sleep(60)

if __name__ == "__main__":
    main()
