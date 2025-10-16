from config import load_config
from scan_extract import parse_line
from shipper import Shipper


def stream(stdin):
    """This function reads each line of the scan data as it is being captured by the shell script. 

    Args:
        stdin: The standard input stream that is being piped from the shell script.
    """
    cfg = load_config()

    ship = Shipper(
        server_url=cfg.server_URL,
        api_key=cfg.api_key,
        batch_size=cfg.batch_max,
        flush_ms=cfg.batch_interval * 1000,       # convert seconds → milliseconds
        timeout_s=cfg.heartbeat_sec,
        use_gzip=True
        )
    
    metrics = {"seen":0,"emitted":0,"skipped_no_match":0}
    ship.start()
    for line in stdin:
        metrics["seen"] += 1
        rec = parse_line(line)
        if not rec:
            metrics["skipped_no_match"] += 1
            continue
        ship.enqueue(rec)
        metrics["emitted"] += 1
    ship.stop()  # flush & join
    print(metrics)