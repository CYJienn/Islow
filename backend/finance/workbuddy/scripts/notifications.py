"""Approval-gated urllib notifications; no connector credentials or automatic retries.

Graph validation inspects token claims only (not a verified signature or mailbox
availability). Telegram validation performs getMe/getChat, never a test message.
API acceptance is not recipient receipt. Importing this module performs no I/O.
"""
import base64
import binascii
from email.utils import parsedate_to_datetime
import http.client
import json
import math
import os
from pathlib import Path
import re
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener


TIMEOUT = 20
MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024
MAX_RESPONSE_BYTES = 1024 * 1024
GRAPH_SCOPE = 'https://graph.microsoft.com/.default'
_ENDPOINT = re.compile(
    r'https://(?:login\.microsoftonline\.com/[A-Za-z0-9.-]+/oauth2/v2\.0/token'
    r'|graph\.microsoft\.com/v1\.0/(?:me|users/[^/?#]+)/sendMail'
    r'|api\.telegram\.org/bot[0-9]+:[A-Za-z0-9_-]+/(?:getMe|getChat|sendMessage))\Z'
)
_EMAIL = re.compile(r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9][A-Za-z0-9.-]*\Z")


class _Failure(Exception):
    def __init__(self, outcome):
        super().__init__(outcome['error'])
        self.outcome = outcome


def _fail(error, status='FAILED', action='FIX_CONFIGURATION_OR_INPUT', **details):
    raise _Failure({'status': status, 'error': error, 'action': action, **details})


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _env(name):
    return os.environ.get(name, '').strip()


def _destinations():
    sender = _env('IA_GRAPH_SENDER').lower()
    recipients = sorted({item.strip().lower() for item in
                         _env('IA_OUTLOOK_RECIPIENTS').split(',') if item.strip()})
    return sender, recipients


def destination_manifest():
    """Stable destinations and credential-presence flags, never credential values."""
    sender, recipients = _destinations()
    app_configured = all(bool(_env(name)) for name in
                         ('IA_GRAPH_TENANT_ID', 'IA_GRAPH_CLIENT_ID', 'IA_GRAPH_CLIENT_SECRET'))
    token_configured = bool(_env('IA_GRAPH_ACCESS_TOKEN'))
    chat_id = _env('IA_TELEGRAM_CHAT_ID')
    return {
        'outlook': {'configured': bool(sender and recipients and (app_configured or token_configured)),
                    'app_login_configured': app_configured,
                    'access_token_configured': token_configured,
                    'sender': sender, 'recipients': recipients},
        'telegram': {'configured': bool(chat_id and _env('IA_TELEGRAM_BOT_TOKEN')),
                     'chat_id': chat_id},
    }


def _retry_after(value):
    if isinstance(value, bool):
        return None
    if isinstance(value, int) and value >= 0:
        return value
    if isinstance(value, str):
        if re.fullmatch(r'[0-9]{1,10}', value.strip()):
            return int(value.strip())
        try:
            date = parsedate_to_datetime(value)
            if date.tzinfo is not None:
                return max(0, math.ceil(date.timestamp() - time.time()))
        except (ValueError, TypeError, OverflowError):
            pass
    return None


def _http_failure(code, sending, retry=None):
    if 300 <= code < 400:
        _fail('REDIRECT_BLOCKED', action='NO_AUTOMATIC_RETRY', http_status=code)
    uncertain = sending and 500 <= code < 600
    action = ('MANUAL_RECONCILIATION_REQUIRED' if uncertain else
              'RECONNECT_REQUIRED' if code == 401 else
              'WAIT_BEFORE_MANUAL_RETRY' if code == 429 else 'NO_AUTOMATIC_RETRY')
    details = {'http_status': code}
    if code == 429 and retry is not None:
        details['retry_after'] = retry
    _fail('HTTP_ERROR', status='UNCERTAIN' if uncertain else 'FAILED', action=action, **details)


def _decode_json(raw):
    if len(raw) > MAX_RESPONSE_BYTES:
        raise ValueError('RESPONSE_TOO_LARGE')
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError('INVALID_RESPONSE')
    return value


def _request(url, method='GET', payload=None, token=None, form=None,
             sending=False, read_json=True):
    if not _ENDPOINT.fullmatch(url):
        _fail('UNOFFICIAL_ENDPOINT_BLOCKED')
    headers = {'Accept': 'application/json'}
    data = None
    if form is not None:
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
        data = urlencode(form).encode('utf-8')
    elif payload is not None:
        headers['Content-Type'] = 'application/json'
        data = json.dumps(payload, ensure_ascii=True).encode('utf-8')
    if token is not None:
        headers['Authorization'] = 'Bearer ' + token
    try:
        request = Request(url, data=data, headers=headers, method=method)
        with build_opener(_NoRedirect()).open(request, timeout=TIMEOUT) as response:
            code = response.status
            if not 200 <= code < 300:
                _http_failure(code, sending, _retry_after(response.headers.get('Retry-After')))
            value = _decode_json(response.read(MAX_RESPONSE_BYTES + 1)) if read_json else None
            return code, value
    except _Failure:
        raise
    except HTTPError as exc:
        retry = _retry_after(exc.headers.get('Retry-After')) if exc.headers else None
        # Only extract the numeric throttle delay; never expose error bodies.
        if exc.code == 429 and url.startswith('https://api.telegram.org/'):
            try:
                parameters = _decode_json(exc.read(MAX_RESPONSE_BYTES + 1)).get('parameters', {})
                if isinstance(parameters, dict):
                    body_retry = _retry_after(parameters.get('retry_after'))
                    if body_retry is not None:
                        retry = body_retry
            except Exception:
                pass
        exc.close()
        _http_failure(exc.code, sending, retry)
    except (TimeoutError, URLError, OSError, http.client.HTTPException):
        _fail('TRANSPORT_ERROR', status='UNCERTAIN' if sending else 'FAILED',
              action='MANUAL_RECONCILIATION_REQUIRED' if sending else 'CHECK_CONNECTION')
    except Exception:
        _fail('INVALID_OR_INCOMPLETE_RESPONSE', status='UNCERTAIN' if sending else 'FAILED',
              action='MANUAL_RECONCILIATION_REQUIRED' if sending else 'CHECK_CONNECTION')


def _token_mode(token):
    # This is claim inspection, not JWT signature verification. Graph verifies
    # the credential on send; no mailbox probe or send-permission test is made.
    try:
        parts = token.split('.')
        if (len(parts) != 3 or len(token) > 65536
                or not all(re.fullmatch(r'[A-Za-z0-9_-]+', part) for part in parts)):
            raise ValueError('INVALID_TOKEN')
        payload = parts[1]
        claims = json.loads(base64.b64decode(payload + '=' * (-len(payload) % 4),
                                            altchars=b'-_', validate=True))
        if not isinstance(claims, dict):
            raise ValueError('INVALID_CLAIMS')
        expiry = claims.get('exp')
        if isinstance(expiry, bool) or not isinstance(expiry, (int, float)) or not math.isfinite(expiry):
            raise ValueError('INVALID_EXPIRY')
        if expiry <= time.time():
            _fail('GRAPH_TOKEN_EXPIRED', action='RECONNECT_REQUIRED')
        not_before = claims.get('nbf')
        if not_before is not None:
            if (isinstance(not_before, bool) or not isinstance(not_before, (int, float))
                    or not math.isfinite(not_before) or not_before > time.time()):
                _fail('GRAPH_TOKEN_NOT_YET_VALID', action='RECONNECT_REQUIRED')
        audience = claims.get('aud')
        if audience is not None and audience not in (
                'https://graph.microsoft.com', 'https://graph.microsoft.com/',
                '00000003-0000-0000-c000-000000000000'):
            _fail('GRAPH_TOKEN_WRONG_AUDIENCE', action='RECONNECT_REQUIRED')
        scopes = claims.get('scp')
        roles = claims.get('roles')
        if scopes is not None:
            if isinstance(scopes, str) and 'Mail.Send' in scopes.split():
                return 'delegated'
        elif isinstance(roles, list) and 'Mail.Send' in roles:
            return 'application'
        _fail('GRAPH_MAIL_SEND_PERMISSION_MISSING', action='RECONNECT_REQUIRED')
    except _Failure:
        raise
    except (ValueError, TypeError, binascii.Error, OverflowError):
        _fail('GRAPH_TOKEN_CLAIMS_INVALID', action='RECONNECT_REQUIRED')


def _graph_token():
    token = _env('IA_GRAPH_ACCESS_TOKEN')
    if token:
        return token, _token_mode(token)
    tenant = _env('IA_GRAPH_TENANT_ID')
    client = _env('IA_GRAPH_CLIENT_ID')
    secret = os.environ.get('IA_GRAPH_CLIENT_SECRET', '')
    if not all((tenant, client, secret.strip())):
        _fail('GRAPH_SCRIPT_CREDENTIALS_NOT_CONFIGURED', status='NOT_CONFIGURED',
              action='CONFIGURE_SCRIPT_ENVIRONMENT')
    if (not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9.-]{0,253}', tenant)
            or tenant.lower() in ('common', 'organizations', 'consumers')):
        _fail('GRAPH_TENANT_INVALID')
    _, value = _request('https://login.microsoftonline.com/' + tenant + '/oauth2/v2.0/token',
                        method='POST', form={'grant_type': 'client_credentials',
                                             'client_id': client, 'client_secret': secret,
                                             'scope': GRAPH_SCOPE})
    token = value.get('access_token')
    if not isinstance(token, str) or not token or value.get('token_type', '').lower() != 'bearer':
        _fail('GRAPH_LOGIN_RESPONSE_INVALID', action='RECONNECT_REQUIRED')
    mode = _token_mode(token)
    if mode != 'application':
        _fail('GRAPH_APP_LOGIN_REQUIRES_APPLICATION_TOKEN', action='RECONNECT_REQUIRED')
    return token, mode


def _outlook_destinations():
    sender, recipients = _destinations()
    if not sender or not recipients:
        _fail('OUTLOOK_DESTINATIONS_NOT_CONFIGURED', status='NOT_CONFIGURED',
              action='CONFIGURE_SCRIPT_ENVIRONMENT')
    if not all(_EMAIL.fullmatch(item) for item in [sender, *recipients]):
        _fail('OUTLOOK_DESTINATIONS_INVALID')
    return sender, recipients


def _telegram_configuration():
    token, chat = _env('IA_TELEGRAM_BOT_TOKEN'), _env('IA_TELEGRAM_CHAT_ID')
    if not token or not chat:
        _fail('TELEGRAM_SCRIPT_CREDENTIALS_NOT_CONFIGURED', status='NOT_CONFIGURED',
              action='CONFIGURE_SCRIPT_ENVIRONMENT')
    if not re.fullmatch(r'[0-9]{1,20}:[A-Za-z0-9_-]{1,200}', token):
        _fail('TELEGRAM_BOT_TOKEN_FORMAT_INVALID', action='RECONNECT_REQUIRED')
    if not re.fullmatch(r'-?[0-9]{1,20}|@[A-Za-z][A-Za-z0-9_]{4,31}', chat):
        _fail('TELEGRAM_CHAT_ID_INVALID')
    return token, chat


def _telegram_api(token, method, payload=None, sending=False):
    _, value = _request('https://api.telegram.org/bot' + token + '/' + method,
                        method='POST' if payload is not None else 'GET',
                        payload=payload, sending=sending)
    if value.get('ok') is False:
        code = value.get('error_code')
        if isinstance(code, int) and not isinstance(code, bool) and 400 <= code < 600:
            parameters = value.get('parameters', {})
            retry = _retry_after(parameters.get('retry_after')) if isinstance(parameters, dict) else None
            _http_failure(code, sending, retry)
        _fail('TELEGRAM_API_REJECTED', action='NO_AUTOMATIC_RETRY')
    result = value.get('result')
    if value.get('ok') is not True or not isinstance(result, dict):
        _fail('TELEGRAM_RESPONSE_INVALID', status='UNCERTAIN' if sending else 'FAILED',
              action='MANUAL_RECONCILIATION_REQUIRED' if sending else 'CHECK_CONNECTION')
    return result


def validate_connections():
    """No-send checks; a connected Outlook connector does not configure these APIs."""
    results = {}
    for channel in ('outlook', 'telegram'):
        try:
            if channel == 'outlook':
                _outlook_destinations()
                _, mode = _graph_token()
                results[channel] = {'status': 'VALIDATED', 'auth_mode': mode,
                                    'permission': 'Mail.Send', 'proof': 'TOKEN_CLAIMS_ONLY',
                                    'signature_verified': False, 'mailbox_availability_checked': False,
                                    'send_permission_tested': False, 'messages_sent': False}
            else:
                token, chat = _telegram_configuration()
                identity = _telegram_api(token, 'getMe')
                if identity.get('is_bot') is not True or type(identity.get('id')) is not int:
                    _fail('TELEGRAM_BOT_IDENTITY_INVALID')
                destination = _telegram_api(token, 'getChat', {'chat_id': chat})
                chat_id = destination.get('id')
                if type(chat_id) is not int or (not chat.startswith('@') and chat_id != int(chat)):
                    _fail('TELEGRAM_CHAT_LOOKUP_INVALID')
                results[channel] = {'status': 'VALIDATED', 'bot_identity_checked': True,
                                    'chat_lookup_checked': True, 'send_permission_tested': False,
                                    'messages_sent': False}
        except _Failure as exc:
            results[channel] = exc.outcome
        except Exception:
            results[channel] = {'status': 'FAILED', 'error': 'VALIDATION_FAILED',
                                'action': 'CHECK_CONFIGURATION'}
    return results


def _attachment(path):
    try:
        path = Path(path)
        mime = {'.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                '.xls': 'application/vnd.ms-excel',
                '.xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12'}.get(path.suffix.lower())
        if mime is None:
            _fail('EXCEL_ATTACHMENT_REQUIRED')
        with path.open('rb') as source:
            content = source.read(MAX_ATTACHMENT_BYTES + 1)
        if len(content) > MAX_ATTACHMENT_BYTES:
            _fail('EXCEL_ATTACHMENT_TOO_LARGE')
        if not content:
            _fail('EXCEL_ATTACHMENT_EMPTY')
        return {'@odata.type': '#microsoft.graph.fileAttachment', 'name': path.name,
                'contentType': mime, 'contentBytes': base64.b64encode(content).decode('ascii')}
    except _Failure:
        raise
    except (OSError, TypeError, ValueError):
        _fail('EXCEL_ATTACHMENT_UNAVAILABLE')


def deliver(channel, report_id, version, summary, attachment_path, approved=False):
    """Submit once only after exact True approval; ACCEPTED never means receipt."""
    if approved is not True:
        return {'status': 'FAILED', 'error': 'EXPLICIT_APPROVAL_REQUIRED',
                'action': 'OBTAIN_EXACT_REPORT_APPROVAL'}
    try:
        if channel not in ('outlook', 'telegram'):
            _fail('UNSUPPORTED_CHANNEL')
        if (not isinstance(report_id, str)
                or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,127}', report_id)
                or type(version) is not int or version < 1):
            _fail('REPORT_ID_OR_VERSION_INVALID')
        if channel == 'outlook':
            sender, recipients = _outlook_destinations()
            if not isinstance(summary, str) or not summary.strip():
                _fail('REPORT_SUMMARY_REQUIRED')
            attachment = _attachment(attachment_path)
            token, mode = _graph_token()
            target = 'me' if mode == 'delegated' else 'users/' + quote(sender, safe='')
            payload = {'message': {'subject': 'Invoice assurance ' + report_id + ' v' + str(version),
                                   'body': {'contentType': 'Text', 'content': summary},
                                   'toRecipients': [{'emailAddress': {'address': item}} for item in recipients],
                                   'attachments': [attachment]}, 'saveToSentItems': True}
            code, _ = _request('https://graph.microsoft.com/v1.0/' + target + '/sendMail',
                               method='POST', payload=payload, token=token, sending=True, read_json=False)
            if code != 202:
                _fail('GRAPH_UNEXPECTED_SEND_STATUS', status='UNCERTAIN',
                      action='MANUAL_RECONCILIATION_REQUIRED', http_status=code)
            return {'status': 'ACCEPTED', 'accepted_by': 'MICROSOFT_GRAPH',
                    'http_status': 202, 'recipient_receipt_confirmed': False}
        token, chat = _telegram_configuration()
        # Never forward caller-provided text, bank details, or the workbook to Telegram.
        text = ('Invoice assurance ' + report_id + ' v' + str(version) + ' is ready for human review. '
                'Flagged risk is not confirmed fraud or prevented loss. '
                'Distribution approval does not authorize payment.')
        result = _telegram_api(token, 'sendMessage', {'chat_id': chat, 'text': text}, sending=True)
        message_id = result.get('message_id')
        if type(message_id) is not int or message_id <= 0:
            _fail('TELEGRAM_MESSAGE_ID_MISSING', status='UNCERTAIN', action='MANUAL_RECONCILIATION_REQUIRED')
        return {'status': 'ACCEPTED', 'accepted_by': 'TELEGRAM_API', 'message_id': message_id,
                'recipient_receipt_confirmed': False}
    except _Failure as exc:
        return exc.outcome
    except Exception:
        return {'status': 'FAILED', 'error': 'NOTIFICATION_CONFIGURATION_FAILED',
                'action': 'CHECK_CONFIGURATION'}
