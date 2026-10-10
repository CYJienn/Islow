"""Evidence-gated invoice checks; no payments, inferred allocations or remote I/O."""
import argparse
from datetime import date, datetime
from decimal import Decimal, localcontext
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from shared import contracts

RULES = json.loads((ROOT / 'shared' / 'rules.json').read_text(encoding='utf-8'))


def present(record, *fields):
    return all(isinstance(record.get(k), (str, int)) and not isinstance(record[k], bool)
               and str(record[k]).strip() for k in fields)


def same(left, right):
    return str(left) == str(right)


def day(value):
    if not isinstance(value, str):
        return None
    try:
        if re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
            return date.fromisoformat(value)
        if re.match(r'^\d{4}-\d{2}-\d{2}T', value):
            return datetime.fromisoformat(value.replace('Z', '+00:00')).date()
    except ValueError:
        pass
    return None


def money(value):
    return str(value) if isinstance(value, Decimal) else value


def emit(rule, status, records, observed, expected, explanation, evidence=None):
    source_refs = list(dict.fromkeys(ref for ref in contracts.refs(*records)
                                    if isinstance(ref, str) and ref.strip()))
    if status == 'PASS' and not source_refs:
        status = 'UNKNOWN'
        explanation = 'Source provenance is missing; the comparison cannot pass.'
    evidence = evidence or ('MISSING' if status == 'UNKNOWN' else 'CONFIRMED')
    return contracts.finding(rule, status, source_refs, observed, expected,
                             explanation,
                             'Review the sourced discrepancy; no payment is authorized.' if status == 'FAIL'
                             else 'Supply or repair the missing evidence before clearance.' if status == 'UNKNOWN'
                             else 'Retain the evidence; this result does not authorize payment.',
                             evidence=evidence,
                             severity='HIGH' if status == 'FAIL' else 'MEDIUM' if status == 'UNKNOWN' else 'INFO')


def unknown(rule, records, explanation):
    return emit(rule, 'UNKNOWN', records, None, RULES[rule]['description'], explanation)


def rows(batch, table, **keys):
    if not all(v is not None and str(v).strip() for v in keys.values()):
        return []
    return contracts.related(batch, table, **keys)


def invoice_lines(batch, invoice):
    if not present(invoice, 'invoice_id'):
        return []
    return rows(batch, 'invoice_lines', invoice_id=invoice['invoice_id'])


def intake(batch, invoice):
    findings = []
    identity = contracts.business_id(batch, invoice)
    identities = []
    for other in batch['tables']['invoices']:
        try:
            identities.append(contracts.business_id(batch, other))
        except ValueError:
            continue
    findings.append(emit('INTAKE.IDENTITY', 'FAIL' if identities.count(identity) > 1 else 'PASS',
                         [invoice], {'business_id': identity, 'batch_occurrences': identities.count(identity)},
                         'One stable business identity per batch',
                         'Repeated stable identity must be quarantined.' if identities.count(identity) > 1
                         else 'Stable identity is available and unique in this batch.'))
    missing = [k for k in ('vendor_id', 'invoice_number') if not present(invoice, k)]
    findings.append(emit('INTAKE.REQUIRED', 'FAIL' if missing else 'PASS', [invoice],
                         {'missing_fields': missing}, [], 'Required invoice header fields checked.'))
    amount = contracts.number(invoice.get('amount'))
    findings.append(emit('INTAKE.AMOUNT', 'FAIL' if amount is None else 'PASS', [invoice],
                         money(amount), 'Explicit finite amount', 'Finite Decimal-compatible amount checked.'))
    currency = invoice.get('currency')
    valid = isinstance(currency, str) and re.fullmatch(r'[A-Z]{3}', currency) is not None
    findings.append(emit('INTAKE.CURRENCY', 'PASS' if valid else 'FAIL', [invoice], currency,
                         'Explicit uppercase three-letter currency code',
                         'Currency syntax checked; no external currency registry is inferred.'))
    invoice_date = day(invoice.get('invoice_date'))
    findings.append(emit('INTAKE.DATE', 'PASS' if invoice_date else 'FAIL', [invoice],
                         invoice_date.isoformat() if invoice_date else None, 'Valid ISO invoice date',
                         'Explicit invoice date checked.'))
    return findings


def tolerance(batch, currency):
    policy = batch['policy']
    if batch['dataset_kind'] == 'SYNTHETIC_DEMO' and currency == 'MYR':
        allowance = contracts.number(policy.get('demo_myr_rounding_allowance'))
        if allowance == Decimal('0.02'):
            return allowance
    allowance = contracts.number(policy.get('production_price_tolerance'))
    if isinstance(policy.get('source_ref'), str) and policy['source_ref'].strip() and allowance is not None and allowance >= 0:
        return allowance
    return None


def fx_rate(batch, source_currency, target_currency, invoice_date):
    records = rows(batch, 'fx_rates', from_currency=source_currency, to_currency=target_currency)
    applicable = [r for r in records if day(r.get('rate_date')) == invoice_date]
    # Undated rows could be competing rates; do not silently select around them.
    if any(day(r.get('rate_date')) is None for r in records):
        return None
    record = contracts.unique(applicable)
    rate = contracts.number(record.get('rate')) if record else None
    return record if rate is not None and rate > 0 else None


def line_context(batch, invoice, line):
    fields = ('invoice_id', 'po_id', 'po_line_id', 'uom', 'currency')
    if not present(line, *fields) or not same(line['invoice_id'], invoice.get('invoice_id')):
        return None, 'Exact line identity, UOM or currency evidence is missing.'
    if not present(invoice, 'currency') or not same(line['currency'], invoice['currency']):
        return None, 'Invoice header and line currencies are missing or inconsistent.'
    quantity, price = contracts.number(line.get('quantity')), contracts.number(line.get('unit_price'))
    if quantity is None or quantity < 0 or price is None or price < 0:
        return None, 'Finite nonnegative line quantity and unit price are required.'
    po = contracts.unique(rows(batch, 'po_lines', po_id=line['po_id'], po_line_id=line['po_line_id']))
    if not po or not present(po, 'po_id', 'po_line_id', 'uom', 'currency'):
        return po, 'A unique, explicitly identified PO line with units and currency is required.'
    po_price = contracts.number(po.get('unit_price'))
    if po_price is None or po_price < 0:
        return po, 'Explicit finite nonnegative PO unit price is required.'
    if not same(line['uom'], po['uom']):
        return po, 'Line and PO UOM differ; no unit conversion evidence is available.'
    return po, None


def capacity(batch, key, cutoff, uom):
    """Return sourced net receipts and allocations; never synthesize a ledger."""
    policy = batch['policy']
    records = [policy]
    if not isinstance(policy.get('source_ref'), str) or not policy['source_ref'].strip() or policy.get('allocations_complete') is not True or policy.get('returns_complete') is not True:
        return None, None, records, 'Sourced allocations_complete=true and returns_complete=true are required.'
    if 'allocations' not in batch['tables'] or 'receipts' not in batch['tables']:
        return None, None, records, 'The complete allocation and receipt tables must be explicitly supplied.'
    for table in ('receipts', 'allocations'):
        ambiguous = [r for r in batch['tables'][table] if not present(r, 'po_id', 'po_line_id')]
        if ambiguous:
            return None, None, records + ambiguous, 'Receipt or allocation PO-line linkage is incomplete; the ledger cannot be treated as complete.'
    receipts = rows(batch, 'receipts', po_id=key[0], po_line_id=key[1])
    allocations = rows(batch, 'allocations', po_id=key[0], po_line_id=key[1])
    records += receipts + allocations
    if not receipts:
        return None, None, records, 'No receipt evidence links to this exact PO line.'
    total = Decimal(0)
    for receipt in receipts:
        receipt_date = day(receipt.get('receipt_date'))
        if receipt_date is None:
            return None, None, records, 'Receipt date evidence is missing or invalid.'
        if receipt_date > cutoff:
            continue
        quantity = contracts.number(receipt.get('quantity'))
        if quantity is None or quantity < 0 or not present(receipt, 'uom') or not same(receipt['uom'], uom):
            return None, None, records, 'Receipt quantity or comparable UOM evidence is missing.'
        movement = receipt.get('movement_type')
        if movement not in ('RECEIPT', 'RETURN'):
            return None, None, records, 'Receipt movement_type must explicitly be RECEIPT or RETURN.'
        total += quantity if movement == 'RECEIPT' else -quantity
    ledger = {}
    for allocation in allocations:
        allocation_date = day(allocation.get('allocation_date'))
        if allocation_date is None or not present(allocation, 'invoice_id'):
            return None, None, records, 'Allocation invoice identity or date evidence is missing.'
        if allocation_date > cutoff:
            continue
        quantity = contracts.number(allocation.get('quantity'))
        if quantity is None or quantity < 0 or ('uom' in allocation and not same(allocation['uom'], uom)):
            return None, None, records, 'Prior allocation quantity or supplied unit evidence is invalid.'
        allocation_id = str(allocation['invoice_id'])
        ledger[allocation_id] = ledger.get(allocation_id, Decimal(0)) + quantity
    return total, ledger, records, None


def batch_capacity(batch, invoice, key, own_lines, po):
    rule = 'MATCH.BATCH_CAPACITY'
    records = [invoice, *own_lines, po]
    ambiguous = [line for line in batch['tables'].get('invoice_lines', [])
                 if not present(line, 'invoice_id', 'po_id', 'po_line_id')]
    if ambiguous:
        return unknown(rule, records + ambiguous, 'Unlinked invoice lines could compete for capacity; complete exact identities are required.')
    candidates = rows(batch, 'invoice_lines', po_id=key[0], po_line_id=key[1])
    demand = {}
    for line in candidates:
        headers = rows(batch, 'invoices', invoice_id=line.get('invoice_id'))
        header = contracts.unique(headers)
        records += [line, *headers]
        if not header:
            return unknown(rule, records, 'Competing lines require unique invoice identities; orphan or duplicated identities are ambiguous.')
        linked_po, error = line_context(batch, header, line)
        invoice_date = day(header.get('invoice_date'))
        if error or not linked_po or invoice_date is None or not same(line.get('uom'), po.get('uom')):
            return unknown(rule, records, 'Competing invoice quantity, units, exact linkage or dates are incomplete.')
        iid = str(header['invoice_id'])
        quantity = contracts.number(line['quantity'])
        if iid not in demand:
            demand[iid] = [invoice_date, Decimal(0)]
        demand[iid][1] += quantity
    if len(demand) < 2:
        return emit(rule, 'NOT_APPLICABLE', records, {'competing_invoices': len(demand)},
                    'At least two invoices sharing a PO line', 'No competing invoice is linked in this supplied batch.')
    own_date = day(invoice.get('invoice_date'))
    if own_date is None:
        return unknown(rule, records, 'Invoice date is required for temporal capacity comparison.')
    observations = []
    for cutoff in sorted({d[0] for d in demand.values()}):
        total, ledger, evidence, error = capacity(batch, key, cutoff, po['uom'])
        records += evidence
        if error:
            return unknown(rule, records, error)
        due = {iid: quantity for iid, (when, quantity) in demand.items() if when <= cutoff}
        # Subtract the actual ledger once, then count only unallocated batch demand.
        pending = sum((max(Decimal(0), quantity - ledger.get(iid, Decimal(0)))
                       for iid, quantity in due.items()), Decimal(0))
        available = total - sum(ledger.values(), Decimal(0))
        observations.append({'as_of': cutoff.isoformat(), 'pending_quantity': money(pending),
                             'available_quantity': money(available)})
        if pending > available:
            return emit(rule, 'FAIL', records, {'po_id': key[0], 'po_line_id': key[1], 'capacity': observations},
                        'Dated pending batch quantity <= unallocated net receipts',
                        'Competing batch demand exceeds dated capacity: inferred review candidate, not an allocation or proven fraud.',
                        evidence='INFERRED_CANDIDATE')
    return emit(rule, 'PASS', records, {'po_id': key[0], 'po_line_id': key[1], 'capacity': observations},
                'Dated pending batch quantity <= unallocated net receipts',
                'Sourced dated capacity covers supplied batch demand; no allocations were created.')


def tax_check(batch, invoice, domain):
    rule = 'MATCH.TAX' if domain == 'matching' else 'ACCOUNTING.TAX'
    records = [invoice]
    invoice_date = day(invoice.get('invoice_date'))
    rate, tax, net = (contracts.number(invoice.get(k)) for k in ('tax_rate', 'tax_amount', 'net_amount'))
    if invoice_date is None or not present(invoice, 'tax_code', 'company_code', 'currency') or None in (rate, tax, net):
        return unknown(rule, records, 'Explicit tax code, company, currency, applicability date, tax_rate, tax_amount and net_amount are required.')
    rules = rows(batch, 'tax_rules', tax_code=invoice['tax_code'], company_code=invoice['company_code'], currency=invoice['currency'])
    records += rules
    if any(day(r.get('effective_from')) is None or day(r.get('effective_to')) is None for r in rules):
        return unknown(rule, records, 'Tax rule effective_from and effective_to are required; undated rules are ambiguous.')
    applicable = [r for r in rules if day(r['effective_from']) <= invoice_date <= day(r['effective_to'])]
    selected = contracts.unique(applicable)
    expected_rate = contracts.number(selected.get('tax_rate')) if selected else None
    if expected_rate is None or expected_rate < 0 or rate < 0:
        return unknown(rule, records, 'One applicable sourced tax rule with a nonnegative fractional tax_rate is required.')
    expected_tax = net * expected_rate
    ok = rate == expected_rate and tax == expected_tax
    return emit(rule, 'PASS' if ok else 'FAIL', records,
                {'tax_rate': money(rate), 'tax_amount': money(tax), 'net_amount': money(net)},
                {'tax_rate': money(expected_rate), 'tax_amount': money(expected_tax)},
                'Explicit dated tax rule and exact Decimal arithmetic compared; no jurisdiction or rounding was inferred.')


def matching(batch, invoice):
    findings = []
    lines = invoice_lines(batch, invoice)
    groups = {}
    if not lines:
        for rule in ('MATCH.LINE_LINK', 'MATCH.PRICE', 'MATCH.QUANTITY', 'MATCH.BATCH_CAPACITY', 'MATCH.FX'):
            findings.append(unknown(rule, [invoice], 'Exact sourced invoice line evidence is missing; header-only matching is not sufficient.'))
    for line in lines:
        po, error = line_context(batch, invoice, line)
        records = [invoice, line, po]
        findings.append(unknown('MATCH.LINE_LINK', records, error) if error else
                        emit('MATCH.LINE_LINK', 'PASS', records,
                             {'invoice_id': str(invoice['invoice_id']), 'po_id': line['po_id'], 'po_line_id': line['po_line_id']},
                             'Unique exact PO line with complete quantity, price, UOM and currency',
                             'Explicit invoice and PO line identifiers and comparable UOM are present.'))
        if error:
            findings += [unknown(rule, records, error) for rule in ('MATCH.PRICE', 'MATCH.FX')]
        else:
            converted_price = contracts.number(line['unit_price'])
            conversion_error = None
            if same(line['currency'], po['currency']):
                findings.append(emit('MATCH.FX', 'NOT_APPLICABLE', records,
                                     {'currency': line['currency']}, 'Same line and PO currencies',
                                     'No currency conversion is needed for this price comparison.'))
            else:
                invoice_date = day(invoice.get('invoice_date'))
                rate = fx_rate(batch, line['currency'], po['currency'], invoice_date) if invoice_date else None
                if not rate:
                    conversion_error = 'A unique positive sourced direct FX rate dated invoice_date is required.'
                    findings.append(unknown('MATCH.FX', records, conversion_error))
                else:
                    records.append(rate)
                    converted_price *= contracts.number(rate['rate'])
                    findings.append(emit('MATCH.FX', 'PASS', records,
                                         {'from_currency': line['currency'], 'to_currency': po['currency'], 'rate': rate['rate']},
                                         'Explicit direct rate on invoice_date',
                                         'Sourced FX evidence supplies the direct price conversion.'))
            allowance = tolerance(batch, po['currency'])
            if conversion_error or allowance is None:
                findings.append(unknown('MATCH.PRICE', records + [batch['policy']],
                                        conversion_error or 'Explicit sourced production price tolerance is missing; demo MYR 0.02 is not a production default.'))
            else:
                expected = contracts.number(po['unit_price'])
                delta = abs(converted_price - expected)
                findings.append(emit('MATCH.PRICE', 'PASS' if delta <= allowance else 'FAIL', records + [batch['policy']],
                                     {'unit_price_in_po_currency': money(converted_price), 'difference': money(delta)},
                                     {'unit_price': money(expected), 'currency': po['currency'], 'tolerance': money(allowance)},
                                     'Exact Decimal unit-price difference compared with explicit monetary tolerance.'))
        if present(line, 'po_id', 'po_line_id'):
            groups.setdefault((str(line['po_id']), str(line['po_line_id'])), []).append(line)
        else:
            findings += [unknown(rule, records, 'Exact PO and PO-line identifiers are required to aggregate quantities.')
                         for rule in ('MATCH.QUANTITY', 'MATCH.BATCH_CAPACITY')]
    for key, group in groups.items():
        contexts = [line_context(batch, invoice, line) for line in group]
        po = contexts[0][0]
        records = [invoice, *group, po]
        errors = [error for _, error in contexts if error]
        invoice_date = day(invoice.get('invoice_date'))
        if errors or invoice_date is None:
            explanation = errors[0] if errors else 'Invoice date is required to select receipts and prior allocations.'
            findings += [unknown(rule, records, explanation) for rule in ('MATCH.QUANTITY', 'MATCH.BATCH_CAPACITY')]
            continue
        total, ledger, evidence, error = capacity(batch, key, invoice_date, po['uom'])
        records += evidence
        if error:
            findings.append(unknown('MATCH.QUANTITY', records, error))
        else:
            quantity = sum((contracts.number(line['quantity']) for line in group), Decimal(0))
            prior = sum((value for iid, value in ledger.items() if not same(iid, invoice['invoice_id'])), Decimal(0))
            available = total - prior
            findings.append(emit('MATCH.QUANTITY', 'PASS' if quantity <= available else 'FAIL', records,
                                 {'po_id': key[0], 'po_line_id': key[1], 'billed_quantity': money(quantity)},
                                 {'net_receipts': money(total), 'prior_allocations': money(prior), 'available_quantity': money(available), 'quantity_tolerance': '0'},
                                 'Invoice lines aggregated per PO line against dated receipts less returns and other invoices\' prior allocations.'))
        findings.append(batch_capacity(batch, invoice, key, group, po))
    findings.append(tax_check(batch, invoice, 'matching'))
    return findings


def independent_verification(batch, invoice, vendor):
    verifications = rows(batch, 'bank_verifications', vendor_id=invoice.get('vendor_id'))
    verification = contracts.unique(verifications)
    valid = (verification is not None and verification.get('verified') is True
             and verification.get('independent') is True and verification.get('source_ref')
             and verification['source_ref'] not in contracts.refs(invoice, vendor))
    return verification if valid else None, verifications


def fraud(batch, invoice):
    findings = []
    others = batch['tables']['invoices']
    fields = ('vendor_id', 'invoice_number', 'currency', 'company_code', 'invoice_id')
    duplicates = [r for r in others if present(r, *fields) and present(invoice, *fields)
                  and not same(r['invoice_id'], invoice['invoice_id'])
                  and all(same(r[k], invoice[k]) for k in fields[:-1])]
    if duplicates:
        findings.append(emit('FRAUD.DUPLICATE', 'FAIL', [invoice, *duplicates],
                             {'other_invoice_ids': [str(r['invoice_id']) for r in duplicates]},
                             'No repeated vendor/invoice-number/currency/company key across different IDs',
                             'Exact duplicate invoice records found; this is not proven fraud.'))
    elif not present(invoice, *fields) or any(not present(r, *fields) for r in others):
        findings.append(unknown('FRAUD.DUPLICATE', [invoice], 'Complete exact duplicate keys and distinct invoice IDs are required throughout the comparison batch.'))
    else:
        findings.append(emit('FRAUD.DUPLICATE', 'PASS', others, {'duplicate_records': 0},
                             'No exact duplicate in the supplied batch', 'No exact duplicate found in supplied records; external records were not searched.'))
    amount, invoice_date = contracts.number(invoice.get('amount')), day(invoice.get('invoice_date'))
    similar = [r for r in others if present(r, 'invoice_id', 'vendor_id', 'currency')
               and present(invoice, 'invoice_id', 'vendor_id', 'currency') and amount is not None and invoice_date is not None
               and not same(r['invoice_id'], invoice['invoice_id']) and same(r['vendor_id'], invoice['vendor_id'])
               and same(r['currency'], invoice['currency']) and contracts.number(r.get('amount')) == amount
               and day(r.get('invoice_date')) == invoice_date]
    if similar:
        findings.append(emit('FRAUD.SIMILAR', 'FAIL', [invoice, *similar],
                             {'other_invoice_ids': [str(r['invoice_id']) for r in similar]},
                             'Review similar vendor/amount/currency/date records',
                             'Similar records are inferred candidates, not confirmed duplicates, PO links or proven fraud.',
                             evidence='INFERRED_CANDIDATE'))
    elif amount is None or invoice_date is None or not present(invoice, 'invoice_id', 'vendor_id', 'currency') or any(
            not present(r, 'invoice_id', 'vendor_id', 'currency') or contracts.number(r.get('amount')) is None or day(r.get('invoice_date')) is None for r in others):
        findings.append(unknown('FRAUD.SIMILAR', [invoice], 'Complete identities, vendor, currency, finite amounts and valid dates are required for batch similarity screening.'))
    else:
        findings.append(emit('FRAUD.SIMILAR', 'PASS', others, {'similar_candidates': 0},
                             'No similarity candidate in supplied records', 'No same-vendor/amount/currency/date candidate in the supplied batch.'))
    vendor = contracts.unique(rows(batch, 'vendors', vendor_id=invoice.get('vendor_id')))
    verification, verification_rows = independent_verification(batch, invoice, vendor)
    records = [invoice, vendor, *verification_rows]
    if not vendor or not present(invoice, 'bank_account') or not present(vendor, 'bank_account'):
        findings.append(unknown('FRAUD.BANK_MATCH', records, 'Unique vendor and explicit invoice/vendor bank fields are required; raw values are withheld.'))
    elif not same(invoice['bank_account'], vendor['bank_account']):
        findings.append(emit('FRAUD.BANK_MATCH', 'FAIL', records, {'bank_details_match': False},
                             'Invoice and independently verified vendor bank details agree; values withheld',
                             'Bank discrepancy is a risk signal, not proven fraud; raw values are withheld.'))
    elif not verification:
        findings.append(unknown('FRAUD.BANK_MATCH', records, 'Equal bank fields alone do not establish independent verification; raw values are withheld.'))
    else:
        findings.append(emit('FRAUD.BANK_MATCH', 'PASS', records, {'bank_details_match': True},
                             'Invoice and independently verified vendor bank details agree; values withheld',
                             'Present fields agree with the independently verified vendor record; raw values are withheld.'))
    if verification and vendor and present(vendor, 'bank_account'):
        findings.append(emit('FRAUD.BANK_VERIFICATION', 'PASS', records, {'verified': True, 'independent': True},
                             'Unique independently sourced vendor bank verification',
                             'Explicit independent verification evidence exists; bank values are withheld.'))
    else:
        findings.append(unknown('FRAUD.BANK_VERIFICATION', records,
                                'Require a unique vendor, vendor bank field and verification with verified=true, independent=true and a source_ref distinct from invoice and vendor records.'))
    return findings


def gl_check(batch, invoice):
    rule = 'ACCOUNTING.GL'
    records = [invoice]
    if not present(invoice, 'gl_account', 'company_code'):
        return unknown(rule, records, 'Explicit invoice gl_account and company_code are required.')
    masters = rows(batch, 'gl_accounts', gl_account=invoice['gl_account'], company_code=invoice['company_code'])
    records += masters
    master = contracts.unique(masters)
    if not master or not isinstance(master.get('active'), bool):
        return unknown(rule, records, 'A unique company-scoped GL master with an explicit boolean active flag is required.')
    return emit(rule, 'PASS' if master['active'] is True else 'FAIL', records,
                {'gl_account': invoice['gl_account'], 'company_code': invoice['company_code'], 'active': master['active']},
                {'active': True}, 'Unique company-scoped GL account active flag checked.')


def approval_check(batch, invoice):
    rule = 'ACCOUNTING.APPROVAL'
    decisions = rows(batch, 'approval_decisions', invoice_id=invoice.get('invoice_id'))
    records = [invoice, *decisions]
    decision = contracts.unique(decisions)
    if not decision or not present(decision, 'approver_id') or day(decision.get('decision_date')) is None or decision.get('decision') not in ('APPROVED', 'REJECTED'):
        return unknown(rule, records, 'A unique actual APPROVED/REJECTED decision with approver identity and decision_date is required; authority alone is not approval.')
    if decision['decision'] == 'REJECTED':
        return emit(rule, 'FAIL', records, {'decision': 'REJECTED', 'approver_id': decision['approver_id']},
                    'Actual authorized approval', 'The sourced invoice decision is explicitly REJECTED.')
    amount = contracts.number(invoice.get('amount'))
    if amount is None or amount < 0 or not present(invoice, 'currency', 'company_code'):
        return unknown(rule, records, 'Explicit nonnegative amount, company and currency are required for approval authority comparison.')
    authorities = rows(batch, 'approval_authority', approver_id=decision['approver_id'], currency=invoice['currency'], company_code=invoice['company_code'])
    records += authorities
    if any(day(r.get('effective_from')) is None or day(r.get('effective_to')) is None for r in authorities):
        return unknown(rule, records, 'Explicit effective dates are required on potentially applicable authority records.')
    decision_date = day(decision['decision_date'])
    applicable = [r for r in authorities if day(r['effective_from']) <= decision_date <= day(r['effective_to'])]
    authority = contracts.unique(applicable)
    limit = contracts.number(authority.get('max_amount')) if authority else None
    if limit is None or limit < 0:
        return unknown(rule, records, 'Unique effective approver/currency/company authority and finite nonnegative max_amount are required; no FX authority conversion is inferred.')
    return emit(rule, 'PASS' if amount <= limit else 'FAIL', records,
                {'decision': 'APPROVED', 'approver_id': decision['approver_id'], 'amount': money(amount)},
                {'max_amount': money(limit), 'currency': invoice['currency'], 'company_code': invoice['company_code'], 'limit_inclusive': True},
                'Actual approver identity and inclusive effective dates/amount limit checked in the exact company and currency.')


def accounting_fx(batch, invoice):
    rule = 'ACCOUNTING.FX'
    records = [invoice]
    if not present(invoice, 'currency', 'accounting_currency'):
        return unknown(rule, records, 'Explicit invoice currency and accounting_currency are required to establish conversion applicability.')
    if same(invoice['currency'], invoice['accounting_currency']):
        return emit(rule, 'NOT_APPLICABLE', records, {'currency': invoice['currency']},
                    'Invoice and accounting currencies match', 'No accounting currency conversion is required.')
    amount = contracts.number(invoice.get('amount'))
    accounting_amount = contracts.number(invoice.get('accounting_amount'))
    invoice_date = day(invoice.get('invoice_date'))
    rate = fx_rate(batch, invoice['currency'], invoice['accounting_currency'], invoice_date) if invoice_date else None
    if amount is None or accounting_amount is None or not rate:
        return unknown(rule, records, 'Explicit amount, accounting_amount and a unique sourced positive direct FX rate on invoice_date are required.')
    records.append(rate)
    expected = amount * contracts.number(rate['rate'])
    return emit(rule, 'PASS' if accounting_amount == expected else 'FAIL', records,
                {'accounting_amount': money(accounting_amount), 'currency': invoice['accounting_currency']},
                {'accounting_amount': money(expected), 'rate': rate['rate']},
                'Explicit accounting amount compared using sourced direct FX and exact Decimal arithmetic; no amount or rounding was invented.')


def accounting(batch, invoice):
    return [gl_check(batch, invoice), approval_check(batch, invoice),
            tax_check(batch, invoice, 'accounting'), accounting_fx(batch, invoice)]


def evaluate(batch, invoice, domain):
    """Validate a batch and return one contracts.envelope for the requested invoice."""
    if domain not in contracts.DOMAINS:
        raise ValueError('INVALID_DOMAIN')
    contracts.validate(batch, 'batch')
    if invoice not in batch['tables']['invoices']:
        raise ValueError('INVOICE_NOT_IN_BATCH')
    # A missing stable identity cannot fit the handoff contract: fail, never invent one.
    contracts.business_id(batch, invoice)
    # Exact finite decimal arithmetic, including long JSON decimal strings, without
    # global context mutations when the runner evaluates domains concurrently.
    values = []
    for table in batch['tables'].values():
        for record in table:
            values.extend(record.values())
    values.extend(batch['policy'].values())
    numbers = [n for n in (contracts.number(v) for v in values if isinstance(v, (str, int, float))) if n is not None]
    width = max((len(n.as_tuple().digits) + abs(n.as_tuple().exponent) for n in numbers), default=1)
    with localcontext() as context:
        context.prec = max(50, width * 3 + len(str(len(numbers) + 1)) + 10)
        findings = {'intake': intake, 'matching': matching, 'fraud': fraud, 'accounting': accounting}[domain](batch, invoice)
    for result in findings:
        if result['rule_id'] not in RULES or RULES[result['rule_id']]['domain'] != domain:
            raise ValueError('UNREGISTERED_OR_WRONG_DOMAIN_RULE')
    return contracts.envelope(batch, invoice, domain, findings, errors=list(batch['retrieval_errors']))


def evaluate_all(batch, domain):
    """Return one envelope per invoice in input order; never deduplicate records."""
    if domain not in contracts.DOMAINS:
        raise ValueError('INVALID_DOMAIN')
    contracts.validate(batch, 'batch')
    return [evaluate(batch, invoice, domain) for invoice in batch['tables']['invoices']]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--domain', required=True, choices=contracts.DOMAINS)
    parser.add_argument('--batch', required=True, help='Path to a normalized batch JSON file')
    parser.add_argument('--output', required=True, help='Path to a JSON list of handoff envelopes')
    args = parser.parse_args()
    try:
        source, output = Path(args.batch), Path(args.output)
        if source.resolve() == output.resolve():
            raise ValueError('OUTPUT_MUST_NOT_OVERWRITE_BATCH')
        batch = json.loads(source.read_text(encoding='utf-8-sig'))
        result = evaluate_all(batch, args.domain)
        output.write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')
        print(contracts.canonical({'status': 'EVALUATED', 'domain': args.domain, 'envelopes': len(result)}))
    except Exception as exc:
        # Diagnostics intentionally exclude exception messages and raw source data.
        print(contracts.canonical({'status': 'INPUT_OR_PROCESSING_FAILURE', 'error_type': type(exc).__name__}))
        raise SystemExit(2)


if __name__ == '__main__':
    main()
