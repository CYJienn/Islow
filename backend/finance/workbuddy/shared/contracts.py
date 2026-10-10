"""Shared, fail-closed contracts. No source content is executable policy."""
from pathlib import Path
from decimal import Decimal, InvalidOperation
from datetime import datetime, timezone
import hashlib
import json
import re

ROOT = Path(__file__).resolve().parents[1]
DOMAINS = ('intake', 'matching', 'fraud', 'accounting')
TABLES = ('invoices', 'invoice_lines', 'vendors', 'po_headers', 'po_lines', 'receipts', 'allocations', 'gl_accounts', 'approval_authority', 'approval_decisions', 'pricing_conditions', 'tax_rules', 'fx_rates', 'bank_verifications')
STATUSES = ('PASS', 'FAIL', 'UNKNOWN', 'NOT_APPLICABLE')


def now():
    return datetime.now(timezone.utc).isoformat()


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':'), allow_nan=False)


def digest(value):
    return hashlib.sha256(canonical(value).encode('utf-8')).hexdigest()


def file_hash(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def number(value):
    if value is None or isinstance(value, bool) or str(value).strip() == '':
        return None
    try:
        result = Decimal(str(value))
        return result if result.is_finite() else None
    except InvalidOperation:
        return None


def validate(value, schema_name):
    from jsonschema import Draft202012Validator
    schema = json.loads((ROOT / 'schemas' / (schema_name + '.schema.json')).read_text(encoding='utf-8'))
    Draft202012Validator(schema).validate(value)
    return value


def business_id(batch, invoice):
    identity = invoice.get('invoice_id')
    if not identity:
        required = ('vendor_id', 'invoice_number', 'invoice_date', 'currency')
        if not all(invoice.get(k) for k in required):
            raise ValueError('MISSING_STABLE_BUSINESS_ID')
        identity = '|'.join(str(invoice[k]) for k in required)
    return digest([batch['dataset_id'], invoice.get('company_code', 'UNSPECIFIED'), invoice.get('fiscal_year', 'UNSPECIFIED'), str(identity)])


def refs(*records):
    return [r['source_ref'] for r in records if isinstance(r, dict) and r.get('source_ref')]


def finding(rule_id, status, source_refs, observed, expected, explanation, action, evidence='CONFIRMED', severity='INFO'):
    if status not in STATUSES or evidence not in ('CONFIRMED', 'INFERRED_CANDIDATE', 'MISSING'):
        raise ValueError('Invalid finding classification')
    if status == 'PASS' and (not source_refs or evidence != 'CONFIRMED'):
        raise ValueError('Missing or inferred evidence cannot PASS')
    return {'rule_id': rule_id, 'status': status, 'source_refs': source_refs, 'observed_value': observed, 'expected_value': expected, 'explanation': explanation, 'recommended_action': action, 'evidence_class': evidence, 'severity': severity}


def envelope(batch, invoice, domain, findings, errors=None):
    value = {'schema_version': '1.0', 'batch_id': batch['batch_id'], 'business_id': business_id(batch, invoice), 'invoice_id': str(invoice.get('invoice_id') or invoice.get('invoice_number')), 'domain': domain, 'input_hash': digest(batch), 'findings': findings, 'errors': errors or [], 'completed_at': now()}
    return validate(value, 'handoff')


def related(batch, table, **keys):
    return [r for r in batch['tables'].get(table, []) if all(str(r.get(k)) == str(v) for k, v in keys.items())]


def unique(records):
    return records[0] if len(records) == 1 else None


def redact(value):
    """Bank details and credential-like keys never enter generated reports/messages."""
    if isinstance(value, dict):
        return {k: ('[REDACTED]' if re.search(r'bank|iban|swift|account_number|token|secret|password|credential', k, re.I) else redact(v)) for k, v in value.items()}
    if isinstance(value, list):
        return [redact(v) for v in value]
    return value


def public_finding(value):
    value = redact(value)
    if value.get('rule_id', '').startswith('FRAUD.BANK'):
        value['observed_value'] = '[BANK COMPARISON REDACTED]'
        value['expected_value'] = 'Independently verified vendor bank details; values withheld'
    return value
