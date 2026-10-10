"""Synthetic test evidence. Never used as corroboration for supplied invoices."""
from copy import deepcopy


def base(name):
    ref = lambda kind: "SYNTHETIC_TEST::" + name + "::" + kind
    inv = {"MANDT": "TEST", "BELNR": name, "GJAHR": "2026", "XBLNR": name, "LIFNR": "TEST-VENDOR",
           "EBELN": "TEST-PO", "BLDAT": "2026-10-01", "BUDAT": "2026-10-02", "WAERS": "MYR", "WRBTR": "1000.00",
           "BANK_ON_INV": "TEST-ACCOUNT", "BANK_VERIFIED": True, "GL_CODE": "TEST-GL", "KOSTL": "TEST-CC",
           "TAX_VERIFIED": True, "TAX_AMOUNT": "0", "PRIOR_ALLOCATIONS": {"10": "0"}, "source_ref": ref("invoice"),
           "LINES": [{"EBELP": "10", "MENGE": "100", "MEINS": "EA", "NETPR": "10", "source_ref": ref("invoice-line")} ]}
    return {"kind": "TEST", "label": name, "invoices": [inv],
            "vendors": [{"LIFNR": "TEST-VENDOR", "BANKN": "TEST-ACCOUNT", "SPERR": None, "LOEVM": None, "source_ref": ref("vendor")}],
            "po_headers": [{"EBELN": "TEST-PO", "LIFNR": "TEST-VENDOR", "WAERS": "MYR", "source_ref": ref("po-header")}],
            "po_lines": [{"EBELN": "TEST-PO", "EBELP": "10", "MENGE": "100", "MEINS": "EA", "NETPR": "10", "PEINH": "1", "source_ref": ref("po-line")}],
            "receipts": [{"EBELN": "TEST-PO", "EBELP": "10", "MENGE": "100", "MEINS": "EA", "BWART": "101", "SHKZG": "S", "source_ref": ref("receipt")}],
            "gl": [{"SAKNR": "TEST-GL", "KOSTL_ALLOWED": "TEST-CC", "source_ref": ref("gl")}],
            "doa": [{"KOSTL": "TEST-CC", "CURRENCY": "MYR", "MIN_AMT": "0", "MAX_AMT": "5000", "ROLE": "Test manager", "APPROVER": "Synthetic reviewer", "source_ref": ref("authority")}]}


def test_datasets():
    result = [base("TEST-CLEAN")]
    d = base("TEST-DUPLICATE")
    other = deepcopy(d["invoices"][0]); other["BELNR"] += "-COPY"; other["source_ref"] += "-copy"
    d["invoices"].append(other); result.append(d)
    d = base("TEST-BANK-MISMATCH"); d["invoices"][0]["BANK_ON_INV"] = "TEST-OTHER-ACCOUNT"; result.append(d)
    d = base("TEST-PRICE-VARIANCE"); d["invoices"][0]["LINES"][0]["NETPR"] = "11"; d["invoices"][0]["WRBTR"] = "1100"; result.append(d)
    d = base("TEST-PARTIAL-RECEIPT"); d["receipts"][0]["MENGE"] = "60"; result.append(d)
    d = base("TEST-MISSING-LINES"); d["invoices"][0].pop("LINES"); result.append(d)
    d = base("TEST-MALFORMED-AMOUNT"); d["invoices"][0]["WRBTR"] = "not-an-amount"; result.append(d)
    return result
