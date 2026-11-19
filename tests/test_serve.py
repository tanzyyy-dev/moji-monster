import http.server
import os
import sys
import threading
import time
import unittest
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import serve


class DelayHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/slow":
            time.sleep(0.5)
        body = b"ok"
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        return


class TestServeConcurrency(unittest.TestCase):
    def test_threading_server_handles_concurrent_requests(self):
        server = serve.create_server("127.0.0.1", 0, DelayHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            port = server.server_port
            results = {}

            def fetch(name):
                started = time.monotonic()
                with urllib.request.urlopen(
                    "http://127.0.0.1:{}/slow".format(port)
                ) as response:
                    results[name] = response.status
                results[name + "_elapsed"] = time.monotonic() - started

            first = threading.Thread(target=fetch, args=("first",))
            second = threading.Thread(target=fetch, args=("second",))
            started = time.monotonic()
            first.start()
            second.start()
            first.join()
            second.join()
            total = time.monotonic() - started

            self.assertEqual(results["first"], 200)
            self.assertEqual(results["second"], 200)
            # Threaded handling should finish near 0.5s, not 1.0s.
            self.assertLess(total, 0.9)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
