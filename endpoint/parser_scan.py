from config import Config
from scan_extract import parse_line
from shipper import Shipper


def stream(stdin):
    """This function reads each line of the scan data as it is being captured by the shell script. 

    Args:
        stdin: The standard input stream that is being piped from the shell script.
    """
    ship = Shipper(
        server_url=Config.SERVER_URL,
        api_key=Config.API_KEY,
        batch_size=Config.BATCH_SIZE,
        flush_ms=Config.FLUSH_MS,
        timeout_s=Config.TIMEOUT_S,
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