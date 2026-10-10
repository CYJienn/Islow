"""Persistent reports, exact-snapshot review and separately tracked notification channels."""
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock
import base64
import json
import os
import re
import sqlite3
import subprocess
import time
import urllib.error
import urllib.request
import uuid

from engine import canonical, digest, file_hash, now, run_analysis

ROOT = Path(__file__).resolve().parent
DEFAULT_NODE = Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe"


class ReviewError(ValueError):
    pass


def destinations():
    recipients = [r.strip() for r in os.environ.get("OUTLOOK_RECIPIENTS", "").split(",") if r.strip()]
    if any(not re.fullmatch(r"[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+", r) for r in recipients):
        raise ReviewError("Invalid OUTLOOK_RECIPIENTS configuration")
    return {"outlook": sorted(set(recipients)), "telegram": os.environ.get("TELEGRAM_CHAT_ID", "").strip()}


def configuration_status():
    target = destinations()
    return {"outlook": {"configured": bool(os.environ.get("MICROSOFT_OUTLOOK_TOKEN") and target["outlook"]),
                        "recipients": target["outlook"], "connection": "NOT_LIVE_VERIFIED"},
            "telegram": {"configured": bool(os.environ.get("TELEGRAM_BOT_TOKEN") and target["telegram"]),
                         "chat_id": target["telegram"], "connection": "NOT_LIVE_VERIFIED"},
            "schedule_enabled": False}


def post_json(url, payload, headers=None):
    req = urllib.request.Request(url, canonical(payload).encode("utf-8"),
                                 {"Content-Type": "application/json", **(headers or {})}, method="POST")
    with urllib.request.urlopen(req, timeout=25) as response:
        return response.status, response.read()


class Service:
    def __init__(self, config=None, state=None, exporter=None, transport=None):
        self.config_path = Path(config or ROOT / "config.json").resolve()
        self.state = Path(state or ROOT / "state").resolve()
        self.state.mkdir(parents=True, exist_ok=True)
        self.db_path = self.state / "assurance.sqlite3"
        self.lock = RLock()
        self.exporter = exporter or self.export_xlsx
        self.transport = transport or post_json
        with self.db() as db:
            db.executescript("""
            CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,fingerprint TEXT,status TEXT,started_at TEXT,finished_at TEXT,error TEXT,report_id TEXT);
            CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY,fingerprint TEXT UNIQUE,payload TEXT,artifacts TEXT,report_digest TEXT,created_at TEXT,review_started_at TEXT);
            CREATE TABLE IF NOT EXISTS cases(report_id TEXT,case_id TEXT,payload TEXT,PRIMARY KEY(report_id,case_id));
            CREATE TABLE IF NOT EXISTS approvals(id INTEGER PRIMARY KEY,report_id TEXT,report_digest TEXT,destination_digest TEXT,decision TEXT,reviewer TEXT,at TEXT,review_seconds REAL);
            CREATE TABLE IF NOT EXISTS deliveries(report_id TEXT,channel TEXT,destination_digest TEXT,status TEXT,attempts INTEGER,at TEXT,message_id TEXT,error TEXT,PRIMARY KEY(report_id,channel,destination_digest));
            CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,report_id TEXT,event TEXT,at TEXT,detail TEXT);
            """)
            # A process may die between sending and recording the response. Never blindly resend.
            db.execute("UPDATE deliveries SET status='UNCERTAIN',error='Previous process stopped during delivery' WHERE status='IN_FLIGHT'")
            db.execute("UPDATE runs SET status='FAILED',finished_at=?,error='Previous process stopped during processing; retry allowed' WHERE status='RUNNING'", (now(),))

    @contextmanager
    def db(self):
        db = sqlite3.connect(self.db_path, timeout=30)
        db.row_factory = sqlite3.Row
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    def config(self):
        config = json.loads(self.config_path.read_text(encoding="utf-8-sig"))
        # Relative inputs belong to the configuration directory, not the shell cwd.
        def resolve_input(value):
            path = Path(os.path.expandvars(value)).expanduser()
            return str((self.config_path.parent / path).resolve())
        config["workbook"] = resolve_input(os.environ.get('ONEDRIVE_WORKBOOK') or config["workbook"])
        config["reference_documents"] = [resolve_input(p) for p in config.get("reference_documents", [])]
        folder = os.environ.get('INVOICE_INPUT_DIR') or config.get('invoice_input_dir')
        if folder:
            config['invoice_input_dir'] = resolve_input(folder)
        config['onedrive_account'] = os.environ.get('ONEDRIVE_ACCOUNT', '').strip()
        if config.get("schedule_enabled"):
            raise ReviewError("Scheduling is intentionally disabled during manual validation")
        return config

    def source_fingerprint(self, config):
        paths = [config["workbook"]] + config.get("reference_documents", [])
        if config.get('invoice_input_dir'):
            folder = Path(config['invoice_input_dir'])
            if not folder.is_dir():
                raise ReviewError('Invoice input directory is unavailable')
            paths += [str(p) for p in sorted(folder.iterdir()) if p.is_file()]
        sources = [{"path": str(Path(p).resolve()), "sha256": file_hash(p)} for p in paths]
        # Code changes invalidate reuse; source text never selects rules.
        code = {p.name: file_hash(p) for p in ROOT.glob("*.py") if not p.name.startswith("test_")}
        code["export.mjs"] = file_hash(ROOT / "export.mjs")
        code["report-template.html"] = file_hash(ROOT / "report-template.html")
        return digest({"config": config, "sources": sources, "code": code})

    def export_xlsx(self, payload_path, output_path):
        node = Path(os.environ.get("ASSURANCE_NODE", str(DEFAULT_NODE)))
        if not node.is_file():
            raise ReviewError("Configure ASSURANCE_NODE to a Node runtime with @oai/artifact-tool")
        result = subprocess.run([str(node), str(ROOT / "export.mjs"), str(payload_path), str(output_path)],
                                cwd=ROOT, capture_output=True, text=True, encoding="utf-8", timeout=180)
        if result.returncode:
            # Return only bounded diagnostic output; process contains no credential configuration.
            raise ReviewError("Excel generation failed: " + result.stderr[-1200:])

    def run(self):
        with self.lock:
            config = self.config()
            started = time.perf_counter()
            run_id = "run-" + uuid.uuid4().hex[:12]
            with self.db() as db:
                db.execute("INSERT INTO runs VALUES(?,NULL,'RUNNING',?,NULL,NULL,NULL)", (run_id, now()))
            try:
                fingerprint = self.source_fingerprint(config)
                with self.db() as db:
                    existing = db.execute("SELECT id FROM reports WHERE fingerprint=?", (fingerprint,)).fetchone()
                if existing:
                    # Reuse only an intact snapshot; edited reports never keep their approvals.
                    try:
                        self.verify(existing["id"])
                    except ReviewError:
                        with self.db() as db:
                            db.execute("UPDATE reports SET fingerprint=? WHERE id=?", ("invalidated:" + uuid.uuid4().hex, existing["id"]))
                            db.execute("INSERT INTO events(report_id,event,at,detail) VALUES(?,'INVALIDATED',?,?)", (existing["id"], now(), "Snapshot or source changed"))
                    else:
                        with self.db() as db:
                            db.execute("UPDATE runs SET fingerprint=?,status='REUSED',finished_at=?,report_id=? WHERE id=?", (fingerprint, now(), existing["id"], run_id))
                        from approved_export import write_checked_invoices
                        write_checked_invoices(self.report(existing['id']), self.state.parent / 'finance_export.json')
                        from telegram_review import notify
                        telegram_notice = notify(self, existing['id'])
                        return {"run_id": run_id, "report_id": existing["id"], "reused": True,
                                "telegram_review": telegram_notice,
                                "outlook_review_alert": self.review_alert_if_configured(existing['id'])}
                payload = run_analysis(config)
                if fingerprint != self.source_fingerprint(config):
                    raise ReviewError("Source/configuration changed while processing; rerun required")
                report_id = "report-" + uuid.uuid4().hex[:12]
                payload.update({"report_id": report_id, "version": 1, "reviewer": config["reviewer"],
                                "timezone": config["timezone"], "source_fingerprint": fingerprint,
                                "processing_seconds": round(time.perf_counter() - started, 3),
                                "distribution_status": "DRAFT_REQUIRES_HUMAN_APPROVAL"})
                directory = self.state / "reports" / report_id
                directory.mkdir(parents=True)
                payload_path = directory / "report.json"
                payload_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False), encoding="utf-8")
                template = (ROOT / "report-template.html").read_text(encoding="utf-8")
                embedded = canonical(payload).replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
                (directory / "dashboard.html").write_text(template.replace("__REPORT_JSON__", embedded), encoding="utf-8")
                self.exporter(payload_path, directory / "report.xlsx")
                from final_report import markdown
                (directory / 'final-report.md').write_text(markdown(payload), encoding='utf-8')
                artifacts = {name: file_hash(directory / name) for name in ("report.json", "dashboard.html", "report.xlsx", "final-report.md")}
                report_digest = digest({"report_id": report_id, "version": 1, "artifacts": artifacts})
                if fingerprint != self.source_fingerprint(config):
                    raise ReviewError("Source/configuration changed while creating report; rerun required")
                with self.db() as db:
                    db.execute("INSERT INTO reports VALUES(?,?,?,?,?,?,NULL)", (report_id, fingerprint, canonical(payload), canonical(artifacts), report_digest, now()))
                    db.executemany("INSERT INTO cases VALUES(?,?,?)", [(report_id, c["case_id"], canonical(c)) for c in payload["cases"]])
                    db.execute("INSERT INTO events(report_id,event,at,detail) VALUES(?,'DRAFT_CREATED',?,?)", (report_id, now(), f"{len(payload['cases'])} cases reconciled"))
                    db.execute("UPDATE runs SET fingerprint=?,status='COMPLETE',finished_at=?,report_id=? WHERE id=?", (fingerprint, now(), report_id, run_id))
                from approved_export import write_checked_invoices
                export_path = write_checked_invoices(payload, self.state.parent / 'finance_export.json')
                handoff = {"event": "REPORT_GENERATED", "recipient": "orchestrator",
                           "report_id": report_id, "version": 1, "report_digest": report_digest,
                           "status": "DRAFT_REQUIRES_HUMAN_APPROVAL", "created_at": now(),
                           "artifacts": {name: str(directory / name) for name in artifacts},
                           "delivery_status": "PENDING_WORKBUDDY_DISPATCH",
                           "next_action": "Review this exact report before approving distribution"}
                outbox = self.state / "orchestrator-outbox"
                outbox.mkdir(exist_ok=True)
                (outbox / (report_id + '.json')).write_text(canonical(handoff), encoding='utf-8')
                from telegram_review import notify
                telegram_notice = notify(self, report_id)
                return {"run_id": run_id, "report_id": report_id, "reused": False,
                        "telegram_review": telegram_notice,
                        "orchestrator_handoff": str(outbox / (report_id + '.json')),
                        "finance_export": export_path,
                        "outlook_review_alert": self.review_alert_if_configured(report_id)}
            except Exception as e:
                with self.db() as db:
                    db.execute("UPDATE runs SET status='FAILED',finished_at=?,error=? WHERE id=?", (now(), str(e)[:1600], run_id))
                raise

    def row(self, report_id):
        with self.db() as db:
            row = db.execute("SELECT * FROM reports WHERE id=?", (report_id,)).fetchone()
        if row is None:
            raise KeyError("Report not found")
        return dict(row)

    def directory(self, report_id):
        self.row(report_id)
        return self.state / "reports" / report_id

    def verify(self, report_id):
        row = self.row(report_id)
        for name, expected in json.loads(row["artifacts"]).items():
            path = self.state / "reports" / report_id / name
            if not path.is_file() or file_hash(path) != expected:
                raise ReviewError("Report snapshot changed: approval invalidated; regenerate report")
        if row["fingerprint"] != self.source_fingerprint(self.config()):
            raise ReviewError("Source or configuration changed: regenerate and review a new report")
        return row

    def report(self, report_id):
        row = self.row(report_id)
        payload = json.loads(row["payload"])
        with self.db() as db:
            decision = db.execute("SELECT decision,reviewer,at,review_seconds,report_digest,destination_digest FROM approvals WHERE report_id=? ORDER BY id DESC LIMIT 1", (report_id,)).fetchone()
            deliveries = [dict(r) for r in db.execute("SELECT channel,status,attempts,at,error,message_id FROM deliveries WHERE report_id=?", (report_id,))]
        try:
            self.verify(report_id)
            valid = True
        except (ReviewError, OSError):
            valid = False
        approved = bool(valid and decision and decision["decision"] == "APPROVED" and
                        decision["report_digest"] == row["report_digest"] and decision["destination_digest"] == digest(destinations()))
        return {**payload, "report_digest": row["report_digest"], "snapshot_valid": valid,
                "notification_flow": self.config().get('notification_flow', 'both_channels_after_approval'),
                "outlook_enabled": self.config().get('outlook_enabled', True),
                "input_locations": {k: self.config().get(k, '') for k in ('workbook', 'invoice_input_dir', 'onedrive_account')},
                "approved_for_distribution": approved, "last_decision": dict(decision) if decision else None,
                "deliveries": deliveries, "destinations": destinations()}

    def history(self):
        with self.db() as db:
            runs = [dict(r) for r in db.execute("SELECT * FROM runs ORDER BY started_at DESC LIMIT 50")]
            reports = [dict(r) for r in db.execute("SELECT id,created_at,report_digest FROM reports ORDER BY created_at DESC LIMIT 50")]
        return {"runs": runs, "reports": reports}

    def review_start(self, report_id):
        self.verify(report_id)
        with self.db() as db:
            db.execute("UPDATE reports SET review_started_at=COALESCE(review_started_at,?) WHERE id=?", (now(), report_id))

    def decide(self, report_id, report_digest, decision, confirmation):
        with self.lock:
            row = self.verify(report_id)
            if report_digest != row["report_digest"]:
                raise ReviewError("Report digest does not match the reviewed version")
            if decision not in ("APPROVED", "REJECTED"):
                raise ReviewError("Invalid review decision")
            phrase = ("APPROVE DISTRIBUTION " if decision == "APPROVED" else "REJECT DISTRIBUTION ") + report_id
            if confirmation != phrase:
                raise ReviewError("Explicit report-specific human confirmation is required")
            elapsed = None
            if row["review_started_at"]:
                elapsed = max(0, (datetime.now(timezone.utc) - datetime.fromisoformat(row["review_started_at"])).total_seconds())
            with self.db() as db:
                db.execute("INSERT INTO approvals(report_id,report_digest,destination_digest,decision,reviewer,at,review_seconds) VALUES(?,?,?,?,?,?,?)",
                           (report_id, report_digest, digest(destinations()), decision, self.config()["reviewer"], now(), elapsed))
                db.execute("INSERT INTO events(report_id,event,at,detail) VALUES(?,?,?,?)", (report_id, decision, now(), "Report distribution decision only"))
            if decision == 'APPROVED' and self.config().get('email_alert_on_approval') and configuration_status()['outlook']['configured']:
                self.request_outlook_review(report_id, 'REQUEST REVIEW ' + report_id, event='approval')
            return self.report(report_id)

    def distribute(self, report_id, confirmation, retry_failed=False):
        with self.lock:
            self.verify(report_id)
            report = self.report(report_id)
            if not report["approved_for_distribution"]:
                raise ReviewError("Exact-snapshot human approval is required before distribution")
            if confirmation != "SEND " + report_id:
                raise ReviewError("Explicit report-specific send confirmation is required")
            target = destinations()
            target_hash = digest(target)
            channels = ('telegram',) if self.config().get('notification_flow') in ('outlook_review_then_telegram', 'telegram_only') else ('outlook', 'telegram')
            if self.config().get('telegram_attach_report'):
                channels = channels + ('telegram_document',)
            for channel in channels:
                with self.db() as db:
                    previous = db.execute("SELECT * FROM deliveries WHERE report_id=? AND channel=? AND destination_digest=?", (report_id, channel, target_hash)).fetchone()
                if previous and previous["status"] in ("ACCEPTED", "SENT_TO_TELEGRAM", "UNCERTAIN", "IN_FLIGHT"):
                    continue
                if previous and not retry_failed and previous["status"] != "NOT_CONFIGURED":
                    continue
                ready = configuration_status()['telegram' if channel == 'telegram_document' else channel]["configured"]
                if not ready:
                    self.delivery_record(report_id, channel, target_hash, "NOT_CONFIGURED", previous["attempts"] if previous else 0,
                                         error="Configure credentials and destinations, then review approval binding")
                    continue
                attempts = (previous["attempts"] if previous else 0) + 1
                self.delivery_record(report_id, channel, target_hash, "IN_FLIGHT", attempts)
                try:
                    status, message_id = self.send(channel, report, target)
                    self.delivery_record(report_id, channel, target_hash, status, attempts, message_id=message_id)
                except urllib.error.HTTPError as e:
                    status = "AUTH_FAILED" if e.code in (401, 403) else "FAILED"
                    self.delivery_record(report_id, channel, target_hash, status, attempts,
                                         error=f"HTTP {e.code}; reconnect or correct configuration before explicit retry")
                except Exception:
                    # URLs may contain Telegram tokens. Do not expose exception strings.
                    self.delivery_record(report_id, channel, target_hash, "UNCERTAIN", attempts,
                                         error="Response not confirmed; inspect provider before any resend")
            return self.report(report_id)

    def request_outlook_review(self, report_id, confirmation, event='review'):
        with self.lock:
            if self.config().get('outlook_enabled') is False:
                raise ReviewError('Outlook is disabled for this workflow')
            self.verify(report_id)
            if confirmation != 'REQUEST REVIEW ' + report_id:
                raise ReviewError('Explicit report-specific review request required')
            if not configuration_status()['outlook']['configured']:
                raise ReviewError('Configure Outlook token and recipients first')
            target = destinations()
            target_hash = digest(target)
            channel = 'outlook_review' if event == 'review' else 'outlook_' + event
            with self.db() as db:
                previous = db.execute('SELECT * FROM deliveries WHERE report_id=? AND channel=? AND destination_digest=?',
                                      (report_id, channel, target_hash)).fetchone()
            if previous and previous['status'] in ('ACCEPTED', 'IN_FLIGHT', 'UNCERTAIN'):
                return self.report(report_id)
            report = self.report(report_id)
            attempts = (previous['attempts'] if previous else 0) + 1
            self.delivery_record(report_id, channel, target_hash, 'IN_FLIGHT', attempts)
            summary = report['summary']
            content = (f"Draft invoice report {report_id} v{report['version']} is ready for your review.\n"
                       f"Records: {summary['supplied_records']}; flagged: {summary['flagged_records']}; unresolved: {summary['unresolved_records']}.\n"
                       f"Report digest: {report['report_digest']}\n"
                       f'On the computer running Invoice Assurance, open http://127.0.0.1:8090/?report={report_id}\n'
                       'Approve distribution in the dashboard, then send the Telegram summary. Email replies do not record approval.\n'
                       'This is a review request, not payment authorization or a final report distribution.')
            message = {'message': {'subject': 'Approval requested: ' + report_id,
                       'body': {'contentType': 'Text', 'content': content},
                       'toRecipients': [{'emailAddress': {'address': r}} for r in target['outlook']]},
                       'saveToSentItems': True}
            if event in ('approval', 'risk'):
                message['message']['subject'] = ('Report approved: ' if event == 'approval' else 'Suspected invoice risk: ') + report_id
                message['message']['body']['content'] = (
                    ('Report distribution approved in the dashboard. This does not authorize payment.' if event == 'approval'
                     else 'Suspected fraud/risk indicators require review; this is not confirmed fraud.') + '\n'
                    + f"Records: {summary['supplied_records']}; flagged: {summary['flagged_records']}; unresolved: {summary['unresolved_records']}.\n"
                    + f"Report digest: {report['report_digest']}\nhttp://127.0.0.1:8090/?report={report_id}")
            try:
                code, _ = self.transport('https://graph.microsoft.com/v1.0/me/sendMail', message,
                                        {'Authorization': 'Bearer ' + os.environ['MICROSOFT_OUTLOOK_TOKEN']})
                if code != 202:
                    raise ReviewError('Unexpected Outlook response')
                self.delivery_record(report_id, channel, target_hash, 'ACCEPTED', attempts)
            except urllib.error.HTTPError as error:
                self.delivery_record(report_id, channel, target_hash,
                                     'AUTH_FAILED' if error.code in (401, 403) else 'UNCERTAIN' if error.code >= 500 else 'FAILED',
                                     attempts, error=f'HTTP {error.code}')
            except Exception:
                self.delivery_record(report_id, channel, target_hash, 'UNCERTAIN', attempts,
                                     error='Response uncertain; inspect Outlook before retrying')
            return self.report(report_id)

    def review_alert_if_configured(self, report_id):
        try:
            if self.config().get('email_alert_on_risk'):
                payload = self.report(report_id)
                risk = any(c['dataset_kind'] == 'SUPPLIED' and any(f['domain'] == 'fraud' and f['status'] == 'FAIL'
                           for f in c['findings']) for c in payload['cases'])
                if not risk:
                    return 'NO_FRAUD_INDICATORS'
                if not configuration_status()['outlook']['configured']:
                    return 'NOT_CONFIGURED'
                report = self.request_outlook_review(report_id, 'REQUEST REVIEW ' + report_id, event='risk')
                return next((d['status'] for d in report['deliveries'] if d['channel'] == 'outlook_risk'), 'NOT_SENT')
            if not self.config().get('email_alert_on_success'):
                return 'DISABLED'
            if self.report(report_id)['summary']['supplied_records'] == 0:
                return 'NO_INVOICE_RECORDS'
            if not configuration_status()['outlook']['configured']:
                return 'NOT_CONFIGURED'
            report = self.request_outlook_review(report_id, 'REQUEST REVIEW ' + report_id)
            results = [d['status'] for d in report['deliveries'] if d['channel'] == 'outlook_review']
            return results[-1] if results else 'NOT_SENT'
        except Exception:
            return 'FAILED_REVIEW_REQUIRED'

    def delivery_record(self, report_id, channel, destination_hash, status, attempts, message_id=None, error=None):
        with self.db() as db:
            db.execute("INSERT OR REPLACE INTO deliveries VALUES(?,?,?,?,?,?,?,?)", (report_id, channel, destination_hash, status, attempts, now(), message_id, error))

    def send(self, channel, report, target):
        if channel == 'telegram_document':
            data = post_document(target['telegram'], self.directory(report['report_id']) / 'report.xlsx',
                                 'Invoice final report ' + report['report_id'] + ' — Excel comparison results and suspected-risk totals.')
            parsed = json.loads(data)
            if parsed.get('ok') is not True or not parsed.get('result', {}).get('message_id'):
                raise ReviewError('Telegram did not confirm the Excel attachment')
            return 'SENT_TO_TELEGRAM', str(parsed['result']['message_id'])
        s = report["summary"]
        exposure = "; ".join(f"{k} {v}" for k, v in s["flagged_exposure"].items()) or "No quantified flags"
        summary = (f"Invoice assurance {report['report_id']} v{report['version']}\n"
                   f"Reviewed records: {s['supplied_records']}; flagged: {s['flagged_records']}; "
                   f"unresolved: {s['unresolved_records']}\nFlagged exposure: {exposure}\n"
                   "Exposure is suspected risk, not confirmed fraud. Distribution approval does not authorize payment.")
        if channel == "outlook":
            content = base64.b64encode((self.directory(report["report_id"]) / "report.xlsx").read_bytes()).decode("ascii")
            body = {"message": {"subject": "Invoice assurance report " + report["report_id"],
                                  "body": {"contentType": "Text", "content": summary},
                                  "toRecipients": [{"emailAddress": {"address": r}} for r in target["outlook"]],
                                  "attachments": [{"@odata.type": "#microsoft.graph.fileAttachment", "name": "invoice-assurance.xlsx",
                                                   "contentType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "contentBytes": content}]},
                    "saveToSentItems": True}
            code, _ = self.transport("https://graph.microsoft.com/v1.0/me/sendMail", body,
                                     {"Authorization": "Bearer " + os.environ["MICROSOFT_OUTLOOK_TOKEN"]})
            if code != 202:
                raise ReviewError("Unexpected Outlook response")
            return "ACCEPTED", None
        url = "https://api.telegram.org/bot" + os.environ["TELEGRAM_BOT_TOKEN"] + "/sendMessage"
        from telegram_review import result_text
        summary = 'Report distribution approved.\n\n' + result_text(report, self.config(), include_approval=False)
        _, data = self.transport(url, {"chat_id": target["telegram"], "text": summary})
        parsed = json.loads(data)
        if parsed.get("ok") is not True or not parsed.get("result", {}).get("message_id"):
            raise ReviewError("Telegram response did not confirm a message")
        return "SENT_TO_TELEGRAM", str(parsed["result"]["message_id"])


def post_document(chat_id, path, caption):
    content = Path(path).read_bytes()
    if len(content) > 50 * 1024 * 1024:
        raise ReviewError('Excel attachment exceeds Telegram upload limit')
    boundary = 'invoice-' + uuid.uuid4().hex
    parts = []
    for key, value in {'chat_id': chat_id, 'caption': caption}.items():
        parts.append(('--' + boundary + '\r\nContent-Disposition: form-data; name="' + key + '"\r\n\r\n' + value + '\r\n').encode())
    parts.append(('--' + boundary + '\r\nContent-Disposition: form-data; name="document"; filename="report.xlsx"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n').encode())
    parts += [content, ('\r\n--' + boundary + '--\r\n').encode()]
    request = urllib.request.Request('https://api.telegram.org/bot' + os.environ['TELEGRAM_BOT_TOKEN'] + '/sendDocument',
                                     data=b''.join(parts), headers={'Content-Type': 'multipart/form-data; boundary=' + boundary})
    with urllib.request.urlopen(request, timeout=45) as response:
        return response.read()
