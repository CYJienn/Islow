import unittest
from final_report import batch_results


class FinalReportTests(unittest.TestCase):
    def case(self, key, amount, kind='TEST', comparison='FAIL'):
        return {'invoice_id': key, 'invoice_reference': key, 'source_ref': 'invoice.docx::hash', 'business_key': key,
                'amount': amount, 'currency': 'MYR', 'dataset_kind': kind, 'flagged': True, 'unresolved': True, 'status': 'RISK_FLAGGED',
                'findings': [{'rule_id': 'FINANCE_EXPORT_COMPARISON', 'status': comparison}]}

    def test_duplicates_count_once_and_tests_remain_separate(self):
        result = batch_results([self.case('duplicate', '100.00'), self.case('duplicate', '100.00'),
                                self.case('other', '25.00'), self.case('real', '10.00', 'SUPPLIED')])
        self.assertEqual(result['test_suspected_exposure'], {'MYR': '125.00'})
        self.assertEqual(result['supplied_suspected_exposure'], {'MYR': '10.00'})
        self.assertEqual(result['confirmed_fraud'], 'NOT_ESTABLISHED')

    def test_match_with_missing_evidence_is_not_fully_verified(self):
        case = self.case('match', '100.00', comparison='PASS')
        case.update(flagged=False, status='EVIDENCE_REQUIRED')
        result = batch_results([case])
        self.assertEqual(result['valid_reference_matches'], 1)
        self.assertEqual(result['fully_verified'], 0)
