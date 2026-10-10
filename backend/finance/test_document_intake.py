import unittest
from document_intake import parse_invoice


class DocumentIntakeTests(unittest.TestCase):
    def test_non_invoice_stops(self):
        self.assertEqual(parse_invoice('Meeting notes\nTotal: 100', 'test', 'WORD_TEXT')['status'], 'NON_INVOICE_STOPPED')

    def test_conflicting_identity_stops(self):
        self.assertEqual(parse_invoice('INVOICE\nInvoice Number: A\nInvoice Number: B', 'test', 'PDF_TEXT')['status'], 'DOCUMENT_REVIEW_REQUIRED_STOPPED')

    def test_labeled_invoice_fields_and_lines_preserve_source(self):
        parsed = parse_invoice('INVOICE\nInvoice Number: 001\nVendor ID: V1\nCurrency: MYR\nTotal: 100\nLine: 10 | Qty: 10 | Unit Price: 10 | Unit: EA', 'source', 'OCR')
        self.assertEqual(parsed['status'], 'INVOICE_CANDIDATE')
        self.assertEqual(parsed['invoice']['BELNR'], '001')
        self.assertEqual(parsed['invoice']['LINES'][0]['MENGE'], '10')
        self.assertEqual(parsed['invoice']['DOCUMENT_EXTRACTION_METHOD'], 'OCR')
