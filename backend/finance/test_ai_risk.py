import json
import unittest
from unittest.mock import patch, MagicMock
import ai_risk


class AiRiskTests(unittest.TestCase):
    def test_missing_key_and_tests_never_call_api(self):
        with patch.dict('os.environ', {}, clear=True), patch('ai_risk.urlopen') as call:
            self.assertEqual(ai_risk.review({}, [], 'SUPPLIED')['risk'], 'INSUFFICIENT_EVIDENCE')
            self.assertIsNone(ai_risk.review({}, [], 'TEST'))
            call.assert_not_called()

    def test_suspected_risk_and_redacted_request(self):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = json.dumps({'status': 'completed', 'output': [
            {'content': [{'type': 'output_text', 'text': json.dumps({'risk': 'SUSPECTED_RISK', 'reason': 'Duplicate indicator'})}]}]}).encode()
        with patch.dict('os.environ', {'OPENAI_API_KEY': 'test-key'}), patch('ai_risk.urlopen', return_value=response) as call:
            result = ai_risk.review({'XBLNR': 'test', 'BANK_ON_INV': 'private-bank'}, [], 'SUPPLIED')
            self.assertEqual(result['risk'], 'SUSPECTED_RISK')
            payload = call.call_args.args[0].data.decode()
            self.assertNotIn('private-bank', payload)
            self.assertNotIn('test-key', payload)

    def test_api_failure_requires_evidence(self):
        with patch.dict('os.environ', {'OPENAI_API_KEY': 'test-key'}), patch('ai_risk.urlopen', side_effect=TimeoutError):
            self.assertEqual(ai_risk.review({}, [], 'SUPPLIED')['risk'], 'INSUFFICIENT_EVIDENCE')
