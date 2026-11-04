"""POST /api/ask  { question, history?: [{ role: 'user'|'assistant', text }], page? }
-> { text, citations: [{label,url}], actions: [{label,kind,target}], source: 'live' }
503 when ANTHROPIC_API_KEY is not set; the browser client then answers offline. See docs/vita.md.
"""
import json
import os
import sys
from http.server import BaseHTTPRequestHandler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _vita import Vita  # noqa: E402

_vita = Vita()


class handler(BaseHTTPRequestHandler):
    def _send(self, status, extra, body):
        data = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        for k, v in extra.items():
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _run(self, method):
        headers = {k.lower(): v for k, v in self.headers.items()}
        try:
            n = int(headers.get("content-length") or 0)
        except ValueError:
            n = 0
        raw = self.rfile.read(min(n, 17_000)) if n and method == "POST" else b""
        self._send(*_vita.handle(method, headers, raw))

    def do_POST(self):
        self._run("POST")

    def do_GET(self):
        self._run("GET")

    do_PUT = do_DELETE = do_PATCH = do_GET

    def log_message(self, *args):  # no request logging
        pass
