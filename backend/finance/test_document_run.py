"""Manual integration check using generated synthetic documents, isolated from live sends."""
import json
from pathlib import Path
from service import Service


def main():
    root = Path(__file__).resolve().parent
    target = root / 'state/document-test'
    target.mkdir(parents=True, exist_ok=True)
    config = json.loads((root / 'config.json').read_text(encoding='utf-8'))
    config['workbook'] = str(root / config['workbook'])
    config['reference_documents'] = [str(root / p) for p in config['reference_documents']]
    config.update(invoice_input_dir=str(root / 'state/demo-invoices'), document_dataset_kind='TEST', include_test_cases=False, email_alert_on_success=False)
    config_path = target / 'config.json'
    config_path.write_text(json.dumps(config, indent=2), encoding='utf-8')
    service = Service(config_path, target / 'state')
    result = service.run()
    report = service.report(result['report_id'])
    assert len(report['cases']) == 3
    assert len(report['document_intake']) == 4
    assert report['document_intake'][0]['status'] == 'NON_INVOICE_STOPPED'
    assert all(case['dataset_kind'] == 'TEST' for case in report['cases'])
    assert all(case['unresolved'] for case in report['cases'])
    assert not report['approved_for_distribution']
    assert not report['deliveries']
    exported = json.loads((target / 'finance_export.json').read_text(encoding='utf-8'))
    assert exported['count'] == 0
    print(json.dumps({'result': result, 'invoice_candidates': len(report['cases']),
                     'non_invoice_stopped': 1, 'exported_invoices': exported['count'],
                     'live_notifications': 'NOT_SENT'}, indent=2))


if __name__ == '__main__':
    main()
