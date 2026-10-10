"""Telegram review requests and explicitly authorized approval commands."""
import json
import os
import threading
import time
from service import digest, destinations, configuration_status


def approval_code(report):
    return digest([report['report_digest'], destinations()])[:24]


def result_text(report, config, include_approval=True):
    lines = ['Invoice check results']
    for case in report['cases'][:12]:
        name = case.get('invoice_reference') or case.get('invoice_id') or 'Unknown invoice'
        comparison = next((f for f in case['findings'] if f['rule_id'] == 'FINANCE_EXPORT_COMPARISON'), None)
        matched = comparison and comparison['status'] == 'PASS'
        result = 'Valid against the Excel reference' if matched else 'Does not match the Excel reference' if comparison and comparison['status'] == 'FAIL' else 'Reference match requires review'
        label = 'Invoice'
        lines.append(f"\n{label} {name}: {result}.")
        lines.append('Verification: ' + ('Suspected risk found' if case['flagged'] else 'Needs review — missing evidence' if case['unresolved'] else 'Checks complete') + '.')
    if len(report['cases']) > 12:
        lines.append(f"Plus {len(report['cases']) - 12} invoices in the frontend report.")
    if not report['cases']:
        lines.append('No invoice candidates found.')
    from final_report import batch_results
    batch = report.get('batch_results') or batch_results(report['cases'])
    lines.append(f"\nFinal result: {batch['valid_reference_matches']} valid reference matches; {batch['invalid_reference_matches']} mismatches; {batch['fully_verified']} fully verified.")
    for label, key in [('Suspected exposure', 'supplied_suspected_exposure'), ('Test suspected exposure', 'test_suspected_exposure')]:
        totals = batch[key]
        if totals:
            lines.append(label + ': ' + '; '.join(currency + ' ' + value for currency, value in totals.items()) + '.')
    lines.append('Confirmed fraud: not established. Exposure counts each flagged business invoice once, using its full amount.')
    lines += ['\nOneDrive account: ' + (os.environ.get('ONEDRIVE_ACCOUNT', '').strip() or 'Not configured'),
              'OneDrive invoice folder: ' + config.get('invoice_input_dir', 'Not configured'),
              'Excel reference: ' + str(config.get('workbook', 'Not configured')),
              '\nReview details in the Finance panel of your frontend.']
    if include_approval:
        lines += ['Approve report distribution only (does not clear findings or authorize payment):',
                  f"/approve {report['report_id']} {approval_code(report)}",
                  f"/reject {report['report_id']} {approval_code(report)}"]
    return '\n'.join(lines)


def notify(service, report_id):
    if not service.config().get('telegram_review_enabled'):
        return 'DISABLED'
    if not configuration_status()['telegram']['configured']:
        return 'NOT_CONFIGURED'
    with service.lock:
        report = service.report(report_id)
        channel, target = 'telegram_review', digest(destinations())
        with service.db() as db:
            previous = db.execute('SELECT * FROM deliveries WHERE report_id=? AND channel=? AND destination_digest=?',
                                  (report_id, channel, target)).fetchone()
        if previous:
            return previous['status']
        service.delivery_record(report_id, channel, target, 'IN_FLIGHT', 1)
        text = result_text(report, service.config(), include_approval=False)
        try:
            _, body = service.transport('https://api.telegram.org/bot' + os.environ['TELEGRAM_BOT_TOKEN'] + '/sendMessage',
                                        {'chat_id': destinations()['telegram'], 'text': text,
                                         'reply_markup': {'inline_keyboard': [[
                                             {'text': 'Approve report', 'callback_data': f'approve|{report_id}|{approval_code(report)}'},
                                             {'text': 'Reject report', 'callback_data': f'reject|{report_id}|{approval_code(report)}'}]]}})
            data = json.loads(body)
            if not data.get('ok') or not data.get('result', {}).get('message_id'):
                raise ValueError('Unconfirmed response')
            service.delivery_record(report_id, channel, target, 'SENT_TO_TELEGRAM', 1,
                                    message_id=str(data['result']['message_id']))
            return 'SENT_TO_TELEGRAM'
        except Exception:
            service.delivery_record(report_id, channel, target, 'UNCERTAIN', 1,
                                    error='Review message not confirmed; inspect Telegram before retrying')
            return 'UNCERTAIN'


def handle(service, message):
    target = destinations()['telegram']
    if (message.get('chat', {}).get('type') != 'private' or str(message.get('chat', {}).get('id')) != target
            or str(message.get('from', {}).get('id')) != target or message.get('from', {}).get('is_bot')):
        return False
    parts = message.get('text', '').split()
    if len(parts) != 3 or parts[0] not in ('/approve', '/reject'):
        return False
    with service.lock:
        report = service.report(parts[1])
        service.verify(parts[1])
        if parts[2] != approval_code(report):
            return False
        decision = 'APPROVED' if parts[0] == '/approve' else 'REJECTED'
        service.review_start(parts[1])
        service.decide(parts[1], report['report_digest'], decision,
                       ('APPROVE DISTRIBUTION ' if decision == 'APPROVED' else 'REJECT DISTRIBUTION ') + parts[1])
        if decision == 'APPROVED':
            service.distribute(parts[1], 'SEND ' + parts[1])
        return True


def start_listener(service):
    if not service.config().get('telegram_review_enabled') or not configuration_status()['telegram']['configured']:
        return
    def listen():
        path = service.state / 'telegram-offset.json'
        offset = json.loads(path.read_text()).get('offset', 0) if path.exists() else 0
        started = time.time()
        while True:
            try:
                _, body = service.transport('https://api.telegram.org/bot' + os.environ['TELEGRAM_BOT_TOKEN'] + '/getUpdates',
                                            {'offset': offset, 'timeout': 10, 'allowed_updates': ['message', 'callback_query']})
                data = json.loads(body)
                if not data.get('ok'):
                    raise ValueError('Polling failed')
                for update in data.get('result', []):
                    offset = update['update_id'] + 1
                    path.write_text(json.dumps({'offset': offset}))
                    callback = update.get('callback_query')
                    if callback:
                        parts = callback.get('data', '').split('|')
                        accepted = False
                        if len(parts) == 3 and parts[0] in ('approve', 'reject'):
                            try:
                                accepted = handle(service, {'chat': callback.get('message', {}).get('chat', {}),
                                                            'from': callback.get('from', {}),
                                                            'text': '/' + parts[0] + ' ' + parts[1] + ' ' + parts[2]})
                            except Exception:
                                pass
                        service.transport('https://api.telegram.org/bot' + os.environ['TELEGRAM_BOT_TOKEN'] + '/answerCallbackQuery',
                                          {'callback_query_id': callback['id'],
                                           'text': 'Report approval recorded; check final delivery in the frontend.' if accepted and parts[0] == 'approve'
                                                   else 'Report rejected.' if accepted else 'Not accepted. Check the sender and rerun if the report changed.'})
                        continue
                    message = update.get('message', {})
                    if message.get('date', 0) < started:
                        continue
                    try:
                        handle(service, message)
                    except Exception:
                        pass  # Stale/invalid reports never approve; do not log token-bearing errors.
            except Exception:
                time.sleep(5)
    threading.Thread(target=listen, daemon=True, name='telegram-approvals').start()
