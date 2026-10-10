"""Batch verdicts and deduplicated suspected exposure, with tests kept explicit."""
try:
    from .engine import summarize
except ImportError:
    from engine import summarize


def batch_results(cases):
    rows = []
    for case in cases:
        comparison = next((f for f in case['findings'] if f['rule_id'] == 'FINANCE_EXPORT_COMPARISON'), None)
        verdict = 'VALID_REFERENCE_MATCH' if comparison and comparison['status'] == 'PASS' else 'INVALID_REFERENCE_MATCH' if comparison and comparison['status'] == 'FAIL' else 'NEEDS_REVIEW'
        rows.append({'invoice': case['invoice_reference'] or case['invoice_id'], 'source': case['source_ref'].split('::')[0],
                     'reference_verdict': verdict, 'verification': case['status'], 'currency': case['currency'],
                     'amount': case['amount'], 'flagged': case['flagged'], 'dataset_kind': case['dataset_kind'],
                     'failed_rules': [f['rule_id'] for f in case['findings'] if f['status'] == 'FAIL']})
    # Reuse the same deduplication within each dataset, never mix demo exposure into production.
    exposure = {}
    for kind in ('SUPPLIED', 'TEST'):
        summary = summarize([{**c, 'dataset_kind': 'SUPPLIED'} for c in cases if c['dataset_kind'] == kind])
        exposure[kind] = summary['flagged_exposure']
    return {'invoices': rows, 'checked': len(rows),
            'valid_reference_matches': sum(r['reference_verdict'] == 'VALID_REFERENCE_MATCH' for r in rows),
            'invalid_reference_matches': sum(r['reference_verdict'] == 'INVALID_REFERENCE_MATCH' for r in rows),
            'fully_verified': sum(c['status'] == 'CHECKS_COMPLETE' for c in cases),
            'supplied_suspected_exposure': exposure['SUPPLIED'], 'test_suspected_exposure': exposure['TEST'],
            'confirmed_fraud': 'NOT_ESTABLISHED',
            'exposure_method': 'Full face amount of flagged invoices, deduplicated by business identity; not confirmed loss or just the excess charged.'}


def markdown(report):
    batch = report.get('batch_results') or batch_results(report['cases'])
    lines = ['# Invoice final report', '', 'Report: ' + report['report_id'], '',
             'A valid reference match means the header matches the Excel export. It does not certify authenticity or clear missing evidence.', '',
             '| Invoice | Source | Excel comparison | Overall verification | Amount |',
             '| --- | --- | --- | --- | --- |']
    def safe(value):
        return str(value or '').replace('|', '\\|').replace('\n', ' ')
    for r in batch['invoices']:
        lines.append('| ' + ' | '.join(map(safe, [r['invoice'], r['source'], r['reference_verdict'], r['verification'], r['currency'] + ' ' + str(r['amount'])])) + ' |')
    lines += ['', f"Reference matches: {batch['valid_reference_matches']}; mismatches: {batch['invalid_reference_matches']}; fully verified: {batch['fully_verified']}.", '',
              '## Suspected risk exposure', '']
    for label, key in [('Supplied invoices', 'supplied_suspected_exposure'), ('Synthetic test invoices', 'test_suspected_exposure')]:
        totals = batch[key]
        lines.append(label + ': ' + ('; '.join(currency + ' ' + value for currency, value in totals.items()) or 'No quantified flagged exposure') + '.')
    lines += ['', 'Confirmed fraud: not established.', batch['exposure_method'], '',
              'Test invoices are excluded from accepted finance_export.json. Approval permits report distribution only.',
              'Live GPT review was skipped for synthetic tests; document matching and risk checks were deterministic.']
    return '\n'.join(lines) + '\n'
