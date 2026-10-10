"""Overwrite the latest checked-invoice export without admitting incomplete evidence."""
import json
import os
from pathlib import Path
import tempfile


def write_checked_invoices(report, target):
    if any(entry.get('status') in ('EXTRACTION_FAILED_STOPPED', 'DOCUMENT_REVIEW_REQUIRED_STOPPED')
           for entry in report.get('document_intake', [])):
        return None  # Partial/failed intake must not erase the last successful export.
    accepted = []
    for case in report['cases']:
        findings = case.get('findings', [])
        if (case.get('dataset_kind') == 'SUPPLIED' and case.get('status') == 'CHECKS_COMPLETE'
                and not case.get('flagged') and not case.get('unresolved') and findings
                and all(f.get('status') in ('PASS', 'NOT_APPLICABLE') for f in findings)):
            accepted.append(case)
    payload = {'schema_version': '1.0', 'report_id': report['report_id'], 'version': report['version'],
               'scope': 'CHECKS_COMPLETE_NOT_PAYMENT_AUTHORIZATION', 'count': len(accepted),
               'invoices': accepted}
    target = Path(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=target.name + '.', suffix='.tmp', dir=target.parent)
    try:
        with os.fdopen(descriptor, 'w', encoding='utf-8') as stream:
            json.dump(payload, stream, indent=2, ensure_ascii=False, allow_nan=False)
        os.replace(temporary, target)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    return str(target)
