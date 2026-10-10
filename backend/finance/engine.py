"""Deterministic invoice assurance. Sources are data, never executable instructions."""
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
import hashlib
import json
import re
import zipfile
import xml.etree.ElementTree as ET

VERSION = "1.0.0"
STATUSES = {"PASS", "FAIL", "UNKNOWN", "NOT_APPLICABLE"}
SHEETS = {"invoices": "RBKP_Invoice", "vendors": "LFA1_Vendor_Master",
          "po_headers": "EKKO_PO_Header", "po_lines": "EKPO_PO_Item",
          "receipts": "MSEG_Goods_Receipt", "gl": "SKA1_GL_Master", "doa": "DOA_Matrix"}


def now():
    return datetime.now(timezone.utc).isoformat()


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def digest(value):
    return hashlib.sha256(canonical(value).encode("utf-8")).hexdigest()


def file_hash(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def number(value):
    """Accept numeric cells and explicit two-decimal locale text; reject ambiguous text."""
    if value is None or isinstance(value, bool):
        raise ValueError("Missing or boolean amount")
    s = str(value).strip()
    if not s:
        raise ValueError("Missing amount")
    if isinstance(value, str):
        if "," in s and "." in s:
            if re.fullmatch(r"[+-]?\d{1,3}(,\d{3})+\.\d+", s):
                s = s.replace(",", "")
            elif re.fullmatch(r"[+-]?\d{1,3}(\.\d{3})+,\d{2}", s):
                s = s.replace(".", "").replace(",", ".")
            else:
                raise ValueError("Ambiguous monetary separators")
        elif "," in s:
            if not re.fullmatch(r"[+-]?\d+,\d{2}", s):
                raise ValueError("Ambiguous comma amount")
            s = s.replace(",", ".")
    try:
        result = Decimal(s)
    except InvalidOperation as e:
        raise ValueError("Invalid numeric value") from e
    if not result.is_finite():
        raise ValueError("Non-finite numeric value")
    return result


def money(value):
    return str(number(value).quantize(Decimal("0.01")))


def text(value):
    return "" if value is None else str(value).strip()


def date(value):
    return datetime.fromisoformat(text(value).replace("Z", "+00:00")).date()


def business_key(invoice):
    # Different channels/document IDs for the same vendor reference are one business invoice.
    ref = text(invoice.get("XBLNR")).upper()
    if not ref or not text(invoice.get("LIFNR")) or not text(invoice.get("WAERS")):
        return "record:" + text(invoice.get("BELNR")) + ":" + invoice["source_ref"]
    return canonical([text(invoice.get("MANDT")), text(invoice.get("LIFNR")), ref,
                      text(invoice.get("WAERS")), text(invoice.get("GJAHR"))])


def finding(domain, rule, status, records, observed, expected, explanation, action,
            severity="INFO", evidence="CONFIRMED"):
    refs = list(dict.fromkeys(r["source_ref"] for r in records if r and r.get("source_ref")))
    if status not in STATUSES or (status == "PASS" and (not refs or evidence != "CONFIRMED")):
        raise ValueError("Invalid finding or evidence-free PASS")
    if status == "UNKNOWN":
        evidence = "MISSING" if evidence == "CONFIRMED" else evidence
    return {"domain": domain, "rule_id": rule, "status": status, "severity": severity,
            "evidence_class": evidence, "source_refs": refs, "observed_value": observed,
            "expected_value": expected, "explanation": explanation, "recommended_action": action}


def related(dataset, table, **keys):
    return [r for r in dataset[table] if all(text(r.get(k)) == text(v) for k, v in keys.items())]


def unique(rows):
    return rows[0] if len(rows) == 1 else None


def load_workbook(path):
    from openpyxl import load_workbook as read_xlsx
    path = Path(path).resolve()
    wb = read_xlsx(path, read_only=True, data_only=False)
    dataset = {"kind": "SUPPLIED", "label": "Supplied synthetic enterprise export"}
    try:
        for name, sheet_name in SHEETS.items():
            if sheet_name not in wb.sheetnames:
                raise ValueError(f"Missing required sheet: {sheet_name}")
            ws = wb[sheet_name]
            iterator = ws.iter_rows()
            headers = [text(c.value) for c in next(iterator)]
            if len(set(headers)) != len(headers) or not all(headers):
                raise ValueError(f"Missing/duplicate headers in {sheet_name}")
            rows = []
            for row_number, row in enumerate(iterator, 2):
                if all(c.value is None for c in row):
                    continue
                record = {}
                for key, cell in zip(headers, row):
                    if cell.data_type == "f":
                        raise ValueError(f"Formula not accepted as source evidence: {sheet_name}!{cell.coordinate}")
                    value = cell.value
                    if isinstance(value, datetime):
                        value = value.isoformat()
                    record[key] = value
                record["source_ref"] = f"{path.name}::{sheet_name}!row{row_number}"
                rows.append(record)
            dataset[name] = rows
    finally:
        wb.close()
    if not dataset["invoices"]:
        raise ValueError("No invoice records in source workbook")
    return dataset


def inspect_reference(path):
    """Read metadata/content summary only. Never execute or import a workflow export."""
    p = Path(path).resolve()
    if p.suffix.lower() == ".json":
        data = json.loads(p.read_text(encoding="utf-8-sig"))
        return {"path": str(p), "role": "UNTRUSTED_MIGRATION_REFERENCE", "sha256": file_hash(p),
                "workflow_count": len(data.get("workflows", [])),
                "declared_services": data.get("integrationsManifest", {}).get("services", [])}
    if p.suffix.lower() == ".docx":
        with zipfile.ZipFile(p) as z:
            xml = ET.fromstring(z.read("word/document.xml"))
        ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
        paragraphs = ["".join(n.itertext()) for n in xml.findall(".//w:t", ns)]
        return {"path": str(p), "role": "UNVERIFIED_SUPPORTING_ANALYSIS", "sha256": file_hash(p),
                "text_fragment_count": len(paragraphs), "used_as_policy": False}
    raise ValueError("Unsupported reference format")


def intake(invoice, dataset):
    out = []
    for field in ("BELNR", "LIFNR", "XBLNR", "WAERS"):
        valid = bool(text(invoice.get(field)))
        out.append(finding("intake", "REQUIRED_" + field, "PASS" if valid else "FAIL", [invoice],
                           "Present" if valid else "Missing", "Required identifier",
                           f"Required {field} is {'present' if valid else 'missing'}.",
                           "Continue checks" if valid else "Correct source data", "HIGH" if not valid else "INFO"))
    try:
        amount = number(invoice.get("WRBTR"))
        out.append(finding("intake", "INVOICE_AMOUNT", "PASS", [invoice], str(amount), "Finite decimal amount",
                           "Invoice amount parsed without substituting a zero.", "Continue checks"))
    except ValueError as e:
        out.append(finding("intake", "INVOICE_AMOUNT", "FAIL", [invoice], "Invalid or missing", "Finite decimal amount",
                           str(e), "Correct monetary value", "HIGH"))
    for field in ("BLDAT", "BUDAT"):
        try:
            parsed = date(invoice.get(field))
            out.append(finding("intake", "DATE_" + field, "PASS", [invoice], parsed.isoformat(), "Valid date",
                               "Date is parseable.", "Continue checks"))
        except ValueError:
            out.append(finding("intake", "DATE_" + field, "UNKNOWN", [invoice], "Missing or invalid", "Valid date",
                               "Date evidence is incomplete.", "Verify source date"))
    return out


def matching(invoice, dataset, policy):
    out = []
    po_id = text(invoice.get("EBELN"))
    if not po_id:
        return [finding("matching", "PO_REFERENCE", "NOT_APPLICABLE", [invoice], "Non-PO invoice", "Alternative approval evidence",
                        "No PO reference is supplied; three-way matching is not applicable.", "Obtain non-PO supporting documents")]
    po = unique(related(dataset, "po_headers", EBELN=po_id))
    if not po:
        return [finding("matching", "PO_REFERENCE", "FAIL", [invoice], po_id, "One existing PO",
                        "The reference has no unique PO header.", "Verify the PO reference", "HIGH"),
                finding("matching", "THREE_WAY_EVIDENCE", "UNKNOWN", [invoice], "Unavailable PO", "PO, invoice and receipt lines",
                        "Line matching cannot proceed without an unambiguous PO.", "Obtain missing evidence")]
    out.append(finding("matching", "PO_REFERENCE", "PASS", [invoice, po], po_id, "One existing PO",
                       "The invoice references an existing PO.", "Continue line checks"))
    for field, rule in (("LIFNR", "PO_VENDOR"), ("WAERS", "PO_CURRENCY")):
        present = bool(text(invoice.get(field)) and text(po.get(field)))
        same = present and text(invoice[field]) == text(po[field])
        out.append(finding("matching", rule, "PASS" if same else "FAIL" if present else "UNKNOWN", [invoice, po],
                           text(invoice.get(field)), text(po.get(field)),
                           f"Invoice {field} compared with referenced PO.", "Continue" if same else "Verify supplier/currency before proceeding",
                           "HIGH" if present and not same else "INFO"))
    lines = invoice.get("LINES")
    if not isinstance(lines, list) or not lines:
        out.append(finding("matching", "THREE_WAY_EVIDENCE", "UNKNOWN", [invoice, po], "Invoice header only",
                           "Invoice lines with quantities, units and prices",
                           "The supplied invoice has no line-level evidence; a complete three-way match is not established.",
                           "Obtain invoice-line documents"))
        return out
    if dataset["kind"] != "TEST" or text(invoice.get("WAERS")) != policy["currency"]:
        out.append(finding("matching", "MATCH_POLICY", "UNKNOWN", [invoice], "No authoritative monetary policy",
                           "Applicable currency and tolerance policy", "The configured tolerance applies only to labelled test cases.",
                           "Supply authoritative matching policy"))
        return out
    tolerance = number(policy["money_tolerance"])
    qty_tolerance = number(policy["quantity_tolerance"])
    if tolerance < 0 or qty_tolerance < 0:
        raise ValueError("Tolerances cannot be negative")
    for line in lines:
        item = unique(related(dataset, "po_lines", EBELN=po_id, EBELP=line.get("EBELP")))
        if not item:
            out.append(finding("matching", "PO_LINE", "FAIL", [invoice, line], text(line.get("EBELP")), "Unique PO line",
                               "No unique matching PO line exists.", "Verify line reference", "HIGH"))
            continue
        records = [invoice, line, item]
        if not text(line.get("MEINS")) or text(line.get("MEINS")) != text(item.get("MEINS")):
            out.append(finding("matching", "LINE_UNITS", "UNKNOWN", records, text(line.get("MEINS")), text(item.get("MEINS")),
                               "Units differ or are missing; no conversion is assumed.", "Supply unit conversion evidence"))
            continue
        try:
            qty, price, po_price = number(line.get("MENGE")), number(line.get("NETPR")), number(item.get("NETPR"))
            price_unit = number(item.get("PEINH", "1"))
            if qty < 0 or price < 0 or price_unit <= 0:
                raise ValueError("Credit/negative lines require a separate verified policy")
            expected = qty * po_price / price_unit
            variance = qty * price - expected
            out.append(finding("matching", "LINE_PRICE", "PASS" if abs(variance) <= tolerance else "FAIL", records,
                               money(qty * price), money(expected),
                               f"Comparable net line value variance is {money(variance)} {policy['currency']}.",
                               "Continue" if abs(variance) <= tolerance else "Investigate price variance", "HIGH" if abs(variance) > tolerance else "INFO"))
            out.append(finding("matching", "ORDER_QUANTITY", "PASS" if qty <= number(item.get("MENGE")) else "FAIL", records,
                               str(qty), str(number(item.get("MENGE"))), "Billed quantity compared with ordered quantity.",
                               "Continue" if qty <= number(item.get("MENGE")) else "Investigate excess quantity", "HIGH" if qty > number(item.get("MENGE")) else "INFO"))
            receipts = related(dataset, "receipts", EBELN=po_id, EBELP=line.get("EBELP"))
            if not receipts or invoice.get("PRIOR_ALLOCATIONS") is None:
                out.append(finding("matching", "RECEIPT_QUANTITY", "UNKNOWN", records + receipts, "Incomplete receipt/allocation evidence",
                                   "Received quantity and verified prior allocations", "Available receipt capacity cannot be established.", "Obtain allocation/receipt evidence"))
                continue
            received = Decimal("0")
            for receipt in receipts:
                if text(receipt.get("MEINS")) != text(line.get("MEINS")) or text(receipt.get("BWART")) not in ("101", "102"):
                    raise ValueError("Unsupported receipt units or movement type")
                sign = Decimal("1") if text(receipt["BWART"]) == "101" else Decimal("-1")
                expected_direction = "S" if sign == 1 else "H"
                if text(receipt.get("SHKZG")) and text(receipt.get("SHKZG")) != expected_direction:
                    raise ValueError("Receipt direction conflicts with movement type")
                received += sign * abs(number(receipt["MENGE"]))
            allocated = number(invoice["PRIOR_ALLOCATIONS"].get(text(line["EBELP"])))
            if allocated < 0:
                raise ValueError("Prior allocated quantity cannot be negative")
            # All current invoices sharing a PO line consume the same capacity, not one capacity each.
            current = sum((number(l["MENGE"]) for other in dataset["invoices"]
                           if text(other.get("EBELN")) == po_id
                           for l in other.get("LINES", []) if text(l.get("EBELP")) == text(line["EBELP"])), Decimal("0"))
            available = received - allocated
            ok = current <= available + qty_tolerance
            out.append(finding("matching", "RECEIPT_QUANTITY", "PASS" if ok else "FAIL", records + receipts,
                               str(current), str(available),
                               f"Current batch bills {current} units against {available} available received units.",
                               "Continue" if ok else "Verify goods receipt and current invoice allocations", "HIGH" if not ok else "INFO"))
        except (ValueError, KeyError, TypeError) as e:
            out.append(finding("matching", "LINE_CALCULATION", "UNKNOWN", records, "Incomplete or invalid inputs", "Valid comparable evidence",
                               str(e), "Correct inputs and rerun"))
    if invoice.get("TAX_VERIFIED") is not True:
        out.append(finding("matching", "INVOICE_TOTAL", "UNKNOWN", [invoice], "Tax/net basis not verified", "Comparable invoice total",
                           "No tax assumptions are introduced.", "Supply tax basis evidence"))
    else:
        try:
            expected = sum((number(l["MENGE"]) * number(l["NETPR"]) for l in lines), Decimal("0")) + number(invoice.get("TAX_AMOUNT"))
            variance = number(invoice.get("WRBTR")) - expected
            ok = abs(variance) <= tolerance
            out.append(finding("matching", "INVOICE_TOTAL", "PASS" if ok else "FAIL", [invoice] + lines,
                               money(invoice["WRBTR"]), money(expected), "Header amount compared with evidenced lines and stated verified test tax.",
                               "Continue" if ok else "Reconcile invoice total", "HIGH" if not ok else "INFO"))
        except (ValueError, KeyError) as e:
            out.append(finding("matching", "INVOICE_TOTAL", "UNKNOWN", [invoice], "Invalid total inputs", "Comparable total", str(e), "Correct inputs"))
    return out


def fraud(invoice, dataset):
    out = []
    ref_complete = all(text(invoice.get(k)) for k in ("LIFNR", "XBLNR", "WAERS", "GJAHR"))
    peers = [r for r in dataset["invoices"] if business_key(r) == business_key(invoice)] if ref_complete else []
    out.append(finding("fraud", "DUPLICATE_REFERENCE", "FAIL" if len(peers) > 1 else "PASS" if ref_complete else "UNKNOWN",
                       peers or [invoice], len(peers) if ref_complete else "Incomplete identifiers", "One record per vendor/reference/currency/year",
                       "Repeated vendor invoice references are duplicate candidates, not confirmed fraud." if len(peers) > 1 else
                       "Checked supplied batch only; historical records outside the batch were not available.",
                       "Review duplicates before proceeding" if len(peers) > 1 else "Retain batch evidence", "HIGH" if len(peers) > 1 else "INFO"))
    vendor = unique(related(dataset, "vendors", LIFNR=invoice.get("LIFNR")))
    if not vendor:
        out.append(finding("fraud", "VENDOR_MASTER", "UNKNOWN", [invoice], "Missing/ambiguous vendor", "Unique vendor master",
                           "Vendor checks cannot be established.", "Verify vendor master"))
        return out
    blocked = text(vendor.get("SPERR")).upper() == "X" or text(vendor.get("LOEVM")).upper() == "X"
    out.append(finding("fraud", "VENDOR_BLOCK", "FAIL" if blocked else "PASS", [invoice, vendor],
                       "Blocked/deleted" if blocked else "No block flag", "Active unblocked vendor",
                       "Posting/deletion flags checked against supplied vendor master.", "Escalate blocked vendor" if blocked else "Continue", "HIGH" if blocked else "INFO"))
    bank = text(invoice.get("BANK_ON_INV"))
    master = text(vendor.get("BANKN"))
    if not bank or not master:
        out.append(finding("fraud", "BANK_COMPARISON", "UNKNOWN", [invoice, vendor], "Missing invoice/master bank evidence",
                           "Both bank records", "No bank match is claimed when invoice bank evidence is absent.", "Obtain independent bank evidence"))
    else:
        normalize = lambda s: re.sub(r"[\s-]", "", s).upper()
        same = normalize(bank) == normalize(master)
        out.append(finding("fraud", "BANK_COMPARISON", "PASS" if same else "FAIL", [invoice, vendor],
                           "Matches master" if same else "Differs from master", "Consistent bank evidence",
                           "Account comparison performed; account values are redacted.", "Continue verification" if same else "Verify change through established contact channel", "HIGH" if not same else "INFO"))
    verified = invoice.get("BANK_VERIFIED") is True and dataset["kind"] == "TEST"
    out.append(finding("fraud", "INDEPENDENT_BANK_VERIFICATION", "PASS" if verified else "UNKNOWN", [invoice, vendor],
                       "Explicit synthetic verification" if verified else "No independent verification record",
                       "Independent bank verification", "Matching a master account does not establish independent verification.",
                       "Retain verification" if verified else "Obtain verification evidence"))
    return out


def choose_approver(amount, cost_centre, currency, rows):
    candidates = []
    for r in rows:
        if text(r.get("KOSTL")) != cost_centre or text(r.get("CURRENCY")) != currency:
            continue
        try:
            lower, upper = number(r.get("MIN_AMT")), number(r.get("MAX_AMT"))
        except ValueError:
            raise ValueError("Invalid approval range configuration")
        if lower > upper:
            raise ValueError("Inverted approval range configuration")
        if lower <= amount <= upper:
            candidates.append(r)
    if len(candidates) != 1:
        raise ValueError("Missing or overlapping approval authority; both bounds must match")
    return candidates[0]


def accounting(invoice, dataset):
    out = []
    gl_code, cc = text(invoice.get("GL_CODE")), text(invoice.get("KOSTL"))
    gl = unique(related(dataset, "gl", SAKNR=gl_code)) if gl_code else None
    if not gl or not cc:
        out.append(finding("accounting", "GL_COST_CENTRE", "UNKNOWN", [invoice], "Missing or unverified coding", "Valid GL and permitted cost centre",
                           "No coding or cost centre is invented.", "Obtain coding evidence"))
    else:
        allowed = cc in [s.strip() for s in text(gl.get("KOSTL_ALLOWED")).split(",")]
        out.append(finding("accounting", "GL_COST_CENTRE", "PASS" if allowed else "FAIL", [invoice, gl], cc, text(gl.get("KOSTL_ALLOWED")),
                           "Cost centre checked against GL permissions.", "Continue" if allowed else "Correct coding", "MEDIUM" if not allowed else "INFO"))
    try:
        if not cc:
            raise ValueError("Invoice cost centre is missing")
        authority = choose_approver(number(invoice.get("WRBTR")), cc, text(invoice.get("WAERS")), dataset["doa"])
        out.append(finding("accounting", "APPROVER_AUTHORITY", "PASS", [invoice, authority], text(authority.get("ROLE")),
                           "One authorized amount range", "Both amount bounds and currency were checked. Authority is not an approval decision.",
                           "Route any required invoice approval to " + text(authority.get("APPROVER"))))
    except ValueError as e:
        out.append(finding("accounting", "APPROVER_AUTHORITY", "UNKNOWN", [invoice], "No confirmed authority", "Cost centre, currency and applicable range",
                           str(e), "Resolve approval configuration"))
    return out


def evaluate(invoice, dataset, policy):
    # The three independent specialist domains run concurrently after intake.
    findings = intake(invoice, dataset)
    if 'reference_invoices' in dataset:
        candidates = [r for r in dataset['reference_invoices'] if text(r.get('XBLNR')) == text(invoice.get('XBLNR'))
                      and text(r.get('LIFNR')) == text(invoice.get('LIFNR'))]
        status, explanation = 'UNKNOWN', 'No unique vendor/invoice reference in the finance export.'
        if len(candidates) == 1:
            ref = candidates[0]
            try:
                complete = all(text(invoice.get(k)) and text(ref.get(k)) for k in ('WAERS', 'EBELN', 'WRBTR'))
                if complete:
                    same = (text(invoice['WAERS']) == text(ref['WAERS']) and text(invoice['EBELN']) == text(ref['EBELN'])
                            and number(invoice['WRBTR']) == number(ref['WRBTR']))
                    status = 'PASS' if same else 'FAIL'
                    explanation = 'Currency, purchase order and total compared against the finance export. A mismatch is an exception, not proof of fraud.'
            except ValueError:
                pass
        findings.append(finding('matching', 'FINANCE_EXPORT_COMPARISON', status, [invoice] + candidates,
                                'Finance export comparison ' + status, 'Unique reference with consistent currency, PO and total',
                                explanation, 'Review the invoice against the finance export', 'HIGH' if status == 'FAIL' else 'INFO'))
    if invoice.get('DOCUMENT_EXTRACTION_METHOD'):
        findings.append(finding('intake', 'DOCUMENT_EXTRACTION_REVIEW', 'UNKNOWN', [invoice],
                                invoice['DOCUMENT_EXTRACTION_METHOD'], 'Human-verified extracted fields',
                                'Extracted document fields have not been independently reviewed.',
                                'Review extracted identities, amounts and line fields before treating them as verified'))
    with ThreadPoolExecutor(max_workers=3) as pool:
        jobs = [pool.submit(matching, invoice, dataset, policy), pool.submit(fraud, invoice, dataset),
                pool.submit(accounting, invoice, dataset)]
        for job in jobs:
            findings.extend(job.result())
    try:
        from .ai_risk import review
    except ImportError:
        from ai_risk import review
    ai = review(invoice, findings, dataset['kind']) if policy.get('ai_risk_enabled', True) else None
    if ai:
        status = 'FAIL' if ai['risk'] == 'SUSPECTED_RISK' else 'UNKNOWN' if ai['risk'] == 'INSUFFICIENT_EVIDENCE' else 'NOT_APPLICABLE'
        findings.append(finding('fraud', 'GPT_RISK_REVIEW', status, [invoice], ai['risk'],
                                'Supplementary evidence-based risk review', ai['reason'],
                                'Review suspected risks and missing evidence',
                                'HIGH' if status == 'FAIL' else 'INFO', 'INFERRED'))
    for f in findings:
        if f["status"] not in STATUSES or not f["source_refs"]:
            raise ValueError("Assurance rejected malformed finding")
    flagged = any(f["status"] == "FAIL" and f["severity"] in ("HIGH", "MEDIUM") for f in findings)
    unknown = any(f["status"] == "UNKNOWN" for f in findings)
    try:
        amount = money(invoice.get("WRBTR"))
    except ValueError:
        amount = None
    return {"case_id": digest([dataset["kind"], invoice.get("MANDT"), invoice.get("GJAHR"), invoice.get("BELNR"), invoice["source_ref"]])[:20],
            "dataset_kind": dataset["kind"], "invoice_id": text(invoice.get("BELNR")), "invoice_reference": text(invoice.get("XBLNR")),
            "vendor_id": text(invoice.get("LIFNR")), "po_id": text(invoice.get("EBELN")), "currency": text(invoice.get("WAERS")),
            "amount": amount, "business_key": business_key(invoice), "source_ref": invoice["source_ref"],
            "status": "RISK_FLAGGED" if flagged else "EVIDENCE_REQUIRED" if unknown else "CHECKS_COMPLETE",
            "flagged": flagged, "unresolved": unknown, "findings": findings}


def summarize(cases):
    supplied = [c for c in cases if c["dataset_kind"] == "SUPPLIED"]
    grouped = defaultdict(list)
    for c in supplied:
        if c["flagged"] and c["amount"] is not None:
            grouped[(c["currency"], c["business_key"])].append(abs(number(c["amount"])))
    totals = defaultdict(lambda: Decimal("0"))
    for (currency, _), amounts in grouped.items():
        totals[currency] += max(amounts)
    return {"supplied_records": len(supplied), "test_records": len(cases) - len(supplied),
            "flagged_records": sum(c["flagged"] for c in supplied),
            "unresolved_records": sum(c["unresolved"] for c in supplied),
            "flagged_business_invoices": len(grouped),
            "flagged_exposure": {k: money(v) for k, v in sorted(totals.items())},
            "unquantified_flagged_records": sum(c["flagged"] and c["amount"] is None for c in supplied),
            "check_status_counts": dict(Counter(f["status"] for c in supplied for f in c["findings"])),
            "failed_rules": dict(Counter(f["rule_id"] for c in supplied for f in c["findings"] if f["status"] == "FAIL")),
            "exposure_method": "Maximum absolute face value per flagged vendor/reference/currency/year group; not confirmed loss."}


def run_analysis(config):
    dataset = load_workbook(config["workbook"])
    document_results = []
    document_manifest = []
    if config.get('invoice_input_dir'):
        try:
            from .document_intake import read_documents
        except ImportError:
            from document_intake import read_documents
        invoices, document_results, document_manifest = read_documents(config['invoice_input_dir'])
        dataset['reference_invoices'] = dataset['invoices']
        dataset['invoices'] = invoices
        kind = config.get('document_dataset_kind', 'SUPPLIED')
        if kind not in ('SUPPLIED', 'TEST'):
            raise ValueError('Invalid document dataset kind')
        dataset['kind'] = kind
    refs = [inspect_reference(p) for p in config.get("reference_documents", [])]
    manifest = [{"path": str(Path(config["workbook"]).resolve()), "sha256": file_hash(config["workbook"]), "role": "TEMPORARY_BATCH_SOURCE"}] + refs + document_manifest
    policy = config["test_policy"]
    supplied = [evaluate(inv, dataset, policy) for inv in dataset["invoices"]]
    if len({c["case_id"] for c in supplied}) != len(supplied):
        raise ValueError("Duplicate stable case IDs")
    tests = []
    if config.get("include_test_cases"):
        try:
            from .fixtures import test_datasets
        except ImportError:
            from fixtures import test_datasets
        for test in test_datasets():
            tests.extend(evaluate(i, test, policy) for i in test["invoices"])
    cases = supplied + tests
    try:
        from .final_report import batch_results
    except ImportError:
        from final_report import batch_results
    return {"engine_version": VERSION, "created_at": now(), "source_manifest": manifest,
            "batch_results": batch_results(cases),
            "document_intake": document_results,
            "source_counts": {k: len(dataset[k]) for k in SHEETS}, "summary": summarize(cases), "cases": cases,
            "policy": {"test_only": policy, "production_policy": "Not supplied"},
            "limitations": ["All supplied data is labelled synthetic by its workbook index.",
                            "Invoice headers alone do not establish full three-way matching.",
                            "Historical duplicate, prior receipt allocation, tax and FX evidence were not supplied.",
                            "Source approval matrix lacks currency and invoices lack cost centre; no payment readiness is asserted.",
                            "Supporting DOCX and workflow JSON are reference material, not policy or executable code.",
                            "Flagged exposure is suspected risk, not confirmed fraud or prevented loss.",
                            "Test cases are isolated from supplied exposure totals; no savings baseline was supplied."]}
