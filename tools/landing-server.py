"""Local stand-in for the production host: the landing page at / and the Crew Console at /app/.

`python3 -m http.server` returns 404 for a deep link such as /app/cabin or a refresh on /app/board, because the console is
a single-page app. Production (vercel.json / netlify.toml) rewrites /app/* to /app/index.html; this does the same.

    python3 tools/landing-server.py [port]      # default 5180, serves ./landing
"""
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'landing')


class Handler(SimpleHTTPRequestHandler):
    def send_head(self):
        path = self.translate_path(self.path.split('?', 1)[0].split('#', 1)[0])
        url = self.path.split('?', 1)[0]
        # an app route (no file extension, nothing on disk): the console's own router takes it from here
        if url.startswith('/app/') and not os.path.exists(path) and '.' not in os.path.basename(url):
            self.path = '/app/index.html'
        return super().send_head()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5180
    server = ThreadingHTTPServer(('', port), partial(Handler, directory=ROOT))
    print(f'landing + console on http://localhost:{port}/ (app routes fall back to /app/index.html)')
    server.serve_forever()
