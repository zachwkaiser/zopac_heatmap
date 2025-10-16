import re

# initializing what the re library will be searching for within each line of the scan data
TS_RE   = re.compile(r'^(\d+\.\d{3,})')
RSSI_RE = re.compile(r'(-?\d{1,3})dBm signal')
MAC_TA  = re.compile(r'\bTA:([0-9A-Fa-f:]{17})\b')
MAC_SA  = re.compile(r'\bSA:([0-9A-Fa-f:]{17})\b')

def normal_mac(m):
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
    return {
        "mac": mac,
        "rssi": rssi,
        "ts" : ts
    }