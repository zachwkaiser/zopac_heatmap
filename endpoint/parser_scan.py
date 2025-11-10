import re
import sys
import json
import argparse

# initializing what the re library will be searching for within each line of the scan data
TS_RE = re.compile(r"^(\d+\.\d{3,})")
RSSI_RE = re.compile(r"(-?\d{1,3})dBm signal")
MAC_TA = re.compile(r"\bTA:([0-9A-Fa-f:]{17})\b")
MAC_SA = re.compile(r"\bSA:([0-9A-Fa-f:]{17})\b")


def normal_mac(m):
    """This function normalizes the MAC address to be all lowercase letters."""
    return m.lower()


def parse_line(line: str) -> dict:
    """This function uses the re library to find patterns within the scan data to identify the time stamp (ts), rssi, and mac ID. All three items must be present in the scan for this function to transcribe the
    data to the .json file.

    Args:
        line (str): One line of data that was captured by the shell script. Refer to README table to see the information captured within one line.

    Returns:
        dict: A dictionary containing the mac, rssi, and timestamp from each line.
    """
    ts_match = TS_RE.search(line)
    rssi_match = RSSI_RE.search(line)
    mac_match = MAC_TA.search(line) or MAC_SA.search(line)

    if not (ts_match and rssi_match and mac_match):
        return None

    # The actual values being written the the json file
    ts = float(ts_match.group(1))
    rssi = int(rssi_match.group(1))
    mac = normal_mac(mac_match.group(1))
    return {"mac": mac, "rssi": rssi, "timestamp": ts}


# CLI driver
def _iter_lines(source_path: str | None):
    """This function iterates through each line of the input provided to the script.

    Yields:
        str: One line of input data at a time.
    """
    if source_path:
        with open(source_path, "r", encoding="utf-8") as f:
            yield from f
    else:
        for line in sys.stdin:
            yield line


def main():
    """This is the main function that drives the script. It collects each line of input data, parses it, and writes the relevant information to a .json file."""
    parser = argparse.ArgumentParser(
        description="Parse tcpdump output to JSONL (mac, rssi, ts)."
    )
    parser.add_argument("--from", dest="source", default=None)
    parser.add_argument("--out", dest="out_path", default="-")
    args = parser.parse_args()

    out = (
        sys.stdout
        if args.out_path == "-"
        else open(args.out_path, "w", encoding="utf-8")
    )
    try:
        for line in _iter_lines(args.source):
            record = parse_line(line)
            if record is None:
                continue
            out.write(json.dumps(record) + "\n")
            out.flush()
    finally:
        if out is not sys.stdout:
            out.close()


if __name__ == "__main__":
    main()
