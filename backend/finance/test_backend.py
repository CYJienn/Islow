"""Behavioral checks; temporary state and mocked transports only, no live messages."""
from copy import deepcopy
from decimal import Decimal
from http.server import ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
from unittest.mock import patch
import json
import os
import unittest
import urllib.error
import urllib.request

from engine import evaluate, matching, number, choose_approver, summarize
from fixtures import base
from server import make_handler
from service import Service, ReviewError

POLICY = {"currency": "MYR", "money_tolerance": "0.02", "quantity_tolerance": "0"}


def result(d):
    return evaluate(d["invoices"][0], d, POLICY)


def rule(case, name):
    return [f for f in case["findings"] if f["rule_id"] == name]


class EngineTests(unittest.TestCase):
    def test_locale_amounts_and_invalid_values(self):
        self.assertEqual(number("327845,70"), Decimal("327845.70"))
        self.assertEqual(number("330,252.07"), Decimal("330252.07"))
        self.assertEqual(number("1.234,56"), Decimal("1234.56"))
        self.assertEqual(number(0), Decimal(0))
        for value in (None, "", True, "NaN", "Infinity", "1,234", "1.2.3", "330.252.07"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                number(value)

    def test_clean_synthetic_case(self):
        r = result(base("CLEAN"))
        self.assertEqual(r["status"], "CHECKS_COMPLETE")
        self.assertTrue(all(f["status"] == "PASS" for f in r["findings"]))

    def test_missing_lines_never_match(self):
        d = base("MISSING"); d["invoices"][0].pop("LINES")
        r = result(d)
        self.assertEqual(rule(r, "THREE_WAY_EVIDENCE")[0]["status"], "UNKNOWN")
        self.assertEqual(r["status"], "EVIDENCE_REQUIRED")

    def test_partial_receipt_is_failure(self):
        d = base("PARTIAL"); d["receipts"][0]["MENGE"] = "60"
        self.assertEqual(rule(result(d), "RECEIPT_QUANTITY")[0]["status"], "FAIL")

    def test_rounding_boundary(self):
        d = base("ROUNDING"); d["invoices"][0]["WRBTR"] = "1000.02"
        self.assertEqual(rule(result(d), "INVOICE_TOTAL")[0]["status"], "PASS")
        d["invoices"][0]["WRBTR"] = "1000.03"
        self.assertEqual(rule(result(d), "INVOICE_TOTAL")[0]["status"], "FAIL")

    def test_unit_price_variance_not_hidden_by_rounding(self):
        d = base("PRICE"); d["invoices"][0]["LINES"][0]["NETPR"] = "10.01"
        self.assertEqual(rule(result(d), "LINE_PRICE")[0]["status"], "FAIL")

    def test_missing_allocation_or_tax_stays_unknown(self):
        d = base("ALLOC"); d["invoices"][0].pop("PRIOR_ALLOCATIONS"); d["invoices"][0].pop("TAX_VERIFIED")
        r = result(d)
        self.assertEqual(rule(r, "RECEIPT_QUANTITY")[0]["status"], "UNKNOWN")
        self.assertEqual(rule(r, "INVOICE_TOTAL")[0]["status"], "UNKNOWN")

    def test_returns_reduce_capacity(self):
        d = base("RETURN"); ret = deepcopy(d["receipts"][0]); ret.update({"BWART": "102", "SHKZG": "H", "MENGE": "20", "source_ref": "TEST::return"}); d["receipts"].append(ret)
        f = rule(result(d), "RECEIPT_QUANTITY")[0]
        self.assertEqual(f["status"], "FAIL"); self.assertEqual(f["expected_value"], "80")

    def test_shared_receipt_capacity_not_reused(self):
        d = base("SHARED"); inv = d["invoices"][0]; inv["LINES"][0]["MENGE"] = "60"; inv["WRBTR"] = "600"
        other = deepcopy(inv); other.update({"BELNR": "SECOND", "XBLNR": "SECOND", "source_ref": "TEST::second"}); d["invoices"].append(other)
        for i in d["invoices"]:
            self.assertEqual(rule(evaluate(i, d, POLICY), "RECEIPT_QUANTITY")[0]["status"], "FAIL")

    def test_bank_match_is_not_independent_verification(self):
        d = base("BANK"); d["invoices"][0].pop("BANK_VERIFIED")
        r = result(d)
        self.assertEqual(rule(r, "BANK_COMPARISON")[0]["status"], "PASS")
        self.assertEqual(rule(r, "INDEPENDENT_BANK_VERIFICATION")[0]["status"], "UNKNOWN")

    def test_malformed_amount_is_unquantified(self):
        d = base("BAD"); d["invoices"][0]["WRBTR"] = "invalid"
        r = result(d)
        self.assertIsNone(r["amount"]); self.assertTrue(r["flagged"])

    def test_approval_bounds_gaps_currency_and_overlap(self):
        rows = [{"KOSTL": "CC", "CURRENCY": "MYR", "MIN_AMT": "0", "MAX_AMT": "5000"},
                {"KOSTL": "CC", "CURRENCY": "MYR", "MIN_AMT": "5001", "MAX_AMT": "10000"}]
        self.assertEqual(choose_approver(Decimal("5000"), "CC", "MYR", rows), rows[0])
        for amount, currency in (("5000.50", "MYR"), ("10000.01", "MYR"), ("20", "USD")):
            with self.assertRaises(ValueError): choose_approver(Decimal(amount), "CC", currency, rows)
        with self.assertRaises(ValueError): choose_approver(Decimal("20"), "CC", "MYR", rows + [rows[0]])

    def test_exposure_is_deduplicated_and_tests_excluded(self):
        d = base("DUPE"); d["kind"] = "SUPPLIED"
        other = deepcopy(d["invoices"][0]); other.update({"BELNR": "COPY", "source_ref": "TEST::copy"}); d["invoices"].append(other)
        cases = [evaluate(i, d, POLICY) for i in d["invoices"]]
        cases.append(result(base("SYNTHETIC")))
        s = summarize(cases)
        self.assertEqual(s["supplied_records"], 2); self.assertEqual(s["test_records"], 1)
        self.assertEqual(s["flagged_business_invoices"], 1); self.assertEqual(s["flagged_exposure"], {"MYR": "1000.00"})


class ServiceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory(); self.root = Path(self.tmp.name)
        self.source = self.root / "source.bin"; self.source.write_bytes(b"isolated synthetic source")
        self.config = self.root / "config.json"
        self.config.write_text(json.dumps({"workbook": str(self.source), "reference_documents": [], "reviewer": "Test operator",
                                          "timezone": "Asia/Kuala_Lumpur", "schedule_enabled": False, "include_test_cases": True, "test_policy": POLICY}))
        self.env = patch.dict(os.environ, {"MICROSOFT_OUTLOOK_TOKEN": "TEST_TOKEN", "OUTLOOK_RECIPIENTS": "test@example.invalid",
                                          "TELEGRAM_BOT_TOKEN": "TEST_BOT", "TELEGRAM_CHAT_ID": "TEST_CHAT"}); self.env.start()
        case = result(base("ISOLATED"))
        payload = {"cases": [case], "summary": summarize([case]), "source_manifest": [], "source_counts": {}, "limitations": [], "policy": {}}
        self.analysis = patch("service.run_analysis", side_effect=lambda config: deepcopy(payload)); self.analysis.start()
        self.calls = []
        def transport(url, data, headers=None):
            self.calls.append(url)
            return (202, b"") if "graph.microsoft.com" in url else (200, b'{"ok":true,"result":{"message_id":42}}')
        self.service = Service(self.config, self.root / "state", exporter=lambda i, o: o.write_bytes(b"TEST_ARTIFACT"), transport=transport)
        self.rid = self.service.run()["report_id"]

    def tearDown(self):
        self.analysis.stop(); self.env.stop(); self.tmp.cleanup()

    def approve(self):
        self.service.review_start(self.rid)
        self.service.decide(self.rid, self.service.report(self.rid)["report_digest"], "APPROVED", "APPROVE DISTRIBUTION " + self.rid)

    def test_unchanged_run_is_reused(self):
        r = self.service.run(); self.assertTrue(r["reused"]); self.assertEqual(r["report_id"], self.rid)

    def test_report_completion_queues_orchestrator_without_sending(self):
        path = self.service.state / 'orchestrator-outbox' / (self.rid + '.json')
        handoff = json.loads(path.read_text(encoding='utf-8'))
        self.assertEqual(handoff['event'], 'REPORT_GENERATED')
        self.assertEqual(handoff['report_digest'], self.service.report(self.rid)['report_digest'])
        self.assertEqual(handoff['delivery_status'], 'PENDING_WORKBUDDY_DISPATCH')
        self.assertEqual(self.calls, [])

    def test_outlook_review_request_precedes_approval_and_is_idempotent(self):
        self.service.request_outlook_review(self.rid, 'REQUEST REVIEW ' + self.rid)
        self.assertEqual(len(self.calls), 1)
        self.assertFalse(self.service.report(self.rid)['approved_for_distribution'])
        self.service.request_outlook_review(self.rid, 'REQUEST REVIEW ' + self.rid)
        self.assertEqual(len(self.calls), 1)

    def test_success_alert_never_sends_final_report_or_approves(self):
        import service as service_module
        payload = service_module.run_analysis(self.service.config())
        payload['cases'][0]['dataset_kind'] = 'SUPPLIED'
        payload['summary'] = summarize(payload['cases'])
        service_module.run_analysis.side_effect = lambda config: deepcopy(payload)
        config = json.loads(self.config.read_text())
        config['email_alert_on_success'] = True
        self.config.write_text(json.dumps(config))
        result = self.service.run()
        self.assertEqual(result['outlook_review_alert'], 'ACCEPTED')
        self.assertFalse(self.service.report(result['report_id'])['approved_for_distribution'])
        self.assertEqual(len(self.calls), 1)
        self.assertIn('graph.microsoft.com', self.calls[0])
        self.service.run()
        self.assertEqual(len(self.calls), 1)

    def test_simple_flow_sends_only_telegram_after_approval(self):
        config = json.loads(self.config.read_text())
        config['notification_flow'] = 'outlook_review_then_telegram'
        self.config.write_text(json.dumps(config))
        self.rid = self.service.run()['report_id']
        self.approve()
        self.service.distribute(self.rid, 'SEND ' + self.rid)
        self.assertEqual(len(self.calls), 1)
        self.assertIn('api.telegram.org', self.calls[0])

    def test_approval_alert_is_separate_and_idempotent(self):
        config = json.loads(self.config.read_text())
        config['email_alert_on_approval'] = True
        self.config.write_text(json.dumps(config))
        self.rid = self.service.run()['report_id']
        self.assertEqual(self.calls, [])
        self.approve()
        self.assertEqual(len(self.calls), 1)
        self.approve()
        self.assertEqual(len(self.calls), 1)
        self.assertTrue(self.service.report(self.rid)['approved_for_distribution'])
        self.assertEqual(self.service.report(self.rid)['deliveries'][0]['channel'], 'outlook_approval')

    def test_excel_attachment_requires_approval_and_is_not_resent(self):
        config = json.loads(self.config.read_text())
        config.update(notification_flow='telegram_only', telegram_attach_report=True)
        self.config.write_text(json.dumps(config))
        self.rid = self.service.run()['report_id']
        with patch('service.post_document', return_value=b'{"ok":true,"result":{"message_id":43}}') as attachment:
            with self.assertRaises(ReviewError):
                self.service.distribute(self.rid, 'SEND ' + self.rid)
            attachment.assert_not_called()
            self.approve()
            self.service.distribute(self.rid, 'SEND ' + self.rid)
            self.service.distribute(self.rid, 'SEND ' + self.rid)
            attachment.assert_called_once()
            self.assertEqual(attachment.call_args.args[1].name, 'report.xlsx')
            self.assertEqual(len(self.calls), 1)

    def test_risk_alert_requires_supplied_fraud_failure(self):
        import service as module
        payload = module.run_analysis(self.service.config())
        payload['cases'][0]['dataset_kind'] = 'SUPPLIED'
        config = json.loads(self.config.read_text())
        config['email_alert_on_risk'] = True
        self.config.write_text(json.dumps(config))
        payload['summary'] = summarize(payload['cases'])
        module.run_analysis.side_effect = lambda config: deepcopy(payload)
        self.rid = self.service.run()['report_id']
        self.assertEqual(self.calls, [])
        payload['cases'][0]['findings'].append({'domain': 'fraud', 'status': 'FAIL', 'rule_id': 'TEST_RISK'})
        self.service.review_alert_if_configured(self.rid)
        # Stored report is immutable; a changed analysis needs a new snapshot.
        self.assertEqual(self.calls, [])
        payload['cases'][0]['flagged'] = True
        payload['summary'] = summarize(payload['cases'])
        config['reviewer'] = 'Changed test reviewer'
        self.config.write_text(json.dumps(config))
        self.rid = self.service.run()['report_id']
        self.assertEqual(len(self.calls), 1)
        self.service.review_alert_if_configured(self.rid)
        self.assertEqual(len(self.calls), 1)
        self.assertFalse(self.service.report(self.rid)['approved_for_distribution'])

    def test_no_distribution_without_approval(self):
        with self.assertRaises(ReviewError): self.service.distribute(self.rid, "SEND " + self.rid)
        self.assertEqual(self.calls, [])

    def test_specific_confirmation_and_digest_required(self):
        with self.assertRaises(ReviewError): self.service.decide(self.rid, "wrong", "APPROVED", "APPROVE DISTRIBUTION " + self.rid)
        with self.assertRaises(ReviewError): self.service.decide(self.rid, self.service.report(self.rid)["report_digest"], "APPROVED", "looks good")

    def test_approval_does_not_change_findings(self):
        before = self.service.report(self.rid)["cases"]
        self.approve()
        self.assertTrue(self.service.report(self.rid)["approved_for_distribution"])
        self.assertEqual(self.service.report(self.rid)["cases"], before)

    def test_artifact_edit_invalidates_approval_and_rebuilds(self):
        self.approve(); (self.service.directory(self.rid) / "report.xlsx").write_bytes(b"EDITED")
        self.assertFalse(self.service.report(self.rid)["approved_for_distribution"])
        with self.assertRaises(ReviewError): self.service.distribute(self.rid, "SEND " + self.rid)
        new = self.service.run(); self.assertFalse(new["reused"]); self.assertNotEqual(new["report_id"], self.rid)

    def test_source_change_invalidates_approval(self):
        self.approve(); self.source.write_bytes(b"CHANGED")
        self.assertFalse(self.service.report(self.rid)["approved_for_distribution"])

    def test_destination_change_invalidates_approval(self):
        self.approve()
        with patch.dict(os.environ, {"TELEGRAM_CHAT_ID": "NEW_CHAT"}):
            self.assertFalse(self.service.report(self.rid)["approved_for_distribution"])

    def test_delivery_status_and_idempotency(self):
        self.approve(); r = self.service.distribute(self.rid, "SEND " + self.rid)
        self.assertEqual({d["channel"]: d["status"] for d in r["deliveries"]}, {"outlook": "ACCEPTED", "telegram": "SENT_TO_TELEGRAM"})
        self.assertEqual(len(self.calls), 2)
        self.service.distribute(self.rid, "SEND " + self.rid, retry_failed=True)
        self.assertEqual(len(self.calls), 2)

    def test_uncertain_send_not_blindly_retried(self):
        self.approve()
        def timeout(*args): self.calls.append("attempt"); raise urllib.error.URLError("TEST timeout")
        self.service.transport = timeout
        r = self.service.distribute(self.rid, "SEND " + self.rid)
        self.assertEqual({d["status"] for d in r["deliveries"]}, {"UNCERTAIN"})
        self.service.distribute(self.rid, "SEND " + self.rid, retry_failed=True)
        self.assertEqual(len(self.calls), 2)

    def test_failed_export_is_logged_not_complete(self):
        self.source.write_bytes(b"NEW source")
        def fail(*args): raise ReviewError("Expected isolated export failure")
        self.service.exporter = fail
        with self.assertRaises(ReviewError): self.service.run()
        self.assertEqual(self.service.history()["runs"][0]["status"], "FAILED")

    def test_http_mutation_requires_session_and_same_origin(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), lambda *args: None)
        port = server.server_port
        server.RequestHandlerClass = make_handler(self.service, "TEST_SESSION", port)
        t = Thread(target=server.serve_forever, daemon=True); t.start()
        try:
            url = f"http://127.0.0.1:{port}/api/runs"
            request = urllib.request.Request(url, b"{}", {"Content-Type": "application/json"})
            with self.assertRaises(urllib.error.HTTPError) as e: urllib.request.urlopen(request)
            self.assertEqual(e.exception.code, 403)
            request = urllib.request.Request(url, b"{}", {"Content-Type": "application/json", "X-Local-Token": "TEST_SESSION", "Origin": "https://untrusted.invalid"})
            with self.assertRaises(urllib.error.HTTPError) as e: urllib.request.urlopen(request)
            self.assertEqual(e.exception.code, 403)
        finally:
            server.shutdown(); server.server_close(); t.join()


if __name__ == "__main__":
    unittest.main(verbosity=2)
