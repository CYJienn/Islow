import json
import unittest
from unittest.mock import MagicMock, patch
from telegram_review import handle, notify, approval_code, result_text


class TelegramReviewTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict('os.environ', {'TELEGRAM_CHAT_ID': '123', 'TELEGRAM_BOT_TOKEN': 'fake', 'OUTLOOK_RECIPIENTS': ''})
        self.env.start()
        self.s = MagicMock()
        self.s.report.return_value = {'report_id': 'report-test', 'report_digest': 'snapshot', 'summary': {'supplied_records': 1, 'flagged_records': 1, 'unresolved_records': 1}, 'cases': []}
        self.s.config.return_value = {'telegram_review_enabled': True}
        self.s.db.return_value.__enter__.return_value.execute.return_value.fetchone.return_value = None
        self.s.transport.return_value = (200, json.dumps({'ok': True, 'result': {'message_id': 42}}).encode())

    def tearDown(self):
        self.env.stop()

    def message(self, code=None):
        return {'chat': {'type': 'private', 'id': 123}, 'from': {'id': 123},
                'text': '/approve report-test ' + (code or approval_code(self.s.report.return_value))}

    def test_exact_approval_sends_summary(self):
        self.assertTrue(handle(self.s, self.message()))
        self.s.decide.assert_called_once_with('report-test', 'snapshot', 'APPROVED', 'APPROVE DISTRIBUTION report-test')
        self.s.distribute.assert_called_once_with('report-test', 'SEND report-test')

    def test_wrong_sender_or_stale_code_never_approves(self):
        m = self.message(); m['from']['id'] = 999
        self.assertFalse(handle(self.s, m))
        self.assertFalse(handle(self.s, self.message('old-code')))
        self.s.decide.assert_not_called()

    def test_notification_is_not_approval(self):
        self.assertEqual(notify(self.s, 'report-test'), 'SENT_TO_TELEGRAM')
        payload = self.s.transport.call_args.args[1]
        self.assertNotIn('/approve', payload['text'])
        self.assertTrue(payload['reply_markup']['inline_keyboard'][0][0]['callback_data'].startswith('approve|report-test|'))
        self.s.decide.assert_not_called()

    def test_existing_message_not_resent(self):
        self.s.db.return_value.__enter__.return_value.execute.return_value.fetchone.return_value = {'status': 'SENT_TO_TELEGRAM'}
        self.assertEqual(notify(self.s, 'report-test'), 'SENT_TO_TELEGRAM')
        self.s.transport.assert_not_called()

    def test_match_is_not_full_verification_or_fake_account(self):
        report = self.s.report.return_value
        report['cases'] = [{'invoice_reference': 'INV-001', 'invoice_id': '1', 'dataset_kind': 'TEST', 'flagged': False,
                            'amount': '100.00', 'currency': 'MYR', 'business_key': 'test', 'source_ref': 'invoice.docx', 'status': 'EVIDENCE_REQUIRED',
                            'unresolved': True, 'findings': [{'rule_id': 'FINANCE_EXPORT_COMPARISON', 'status': 'PASS'}]}]
        with patch.dict('os.environ', {'ONEDRIVE_ACCOUNT': ''}):
            text = result_text(report, {'workbook': 'reference.xlsx', 'invoice_input_dir': 'OneDrive/Invoices'})
        self.assertIn('Invoice INV-001: Valid against the Excel reference.', text)
        self.assertIn('Needs review', text)
        self.assertIn('OneDrive account: Not configured', text)
        self.assertNotIn('8090', text)
