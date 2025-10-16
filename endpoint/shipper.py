import json
import gzip
import time
import threading
import queue
import requests

class Shipper:
    def __init__(self, server_url, api_key, batch_size, flush_ms, timeout_s, use_gzip=True):
        self.url = server_url
        self.batch_size = batch_size
        self.flush_ms = flush_ms/1000.0
        self.timeout = timeout_s
        self.use_gzip = use_gzip
        self.q = queue.Queue(maxsize=5000)
        self.stop_evt = threading.Event()
        self.sess = requests.Session()
        self.headers = {"Accept":"application/json","Content-Type":"application/json"}
        if api_key: self.headers["Authorization"] = f"Bearer {api_key}"
        if use_gzip: self.headers["Content-Encoding"] = "gzip"

    def start(self):
        self.thread = threading.Thread(target=self._loop, daemon=True)          #._loop vs .run
        self.thread.start()

    def enqueue(self, rec: dict):
        self.q.put(rec, timeout=1)

    def stop(self):
        self.stop_evt.set()
        self.thread.join(timeout=10)
    
    def _post(self, records):
        if not self.url or not records: return True
        body = json.dumps({"records": records}).encode()
        data = gzip.compress(body) if self.use_gzip else body
        backoff = 0.5
        for _ in range(5):
            try:
                r = self.sess.post(self.url, data=data, headers=self.headers, timeout=self.timeout)
                if 200 <= r.status_code < 300: return True
                if r.status_code not in (429,500,502,503,504): return False
            except requests.RequestException:
                pass
            time.sleep(backoff); backoff = min(2*backoff, 8.0)
        return False
    
    def _loop(self):
        batch, last = [], time.time()
        while not self.stop_evt.is_set() or not self.q.empty():
            timeout = max(0.0, self.flush_ms - (time.time() - last))
            try:
                item = self.q.get(timeout=timeout); batch.append(item)
            except queue.Empty:
                pass
            if batch and (len(batch) >= self.batch_size or (time.time()-last) >= self.flush_ms):
                self._post(batch); batch.clear(); last = time.time()
        if batch:
            self._post(batch)