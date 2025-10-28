#!/usr/bin/env python3
"""
start_at_time.py

Usage:
  sudo python3 start_at_time.py --time 2025-10-25T12:00:00Z \
       --iface wlan1 --logdir /home/pi/WiFi_Project/logs --channel 6

The script expects capture_wifi.sh to be next to it or give full path to it.
"""

import argparse
import datetime
import os
import subprocess
import sys
import time


def is_ntp_synced():
    # Returns True if system clock is synchronized (timedatectl show -p NTPSynchronized)
    try:
        out = subprocess.check_output(
            ["timedatectl", "show", "-p", "NTPSynchronized"], text=True
        ).strip()
        return out.split("=")[1].lower() == "yes"
    except Exception:
        return False


def parse_time(tstr):
    # Accept ISO 8601 UTC with trailing Z
    try:
        if tstr.endswith("Z"):
            tstr = tstr[:-1]
        # parse without timezone as UTC
        return datetime.datetime.fromisoformat(tstr).replace(
            tzinfo=datetime.timezone.utc
        )
    except Exception as e:
        raise ValueError(
            f"Invalid time format: {tstr} -- use YYYY-MM-DDTHH:MM:SSZ"
        ) from e


def wait_until(target_dt, check_ntp=True, ntp_timeout=60):
    now = datetime.datetime.now(datetime.timezone.utc)
    if check_ntp:
        start = time.time()
        while not is_ntp_synced():
            if time.time() - start > ntp_timeout:
                print(
                    "Warning: NTP not synced after timeout; proceeding anyway.",
                    flush=True,
                )
                break
            print("Waiting for NTP sync...", flush=True)
            time.sleep(2)
    now = datetime.datetime.now(datetime.timezone.utc)
    delta = (target_dt - now).total_seconds()
    if delta <= 0:
        print("Target time is in the past or now; starting immediately.", flush=True)
        return
    print(
        f"Sleeping until target UTC time {target_dt.isoformat()} (sleep {int(delta)}s)...",
        flush=True,
    )
    # Sleep in chunks so we can print progress
    while delta > 0:
        chunk = min(delta, 60)
        time.sleep(chunk)
        now = datetime.datetime.now(datetime.timezone.utc)
        delta = (target_dt - now).total_seconds()
    print("Reached target time.", flush=True)


def launch_capture(capture_script, iface, logdir, channel=None):
    os.makedirs(logdir, exist_ok=True)
    ts = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d_%H%M%S")
    outfile = os.path.join(logdir, f"capture_{iface}_{ts}.log")
    cmd = ["/bin/bash", capture_script, iface, logdir]
    if channel is not None:
        cmd.append(str(channel))  # <- actually pass channel
    print("Launching capture script:", " ".join(cmd), flush=True)
    with open(outfile, "wb") as out:
        p = subprocess.Popen(["sudo"] + cmd, stdout=out, stderr=subprocess.STDOUT)
    print(f"Started capture (pid={p.pid}), logging to {outfile}", flush=True)
    return p


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--time", required=True, help="Target UTC time (ISO) e.g. 2025-10-25T12:00:00Z"
    )
    parser.add_argument(
        "--capture-script",
        default="/home/pi/WiFi_Project/capture_wifi.sh",  # safer absolute path
        help="Path to capture script",
    )
    parser.add_argument("--iface", default="wlan1", help="Wireless interface")
    parser.add_argument(
        "--logdir", default="/home/pi/WiFi_Project/logs", help="Directory for logs"
    )
    parser.add_argument(
        "--channel", default=None, help="Channel to set before capture (optional)"
    )
    parser.add_argument(
        "--duration-sec",
        type=int,
        default=0,  # <- add this line
        help="Auto-stop after N seconds (optional)",
    )
    parser.add_argument(
        "--no-ntp-check", action="store_true", help="Do not wait for NTP sync"
    )
    args = parser.parse_args()

    try:
        target = parse_time(args.time)
    except ValueError as e:
        print(e, file=sys.stderr)
        sys.exit(2)

    check_ntp = not args.no_ntp_check
    wait_until(target, check_ntp=check_ntp)
    _ = launch_capture(
        args.capture_script, args.iface, args.logdir, channel=args.channel
    )

    if args.duration_sec and args.duration_sec > 0:
        print(f"Running for {args.duration_sec} seconds...", flush=True)
        time.sleep(args.duration_sec)
        subprocess.run(["sudo", "pkill", "tcpdump"])
        print("Auto-stopped capture.", flush=True)


if __name__ == "__main__":
    main()
