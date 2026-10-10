"""Local-only backend API. No automatic approvals, sends or schedules."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
import argparse
import json
import mimetypes
import secrets

from service import Service, ReviewError, ROOT, configuration_status


def make_handler(service, token, port):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt, *args):
            # Requests never include credentials. Do not log request bodies or tokens.
            print(self.command, self.path.split('?')[0], flush=True)

        def valid_host(self):
            return self.headers.get("Host") in (f"127.0.0.1:{port}", f"localhost:{port}")

        def respond(self, status, payload, content_type="application/json; charset=utf-8", extra=None):
            if isinstance(payload, (dict, list)):
                payload = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode("utf-8")
            elif isinstance(payload, str):
                payload = payload.encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("X-Frame-Options", "DENY")
            self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'")
            for k, v in (extra or {}).items():
                self.send_header(k, v)
            self.end_headers()
            self.wfile.write(payload)

        def do_GET(self):
            if not self.valid_host():
                return self.respond(403, {"error": "Local host only"})
            path = urlparse(self.path).path
            try:
                if path == "/":
                    html = (ROOT / "report-template.html").read_text(encoding="utf-8").replace("__REPORT_JSON__", "null")
                    return self.respond(200, html, "text/html; charset=utf-8")
                if path == "/api/health":
                    return self.respond(200, {"status": "OK", "schedule_enabled": False, "mode": "LOCAL_MANUAL_TESTING"})
                if path == "/api/session":
                    return self.respond(200, {"local_token": token, "reviewer": service.config()["reviewer"]})
                if path == "/api/history":
                    return self.respond(200, service.history())
                if path == "/api/connections":
                    return self.respond(200, configuration_status())
                parts = path.strip("/").split("/")
                if len(parts) >= 3 and parts[:2] == ["api", "reports"]:
                    report_id = parts[2]
                    if len(parts) == 3:
                        return self.respond(200, service.report(report_id))
                    if len(parts) == 5 and parts[3] == "files" and parts[4] in ("report.xlsx", "report.json", "dashboard.html", "final-report.md"):
                        file = service.directory(report_id) / parts[4]
                        ctype = mimetypes.guess_type(file.name)[0] or "application/octet-stream"
                        return self.respond(200, file.read_bytes(), ctype, {"Content-Disposition": f'attachment; filename="{file.name}"'})
                return self.respond(404, {"error": "Not found"})
            except KeyError:
                return self.respond(404, {"error": "Report not found"})
            except (OSError, ValueError) as e:
                return self.respond(400, {"error": str(e)})

        def do_POST(self):
            if not self.valid_host() or not secrets.compare_digest(self.headers.get("X-Local-Token", ""), token):
                return self.respond(403, {"error": "Local session token required"})
            origin = self.headers.get("Origin")
            if origin and origin not in (f"http://127.0.0.1:{port}", f"http://localhost:{port}"):
                return self.respond(403, {"error": "Cross-origin mutation forbidden"})
            if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                return self.respond(415, {"error": "JSON body required"})
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if length < 0 or length > 10000:
                    return self.respond(413, {"error": "Request exceeds allowed size"})
                data = json.loads(self.rfile.read(length) or b"{}")
                if not isinstance(data, dict):
                    raise ValueError("JSON object required")
                path = urlparse(self.path).path
                if path == "/api/runs":
                    return self.respond(201, service.run())
                parts = path.strip("/").split("/")
                if len(parts) == 4 and parts[:2] == ["api", "reports"]:
                    rid, action = parts[2:]
                    if action == 'request-review':
                        return self.respond(200, service.request_outlook_review(rid, data.get('confirmation')))
                    if action == "review-start":
                        service.review_start(rid)
                        return self.respond(200, {"review_started": True})
                    if action in ("approve", "reject"):
                        return self.respond(200, service.decide(rid, data.get("report_digest"),
                                            "APPROVED" if action == "approve" else "REJECTED", data.get("confirmation")))
                    if action == "distribute":
                        if "retry_failed" in data and not isinstance(data["retry_failed"], bool):
                            raise ValueError("retry_failed must be boolean")
                        return self.respond(200, service.distribute(rid, data.get("confirmation"), data.get("retry_failed", False)))
                return self.respond(404, {"error": "Not found"})
            except KeyError:
                return self.respond(404, {"error": "Report not found"})
            except (ReviewError, ValueError, OSError) as e:
                return self.respond(409, {"error": str(e)})
            except Exception:
                return self.respond(500, {"error": "Processing failed; inspect the persisted run history"})

    return Handler


def main():
    from environment import load_environment
    load_environment()
    parser = argparse.ArgumentParser(description="Invoice assurance backend, manual mode")
    parser.add_argument("command", choices=("run", "serve", "status", "connections"), nargs="?", default="serve")
    parser.add_argument("--config", type=Path, default=ROOT / "config.json")
    parser.add_argument("--state", type=Path, default=ROOT / "state")
    parser.add_argument("--port", type=int, default=8090)
    args = parser.parse_args()
    if args.command == "connections":
        print(json.dumps(configuration_status(), indent=2)); return
    service = Service(args.config, args.state)
    if args.command == "run":
        result = service.run()
        report = service.report(result["report_id"])
        print(json.dumps({**result, "summary": report["summary"], "directory": str(service.directory(result["report_id"]))}, indent=2)); return
    if args.command == "status":
        print(json.dumps(service.history(), indent=2)); return
    token = secrets.token_urlsafe(32)
    httpd = ThreadingHTTPServer(("127.0.0.1", args.port), make_handler(service, token, args.port))
    from telegram_review import start_listener
    start_listener(service)
    print(f"Invoice assurance: http://127.0.0.1:{args.port} (manual mode; scheduling disabled)", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
