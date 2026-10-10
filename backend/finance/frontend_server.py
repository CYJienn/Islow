"""Local frontend preview with a finance API bridge; no build required."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import argparse
import json
import re

FRONTEND = Path(__file__).resolve().parents[2] / 'frontend'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(FRONTEND), **kw)

        def bridge(self):
            if self.headers.get('Host') not in (f'localhost:{args.port}', f'127.0.0.1:{args.port}'):
                self.send_error(403); return
            origin = self.headers.get('Origin')
            if origin and origin not in (f'http://localhost:{args.port}', f'http://127.0.0.1:{args.port}'):
                self.send_error(403); return
            path = self.path.removeprefix('/api/v1/finance/')
            if not re.fullmatch(r'(health|session|history|connections|runs|reports/report-[a-f0-9]{12}(?:/(?:approve|reject|review-start|distribute|files/(?:report.xlsx|report.json|dashboard.html|final-report.md)))?)', path):
                self.send_error(404); return
            try:
                size = int(self.headers.get('Content-Length', 0))
                if size < 0 or size > 10000:
                    self.send_error(413); return
                body = self.rfile.read(size) if self.command == 'POST' else None
                req = Request('http://127.0.0.1:8090/api/' + path, data=body, method=self.command,
                              headers={'Content-Type': 'application/json', 'X-Local-Token': self.headers.get('X-Local-Token', '')})
                try:
                    response = urlopen(req, timeout=180)
                except HTTPError as error:
                    response = error
                with response:
                    data = response.read()
                    self.send_response(response.code)
                    self.send_header('Content-Type', response.headers.get('Content-Type', 'application/json'))
                    self.send_header('Content-Length', str(len(data)))
                    self.send_header('Cache-Control', 'no-store')
                    if response.headers.get('Content-Disposition'):
                        self.send_header('Content-Disposition', response.headers['Content-Disposition'])
                    self.end_headers(); self.wfile.write(data)
            except Exception:
                data = json.dumps({'error': 'Finance service unavailable; start backend/finance/START.ps1'}).encode()
                self.send_response(503); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(data))); self.end_headers(); self.wfile.write(data)

        def do_GET(self):
            if self.path.startswith('/api/v1/finance/'):
                return self.bridge()
            return super().do_GET()

        def do_POST(self):
            if self.path.startswith('/api/v1/finance/'):
                return self.bridge()
            self.send_error(404)
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    print(f'Kaunter frontend: http://localhost:{args.port}', flush=True)
    try:
        server.serve_forever()
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
