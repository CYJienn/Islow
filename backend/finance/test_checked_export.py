import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from approved_export import write_checked_invoices


class CheckedExportTests(unittest.TestCase):
    def test_failed_intake_preserves_previous_export(self):
        with TemporaryDirectory() as folder:
            target = Path(folder) / 'finance_export.json'
            target.write_text('previous-export', encoding='utf-8')
            report = {'document_intake': [{'status': 'EXTRACTION_FAILED_STOPPED'}]}
            self.assertIsNone(write_checked_invoices(report, target))
            self.assertEqual(target.read_text(), 'previous-export')

    def test_only_complete_supplied_records_and_overwrite(self):
        clean = {'dataset_kind': 'SUPPLIED', 'status': 'CHECKS_COMPLETE', 'flagged': False,
                 'unresolved': False, 'findings': [{'status': 'PASS'}], 'invoice_id': 'clean'}
        report = {'report_id': 'report-test', 'version': 1, 'cases': [clean,
                  {**clean, 'invoice_id': 'unknown', 'findings': [{'status': 'UNKNOWN'}]},
                  {**clean, 'invoice_id': 'failed', 'findings': [{'status': 'FAIL'}]},
                  {**clean, 'invoice_id': 'test', 'dataset_kind': 'TEST'},
                  {**clean, 'invoice_id': 'empty', 'findings': []}]}
        with TemporaryDirectory() as folder:
            target = Path(folder) / 'finance_export.json'
            write_checked_invoices(report, target)
            self.assertEqual([c['invoice_id'] for c in json.loads(target.read_text())['invoices']], ['clean'])
            report['cases'] = []
            write_checked_invoices(report, target)
            self.assertEqual(json.loads(target.read_text())['invoices'], [])
