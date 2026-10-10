"""Run imported deterministic expert checks; no LLM team registration or external sends."""
import argparse
import json
from pathlib import Path
import sys
from environment import load_environment

ROOT = Path(__file__).resolve().parent


def main():
    load_environment()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mode', choices=('dashboard', 'team'), default='dashboard')
    parser.add_argument('--input', type=Path, help='Validated canonical batch JSON for team mode')
    args = parser.parse_args()
    if args.mode == 'dashboard':
        from service import Service
        result = Service().run()
    else:
        if not args.input:
            parser.error('--input is required for team mode; normalize with workbuddy/scripts/intake.py')
        sys.path.insert(0, str(ROOT / 'workbuddy'))
        sys.path.insert(0, str(ROOT / 'workbuddy/scripts'))
        from runner import run
        result = run(str(args.input.resolve()), str(ROOT / 'state/team'), str(ROOT / 'state/team/reports'))
        if result.get('report'):
            report = result['report']
            outbox = ROOT / 'state/orchestrator-outbox'
            outbox.mkdir(parents=True, exist_ok=True)
            notice = {'event': 'REPORT_GENERATED', 'recipient': 'orchestrator', **report,
                      'delivery_status': 'PENDING_WORKBUDDY_DISPATCH'}
            target = outbox / (report['report_id'] + '-v' + str(report['version']) + '.json')
            target.write_text(json.dumps(notice, indent=2), encoding='utf-8')
            result['orchestrator_handoff'] = str(target)
    print(json.dumps(result, indent=2))
    if result.get('errors') or result.get('status') in ('PROCESSING_FAILURE', 'RETRIEVAL_OR_PROCESSING_FAILURE'):
        raise SystemExit(2)


if __name__ == '__main__':
    main()
