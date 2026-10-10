"""Offline notification tests: synthetic environment, mocked urllib, no sends."""
import base64
from email.message import Message
import http.client
import importlib
import inspect
import io
import json
from pathlib import Path
import socket
import sys
import unittest
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlsplit
from urllib.request import HTTPRedirectHandler

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / 'scripts'))
import notifications as n


NOW = 1800000000
BOT = '123456:SYNTHETIC_TEST_BOT_NOT_A_CREDENTIAL'
APP = {'IA_GRAPH_TENANT_ID': 'synthetic-tenant', 'IA_GRAPH_CLIENT_ID': 'synthetic-client',
       'IA_GRAPH_CLIENT_SECRET': 'synthetic-test-secret'}
DESTINATIONS = {'IA_GRAPH_SENDER': 'sender@example.invalid',
                'IA_OUTLOOK_RECIPIENTS': 'reviewer@example.invalid',
                'IA_TELEGRAM_BOT_TOKEN': BOT, 'IA_TELEGRAM_CHAT_ID': '-12345'}


def jwt(claims=None):
    claims = claims if claims is not None else {
        'exp': NOW + 3600, 'roles': ['Mail.Send'], 'aud': 'https://graph.microsoft.com'}
    def encode(value):
        return base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')
    return encode({'alg': 'RS256'}) + '.' + encode(claims) + '.synthetic_unsigned_signature'


class Response:
    def __init__(self, status=200, value=None, raw=None, headers=None):
        self.status = status
        self.headers = headers or {}
        self.raw = raw if raw is not None else json.dumps(value).encode()
        self.reads = []

    def read(self, limit):
        self.reads.append(limit)
        return self.raw[:limit]

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def http_error(code, retry=None, body=None):
    headers = Message()
    if retry is not None:
        headers['Retry-After'] = str(retry)
    headers['Location'] = 'https://untrusted.example.invalid/redirect'
    raw = json.dumps(body or {'description': 'SYNTHETIC_PRIVATE_BODY ' + BOT}).encode()
    return HTTPError('https://api.telegram.org/bot' + BOT + '/sendMessage', code,
                     'SYNTHETIC_PRIVATE_REASON ' + BOT, headers, io.BytesIO(raw))


class NotificationTests(unittest.TestCase):
    def setUp(self):
        # Replace the mapping itself: patch.dict would copy/read the real environment.
        self.env = {}
        self.enterContext(patch.object(n.os, 'environ', self.env))
        self.enterContext(patch.object(n.time, 'time', return_value=NOW))
        self.enterContext(patch.object(socket, 'create_connection',
                                       side_effect=AssertionError('REAL_NETWORK_FORBIDDEN')))
        self.enterContext(patch.object(socket, 'socket',
                                       side_effect=AssertionError('REAL_NETWORK_FORBIDDEN')))
        self.opener = MagicMock()
        self.opener.open.side_effect = AssertionError('UNMOCKED_REQUEST_FORBIDDEN')
        self.builder = self.enterContext(patch.object(n, 'build_opener', return_value=self.opener))
        self.content = b'SYNTHETIC_EXCEL_BYTES'
        self.file_open = self.enterContext(patch.object(n.Path, 'open',
                                                       side_effect=lambda *a, **k: io.BytesIO(self.content)))

    def configure(self, app=False, claims=None):
        self.env.update(DESTINATIONS)
        if app:
            self.env.update(APP)
        else:
            self.env['IA_GRAPH_ACCESS_TOKEN'] = jwt(claims)

    def queue(self, *responses):
        self.opener.open.side_effect = list(responses)

    def deliver(self, channel='outlook', **kwargs):
        values = {'channel': channel, 'report_id': 'IA-TEST', 'version': 2,
                  'summary': 'A safe review summary.', 'attachment_path': 'report.xlsx',
                  'approved': True}
        values.update(kwargs)
        return n.deliver(**values)

    def requests(self):
        return [call.args[0] for call in self.opener.open.call_args_list]

    def assert_sanitized(self, result):
        serialized = json.dumps(result)
        for private in (BOT, APP['IA_GRAPH_CLIENT_SECRET'], 'SYNTHETIC_PRIVATE',
                        'https://', 'bank-account-test', 'not-found-private'):
            self.assertNotIn(private, serialized)
        if 'IA_GRAPH_ACCESS_TOKEN' in self.env:
            self.assertNotIn(self.env['IA_GRAPH_ACCESS_TOKEN'], serialized)

    def test_exact_runner_api_and_import_has_no_io(self):
        self.assertEqual(list(inspect.signature(n.destination_manifest).parameters), [])
        self.assertEqual(list(inspect.signature(n.validate_connections).parameters), [])
        signature = inspect.signature(n.deliver)
        self.assertEqual(list(signature.parameters), ['channel', 'report_id', 'version', 'summary',
                                                      'attachment_path', 'approved'])
        self.assertIs(signature.parameters['approved'].default, False)
        class UnreadableEnvironment(dict):
            def get(self, *args):
                raise AssertionError('ENVIRONMENT_READ_ON_IMPORT')
        with patch.object(n.os, 'environ', UnreadableEnvironment()):
            importlib.reload(n)
        self.builder = self.enterContext(patch.object(n, 'build_opener', return_value=self.opener))
        self.opener.open.assert_not_called()
        self.file_open.assert_not_called()

    def test_empty_manifest_and_missing_configuration(self):
        manifest = n.destination_manifest()
        self.assertFalse(manifest['outlook']['configured'])
        self.assertFalse(manifest['telegram']['configured'])
        result = n.validate_connections()
        self.assertEqual({v['status'] for v in result.values()}, {'NOT_CONFIGURED'})
        self.assertEqual(self.deliver()['status'], 'NOT_CONFIGURED')
        self.assertEqual(self.deliver('telegram')['status'], 'NOT_CONFIGURED')
        self.opener.open.assert_not_called()

    def test_manifest_is_stable_across_rotation_expiry_and_recipient_order(self):
        self.configure()
        self.env.update(APP)
        self.env['IA_OUTLOOK_RECIPIENTS'] = ' B@example.invalid, a@example.invalid,b@example.invalid '
        first = n.destination_manifest()
        self.env['IA_GRAPH_ACCESS_TOKEN'] = jwt({'exp': NOW - 1, 'roles': ['Mail.Send']})
        self.env['IA_GRAPH_CLIENT_SECRET'] = 'synthetic-rotated-secret'
        self.env['IA_TELEGRAM_BOT_TOKEN'] = '999:synthetic_rotated_bot'
        self.env['IA_OUTLOOK_RECIPIENTS'] = 'a@example.invalid,B@example.invalid'
        self.env['IA_GRAPH_SENDER'] = ' SENDER@example.invalid '
        self.assertEqual(first, n.destination_manifest())
        self.assertEqual(first['outlook']['recipients'], ['a@example.invalid', 'b@example.invalid'])
        self.assert_sanitized(first)
        self.assertNotIn('synthetic-tenant', json.dumps(first))
        self.env['IA_TELEGRAM_CHAT_ID'] = '-67890'
        self.assertNotEqual(first, n.destination_manifest())
        self.opener.open.assert_not_called()

    def test_manifest_flags_detect_missing_configuration(self):
        self.configure(app=True)
        first = n.destination_manifest()
        self.assertTrue(first['outlook']['app_login_configured'])
        self.assertFalse(first['outlook']['access_token_configured'])
        del self.env['IA_GRAPH_CLIENT_SECRET']
        self.assertFalse(n.destination_manifest()['outlook']['configured'])
        del self.env['IA_TELEGRAM_BOT_TOKEN']
        self.assertFalse(n.destination_manifest()['telegram']['configured'])

    def test_approval_must_be_exact_true_before_environment_file_or_network_io(self):
        class UnreadableEnvironment(dict):
            def get(self, *args):
                raise AssertionError('ENVIRONMENT_READ_BEFORE_APPROVAL')
        with patch.object(n.os, 'environ', UnreadableEnvironment()):
            for value in (False, None, 1, 'true', [], {}):
                for channel in ('outlook', 'telegram'):
                    with self.subTest(approval=value, channel=channel):
                        result = self.deliver(channel, approved=value)
                        self.assertEqual(result['error'], 'EXPLICIT_APPROVAL_REQUIRED')
            self.assertEqual(n.deliver('outlook', 'IA-TEST', 1, '', None)['status'], 'FAILED')
        self.file_open.assert_not_called()
        self.opener.open.assert_not_called()

    def test_no_send_validation_app_login_and_telegram_lookups(self):
        self.configure(app=True)
        self.queue(Response(value={'access_token': jwt(), 'token_type': 'Bearer'}),
                   Response(value={'ok': True, 'result': {'id': 123456, 'is_bot': True}}),
                   Response(value={'ok': True, 'result': {'id': -12345, 'type': 'supergroup'}}))
        result = n.validate_connections()
        self.assertEqual(result['outlook']['status'], 'VALIDATED')
        self.assertEqual(result['outlook']['auth_mode'], 'application')
        self.assertEqual(result['outlook']['proof'], 'TOKEN_CLAIMS_ONLY')
        self.assertFalse(result['outlook']['signature_verified'])
        self.assertFalse(result['outlook']['mailbox_availability_checked'])
        self.assertTrue(all(v['messages_sent'] is False for v in result.values()))
        self.assertTrue(all(v['send_permission_tested'] is False for v in result.values()))
        requests = self.requests()
        self.assertEqual([urlsplit(r.full_url).path.rsplit('/', 1)[-1] for r in requests],
                         ['token', 'getMe', 'getChat'])
        self.assertEqual(requests[0].get_method(), 'POST')
        form = parse_qs(requests[0].data.decode())
        self.assertEqual(form['scope'], ['https://graph.microsoft.com/.default'])
        self.assertEqual(form['grant_type'], ['client_credentials'])
        self.assertEqual(form['client_id'], [APP['IA_GRAPH_CLIENT_ID']])
        self.assertEqual(form['client_secret'], [APP['IA_GRAPH_CLIENT_SECRET']])
        self.assertEqual(requests[1].get_method(), 'GET')
        self.assertEqual(json.loads(requests[2].data), {'chat_id': '-12345'})
        self.assert_sanitized(result)
        self.file_open.assert_not_called()

    def test_supplied_application_and_delegated_tokens_need_no_graph_network_validation(self):
        for claims, mode in [({'exp': NOW + 10, 'roles': ['Mail.Send']}, 'application'),
                             ({'exp': NOW + 10, 'scp': 'User.Read Mail.Send'}, 'delegated')]:
            with self.subTest(mode=mode):
                self.env.clear()
                self.env.update({'IA_GRAPH_SENDER': DESTINATIONS['IA_GRAPH_SENDER'],
                                 'IA_OUTLOOK_RECIPIENTS': DESTINATIONS['IA_OUTLOOK_RECIPIENTS'],
                                 'IA_GRAPH_ACCESS_TOKEN': jwt(claims)})
                result = n.validate_connections()['outlook']
                self.assertEqual(result['status'], 'VALIDATED')
                self.assertEqual(result['auth_mode'], mode)
        self.opener.open.assert_not_called()

    def test_invalid_expiry_permissions_and_claims_fail_closed_without_fallback(self):
        self.configure(app=True)
        del self.env['IA_TELEGRAM_BOT_TOKEN']
        claims_list = [None, [], {'exp': NOW}, {'exp': NOW - 10, 'roles': ['Mail.Send']},
                       {'roles': ['Mail.Send']}, {'exp': True, 'roles': ['Mail.Send']},
                       {'exp': 'future', 'roles': ['Mail.Send']},
                       {'exp': float('inf'), 'roles': ['Mail.Send']},
                       {'exp': NOW + 10, 'roles': ['Mail.Read']},
                       {'exp': NOW + 10, 'roles': 'Mail.Send'},
                       {'exp': NOW + 10, 'scp': 'Mail.Send.Shared'},
                       {'exp': NOW + 10, 'scp': 'Mail.Read', 'roles': ['Mail.Send']},
                       {'exp': NOW + 10, 'roles': ['Mail.Send'], 'nbf': NOW + 5},
                       {'exp': NOW + 10, 'roles': ['Mail.Send'], 'nbf': True},
                       {'exp': NOW + 10, 'roles': ['Mail.Send'], 'aud': 'wrong-audience'}]
        tokens = ['synthetic-opaque-token', 'a.!invalid!.b', 'a.b.c\r\nINJECTED']
        tokens.extend(jwt(claims) if claims is not None else jwt({'exp': False}) for claims in claims_list)
        for token in tokens:
            with self.subTest(token_kind=tokens.index(token)):
                self.env['IA_GRAPH_ACCESS_TOKEN'] = token
                result = n.validate_connections()['outlook']
                self.assertEqual(result['status'], 'FAILED')
                self.assertEqual(result['action'], 'RECONNECT_REQUIRED')
                self.assert_sanitized(result)
        self.opener.open.assert_not_called()

    def test_app_login_cannot_use_delegated_or_permissionless_token(self):
        self.configure(app=True)
        del self.env['IA_TELEGRAM_BOT_TOKEN']
        for value in ({'access_token': jwt({'exp': NOW + 10, 'scp': 'Mail.Send'}), 'token_type': 'Bearer'},
                      {'access_token': jwt({'exp': NOW + 10, 'roles': ['Mail.Read']}), 'token_type': 'Bearer'},
                      {'access_token': 'synthetic-opaque', 'token_type': 'Bearer'},
                      {'token_type': 'Bearer'}, {'access_token': jwt(), 'token_type': 'Basic'}):
            self.queue(Response(value=value))
            result = n.validate_connections()['outlook']
            self.assertEqual(result['status'], 'FAILED')
            self.assert_sanitized(result)

    def test_graph_application_send_attaches_excel_and_202_is_only_acceptance(self):
        self.configure(app=True)
        accepted = Response(status=202, raw=b'SYNTHETIC_PRIVATE_IGNORED_BODY')
        self.queue(Response(value={'access_token': jwt(), 'token_type': 'Bearer'}), accepted)
        result = self.deliver()
        self.assertEqual(result['status'], 'ACCEPTED')
        self.assertFalse(result['recipient_receipt_confirmed'])
        request = self.requests()[-1]
        self.assertEqual(request.full_url,
                         'https://graph.microsoft.com/v1.0/users/sender%40example.invalid/sendMail')
        self.assertEqual(request.get_method(), 'POST')
        self.assertEqual(request.get_header('Authorization'), 'Bearer ' + jwt())
        payload = json.loads(request.data)
        self.assertEqual(payload['message']['body'], {'contentType': 'Text', 'content': 'A safe review summary.'})
        self.assertEqual(payload['message']['toRecipients'],
                         [{'emailAddress': {'address': 'reviewer@example.invalid'}}])
        attachment = payload['message']['attachments'][0]
        self.assertEqual(attachment['@odata.type'], '#microsoft.graph.fileAttachment')
        self.assertEqual(attachment['name'], 'report.xlsx')
        self.assertEqual(base64.b64decode(attachment['contentBytes']), self.content)
        self.assertTrue(payload['saveToSentItems'])
        self.assertEqual(accepted.reads, [])
        self.assert_sanitized(result)

    def test_delegated_send_uses_me_and_supplied_token_takes_priority(self):
        self.configure(claims={'exp': NOW + 100, 'scp': 'Mail.Send'})
        self.env.update(APP)
        self.queue(Response(status=202))
        self.assertEqual(self.deliver()['status'], 'ACCEPTED')
        self.assertEqual(len(self.requests()), 1)
        self.assertEqual(self.requests()[0].full_url, 'https://graph.microsoft.com/v1.0/me/sendMail')

    def test_excel_attachment_limit_is_inclusive_and_precedes_login(self):
        self.configure(app=True)
        self.content = b'x' * n.MAX_ATTACHMENT_BYTES
        self.queue(Response(value={'access_token': jwt(), 'token_type': 'Bearer'}), Response(status=202))
        self.assertEqual(self.deliver()['status'], 'ACCEPTED')
        self.opener.open.reset_mock()
        self.content += b'x'
        result = self.deliver()
        self.assertEqual(result['error'], 'EXCEL_ATTACHMENT_TOO_LARGE')
        self.opener.open.assert_not_called()
        for content, path, error in [(b'', 'report.xlsx', 'EXCEL_ATTACHMENT_EMPTY'),
                                     (b'x', 'report.txt', 'EXCEL_ATTACHMENT_REQUIRED')]:
            self.content = content
            self.assertEqual(self.deliver(attachment_path=path)['error'], error)
        self.file_open.side_effect = FileNotFoundError('not-found-private')
        result = self.deliver(attachment_path='not-found-private.xlsx')
        self.assertEqual(result['error'], 'EXCEL_ATTACHMENT_UNAVAILABLE')
        self.assert_sanitized(result)
        self.opener.open.assert_not_called()

    def test_telegram_sends_minimal_text_and_no_bank_details_or_attachment(self):
        self.configure()
        self.queue(Response(value={'ok': True, 'result': {'message_id': 88,
                                                       'text': 'SYNTHETIC_PRIVATE_BODY'}}))
        result = self.deliver('telegram', summary='bank-account-test IBAN SWIFT PRIVATE',
                              attachment_path='bank-account-test.xlsx')
        self.assertEqual(result['status'], 'ACCEPTED')
        self.assertEqual(result['message_id'], 88)
        self.assertFalse(result['recipient_receipt_confirmed'])
        request = self.requests()[0]
        self.assertTrue(request.full_url.endswith('/sendMessage'))
        self.assertEqual(request.get_method(), 'POST')
        self.assertIsNone(request.get_header('Authorization'))
        payload = json.loads(request.data)
        self.assertEqual(set(payload), {'chat_id', 'text'})
        self.assertIn('IA-TEST v2', payload['text'])
        self.assertIn('does not authorize payment', payload['text'])
        for private in ('bank-account-test', 'IBAN', 'SWIFT', 'PRIVATE'):
            self.assertNotIn(private, payload['text'])
        self.file_open.assert_not_called()
        self.assert_sanitized(result)

    def test_post_timeouts_and_5xx_are_uncertain_without_retry(self):
        for channel in ('outlook', 'telegram'):
            for failure in (TimeoutError(BOT), URLError('SYNTHETIC_PRIVATE ' + BOT),
                            ConnectionResetError(BOT), http.client.IncompleteRead(b'PRIVATE'),
                            http_error(500), http_error(503)):
                with self.subTest(channel=channel, failure_type=type(failure).__name__):
                    self.configure()
                    self.opener.open.reset_mock()
                    self.queue(failure)
                    result = self.deliver(channel)
                    self.assertEqual(result['status'], 'UNCERTAIN')
                    self.assertEqual(result['action'], 'MANUAL_RECONCILIATION_REQUIRED')
                    self.assertEqual(self.opener.open.call_count, 1)
                    self.assert_sanitized(result)

    def test_4xx_failed_401_reconnect_429_delay_and_no_retry(self):
        for channel in ('outlook', 'telegram'):
            for code in (400, 401, 403, 404, 429):
                with self.subTest(channel=channel, code=code):
                    self.configure()
                    self.opener.open.reset_mock()
                    self.queue(http_error(code, retry=17))
                    result = self.deliver(channel)
                    self.assertEqual(result['status'], 'FAILED')
                    self.assertEqual(result['http_status'], code)
                    self.assertEqual(self.opener.open.call_count, 1)
                    if code == 401:
                        self.assertEqual(result['action'], 'RECONNECT_REQUIRED')
                    if code == 429:
                        self.assertEqual(result['retry_after'], 17)
                    self.assert_sanitized(result)

    def test_login_post_failures_are_not_uncertain_delivery(self):
        self.configure(app=True)
        del self.env['IA_TELEGRAM_BOT_TOKEN']
        for failure in (TimeoutError(BOT), http_error(503), http_error(401)):
            self.queue(failure)
            result = self.deliver()
            self.assertEqual(result['status'], 'FAILED')
            self.assert_sanitized(result)
        self.assertTrue(all(r.full_url.endswith('/token') for r in self.requests()))

    def test_telegram_429_body_delay_is_extracted_but_body_is_not_exposed(self):
        self.configure()
        self.queue(http_error(429, body={'ok': False, 'error_code': 429,
                                        'description': BOT, 'parameters': {'retry_after': 42}}))
        result = self.deliver('telegram')
        self.assertEqual(result['retry_after'], 42)
        self.assertEqual(result['status'], 'FAILED')
        self.assert_sanitized(result)
        for delay in ('SYNTHETIC_PRIVATE_BODY', -1, True, {'private': BOT}):
            self.queue(Response(value={'ok': False, 'error_code': 429,
                                       'description': BOT, 'parameters': {'retry_after': delay}}))
            result = self.deliver('telegram')
            self.assertNotIn('retry_after', result)
            self.assert_sanitized(result)

    def test_retry_after_http_date_and_invalid_values(self):
        self.assertEqual(n._retry_after('Fri, 15 Jan 2027 08:01:00 GMT'), 60)
        for value in (None, -1, True, 'SYNTHETIC_PRIVATE_BODY', 'NaN', '1.5'):
            self.assertIsNone(n._retry_after(value))
        self.assertEqual(n._retry_after('0'), 0)

    def test_telegram_api_errors_and_missing_message_id_are_not_receipts(self):
        self.configure()
        values = [({'ok': False, 'error_code': 401, 'description': BOT}, 'FAILED'),
                  ({'ok': False, 'error_code': 503, 'description': BOT}, 'UNCERTAIN'),
                  ({'ok': False, 'description': BOT}, 'FAILED'),
                  ({'ok': True, 'result': {}}, 'UNCERTAIN'),
                  ({'ok': True, 'result': {'message_id': True}}, 'UNCERTAIN'),
                  ({'ok': True, 'result': {'message_id': -1}}, 'UNCERTAIN'),
                  ({'ok': True, 'result': []}, 'UNCERTAIN'), ({}, 'UNCERTAIN')]
        for value, status in values:
            self.queue(Response(value=value))
            result = self.deliver('telegram')
            self.assertEqual(result['status'], status)
            self.assert_sanitized(result)

    def test_no_send_telegram_validation_failure_and_mismatched_chat(self):
        self.configure()
        for identity, destination in [({'id': 123456, 'is_bot': False}, None),
                                      ({'id': True, 'is_bot': True}, None),
                                      ({'id': 123456, 'is_bot': True}, {'id': -999}),
                                      ({'id': 123456, 'is_bot': True}, {'id': True})]:
            self.opener.open.reset_mock()
            responses = [Response(value={'ok': True, 'result': identity})]
            if destination is not None:
                responses.append(Response(value={'ok': True, 'result': destination}))
            self.queue(*responses)
            result = n.validate_connections()['telegram']
            self.assertEqual(result['status'], 'FAILED')
            self.assertFalse(any(r.full_url.endswith('/sendMessage') for r in self.requests()))
            self.assert_sanitized(result)
        self.queue(http_error(401))
        self.assertEqual(n.validate_connections()['telegram']['action'], 'RECONNECT_REQUIRED')

    def test_validation_transport_failures_are_failed_not_uncertain(self):
        self.configure()
        self.queue(TimeoutError(BOT))
        self.assertEqual(n.validate_connections()['telegram']['status'], 'FAILED')

    def test_redirect_handler_does_not_follow_any_redirect(self):
        handler = n._NoRedirect()
        for code in (301, 302, 303, 307, 308):
            self.assertIsNone(handler.redirect_request(None, None, code, '', {},
                                                       'https://untrusted.example.invalid/'))
            self.configure()
            self.queue(http_error(code))
            result = self.deliver('telegram')
            self.assertEqual(result['error'], 'REDIRECT_BLOCKED')
            self.assert_sanitized(result)
        for call in self.builder.call_args_list:
            self.assertIsInstance(call.args[0], HTTPRedirectHandler)
            self.assertIsInstance(call.args[0], n._NoRedirect)
        for call in self.opener.open.call_args_list:
            self.assertEqual(call.kwargs, {'timeout': n.TIMEOUT})

    def test_endpoint_allowlist_rejects_http_other_hosts_and_unsupported_methods(self):
        urls = ['http://graph.microsoft.com/v1.0/me/sendMail',
                'https://graph.microsoft.com.evil.invalid/v1.0/me/sendMail',
                'https://api.telegram.org.evil.invalid/bot' + BOT + '/sendMessage',
                'https://api.telegram.org/bot' + BOT + '/sendDocument',
                'https://graph.microsoft.com/v1.0/me/messages',
                'https://login.microsoftonline.com@evil.invalid/tenant/oauth2/v2.0/token']
        for url in urls:
            with self.assertRaises(n._Failure) as caught:
                n._request(url)
            self.assertEqual(caught.exception.outcome['error'], 'UNOFFICIAL_ENDPOINT_BLOCKED')
            self.assert_sanitized(caught.exception.outcome)
        self.builder.assert_not_called()

    def test_config_path_injection_and_bad_report_identity_are_rejected(self):
        self.configure(app=True)
        for tenant in ('common', 'organizations', 'consumers', '../evil', 'x?secret', 'https://evil.invalid'):
            self.env['IA_GRAPH_TENANT_ID'] = tenant
            self.assertEqual(self.deliver()['error'], 'GRAPH_TENANT_INVALID')
        self.env['IA_GRAPH_TENANT_ID'] = APP['IA_GRAPH_TENANT_ID']
        self.env['IA_GRAPH_SENDER'] = 'sender@example.invalid\r\nINJECTED'
        self.assertEqual(self.deliver()['error'], 'OUTLOOK_DESTINATIONS_INVALID')
        self.env.update(DESTINATIONS)
        for token in ('123:fake/../../sendMessage', 'https://evil.invalid', '123:fake?secret'):
            self.env['IA_TELEGRAM_BOT_TOKEN'] = token
            self.assertEqual(self.deliver('telegram')['error'], 'TELEGRAM_BOT_TOKEN_FORMAT_INVALID')
        self.env.update(DESTINATIONS)
        self.env['IA_TELEGRAM_CHAT_ID'] = '-12345?bank-account-test'
        self.assertEqual(self.deliver('telegram')['error'], 'TELEGRAM_CHAT_ID_INVALID')
        for report_id, version in [('../bank-account-test', 1), ('IA-TEST\nPRIVATE', 1),
                                   ('IA-TEST', True), ('IA-TEST', 0), ('IA-TEST', '2')]:
            self.assertEqual(self.deliver(report_id=report_id, version=version)['error'],
                             'REPORT_ID_OR_VERSION_INVALID')
        self.assertEqual(self.deliver(channel='unknown')['error'], 'UNSUPPORTED_CHANNEL')
        self.opener.open.assert_not_called()

    def test_malformed_oversized_responses_and_unexpected_graph_success_are_uncertain(self):
        self.configure()
        for raw in (b'SYNTHETIC_PRIVATE_NOT_JSON', b'[]', b'x' * (n.MAX_RESPONSE_BYTES + 1)):
            response = Response(raw=raw)
            self.queue(response)
            result = self.deliver('telegram')
            self.assertEqual(result['status'], 'UNCERTAIN')
            self.assert_sanitized(result)
            self.assertEqual(response.reads, [n.MAX_RESPONSE_BYTES + 1])
        for code in (200, 201, 204):
            self.queue(Response(status=code))
            result = self.deliver()
            self.assertEqual(result['status'], 'UNCERTAIN')
            self.assertEqual(result['error'], 'GRAPH_UNEXPECTED_SEND_STATUS')

    def test_nonexception_http_statuses_and_read_failures_are_classified(self):
        self.configure()
        for code, status in ((401, 'FAILED'), (429, 'FAILED'), (503, 'UNCERTAIN')):
            self.queue(Response(status=code, headers={'Retry-After': '9'}))
            result = self.deliver('telegram')
            self.assertEqual(result['status'], status)
            self.assertEqual(result['http_status'], code)
            if code == 429:
                self.assertEqual(result['retry_after'], 9)
            self.assert_sanitized(result)
        response = Response(value={'ok': True})
        response.read = MagicMock(side_effect=TimeoutError('SYNTHETIC_PRIVATE_BODY ' + BOT))
        self.queue(response)
        self.assertEqual(self.deliver('telegram')['status'], 'UNCERTAIN')

    def test_zero_telegram_retry_delay_is_preserved(self):
        self.configure()
        self.queue(http_error(429, retry=30, body={'parameters': {'retry_after': 0}}))
        result = self.deliver('telegram')
        self.assertEqual(result['retry_after'], 0)
        self.assert_sanitized(result)

    def test_telegram_named_chat_validation_and_excel_formats(self):
        self.configure()
        self.env['IA_TELEGRAM_CHAT_ID'] = '@synthetic_channel'
        self.queue(Response(value={'ok': True, 'result': {'id': 123456, 'is_bot': True}}),
                   Response(value={'ok': True, 'result': {'id': -12345}}))
        self.assertEqual(n.validate_connections()['telegram']['status'], 'VALIDATED')
        for path, mime in [('report.xls', 'application/vnd.ms-excel'),
                           ('report.xlsm', 'application/vnd.ms-excel.sheet.macroEnabled.12')]:
            self.queue(Response(status=202))
            self.assertEqual(self.deliver(attachment_path=path)['status'], 'ACCEPTED')
            attachment = json.loads(self.requests()[-1].data)['message']['attachments'][0]
            self.assertEqual(attachment['contentType'], mime)

    def test_no_send_validation_does_not_invent_success_for_malformed_login(self):
        self.configure(app=True)
        del self.env['IA_TELEGRAM_BOT_TOKEN']
        self.queue(Response(raw=b'SYNTHETIC_PRIVATE_NOT_JSON'))
        result = n.validate_connections()['outlook']
        self.assertEqual(result['status'], 'FAILED')
        self.assert_sanitized(result)
        self.opener.open.reset_mock()
        self.queue(Response(value={'token_type': [], 'access_token': jwt()}))
        result = n.validate_connections()['outlook']
        self.assertEqual(result['status'], 'FAILED')
        self.assert_sanitized(result)

    def test_runner_destination_hash_accepts_rotation_but_invalidates_changes(self):
        from runner import unchanged, digest
        self.configure()
        content = {'destinations': n.destination_manifest()}
        manifest = {'content_hash': digest(content), 'paths': {}, 'file_hashes': {},
                    'destination_hash': digest(content['destinations'])}
        db = MagicMock()
        db.execute.return_value.fetchone.return_value = {'v': 2}
        self.env['IA_GRAPH_ACCESS_TOKEN'] = jwt({'exp': NOW + 8000, 'scp': 'Mail.Send'})
        unchanged(db, 'IA-TEST', 2, manifest, content)
        self.env['IA_OUTLOOK_RECIPIENTS'] = 'changed@example.invalid'
        with self.assertRaisesRegex(ValueError, 'APPROVAL_INVALIDATED_DESTINATIONS_CHANGED'):
            unchanged(db, 'IA-TEST', 2, manifest, content)
        self.opener.open.assert_not_called()


if __name__ == '__main__':
    unittest.main()
