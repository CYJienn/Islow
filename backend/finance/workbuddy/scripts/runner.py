"""Manual-first persistent runner; never schedules, pays, or auto-approves."""
import argparse
import concurrent.futures
import json
import sqlite3
import sys
import time
import uuid
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from shared.contracts import now, digest, canonical, file_hash, business_id, validate, DOMAINS
from intake import check_batch

SCHEMA = '''
CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY,start TEXT,end TEXT,status TEXT,processed INTEGER,unresolved INTEGER,errors TEXT);
CREATE TABLE IF NOT EXISTS cases(id TEXT PRIMARY KEY,input_hash TEXT,status TEXT,result TEXT,attempts INTEGER,updated TEXT);
CREATE TABLE IF NOT EXISTS history(id INTEGER PRIMARY KEY,run_id TEXT,case_id TEXT,status TEXT,at TEXT,details TEXT);
CREATE TABLE IF NOT EXISTS reports(id TEXT,version INTEGER,manifest TEXT,content TEXT,created TEXT,PRIMARY KEY(id,version));
CREATE TABLE IF NOT EXISTS approvals(id INTEGER PRIMARY KEY,report_id TEXT,version INTEGER,digest TEXT,reviewer TEXT,decision TEXT,at TEXT,review_seconds REAL);
CREATE TABLE IF NOT EXISTS reviews(report_id TEXT,version INTEGER,start TEXT,start_epoch REAL,PRIMARY KEY(report_id,version));
CREATE TABLE IF NOT EXISTS notifications(report_id TEXT,version INTEGER,channel TEXT,status TEXT,outcome TEXT,attempts INTEGER,updated TEXT,PRIMARY KEY(report_id,version,channel));
'''

def connect(state):
    path = Path(state)
    path.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path / 'assurance.sqlite3', timeout=30)
    db.row_factory = sqlite3.Row
    db.executescript(SCHEMA)
    return db


def event(db, run_id, case_id, status, details):
    db.execute('INSERT INTO history(run_id,case_id,status,at,details) VALUES(?,?,?,?,?)', (run_id,case_id,status,now(),canonical(details)))


def case_hash(batch, invoice):
    # Include all reference evidence and policy, not volatile retrieval time/filename.
    stable = {'dataset_id':batch['dataset_id'], 'dataset_kind':batch['dataset_kind'], 'tables':batch['tables'], 'policy':batch['policy'], 'retrieval_errors':batch['retrieval_errors']}
    return digest([business_id(batch,invoice),stable])


def assurance(batch, invoice, handoffs):
    from checks import RULES
    expected_id = business_id(batch,invoice)
    if set(handoffs) != set(DOMAINS):
        raise ValueError('INCOMPLETE_DOMAIN_COVERAGE')
    for domain, handoff in handoffs.items():
        validate(handoff,'handoff')
        if handoff['domain'] != domain or handoff['business_id'] != expected_id or handoff['input_hash'] != digest(batch) or handoff['batch_id'] != batch['batch_id']:
            raise ValueError('HANDOFF_ID_OR_HASH_MISMATCH')
        if handoff['errors']:
            raise ValueError('HANDOFF_PROCESSING_FAILURE:' + domain)
        for f in handoff['findings']:
            if f['rule_id'] not in RULES:
                raise ValueError('UNREGISTERED_RULE:' + f['rule_id'])
    findings = [f for h in handoffs.values() for f in h['findings']]
    flagged = any(f['status'] == 'FAIL' for f in findings)
    unresolved = any(f['status'] == 'UNKNOWN' for f in findings)
    return {'business_id':expected_id,'invoice':invoice,'domains':handoffs,'status':'FAIL' if flagged else 'UNKNOWN' if unresolved else 'PASS','flagged':flagged,'unresolved':unresolved}


def create_report(db,batch,results,errors,seconds,output,report_id=None,review_seconds=None):
    from reporting import generate, summarize
    from notifications import destination_manifest
    rid = report_id or 'IA-' + uuid.uuid4().hex[:12].upper()
    row = db.execute('SELECT MAX(version) AS v FROM reports WHERE id=?',(rid,)).fetchone()
    version = (row['v'] or 0)+1
    content = {'report_id':rid,'version':version,'created_at':now(),'dataset_kind':batch['dataset_kind'],'dataset_id':batch['dataset_id'],'batch_id':batch['batch_id'],'metrics':summarize(results,batch['dataset_kind']),'results':results,'processing_errors':errors,'source_manifest':batch['source_manifest'],'processing_seconds':seconds,'review_seconds':review_seconds,'destinations':destination_manifest(),'policy':batch['policy'],'demo_expected':batch['policy'].get('demo_expected',{})}
    folder = Path(output) / (rid + '-v' + str(version))
    paths = generate(content,folder)
    manifest = {'paths':paths,'file_hashes':{k:file_hash(v) for k,v in paths.items()},'content_hash':digest(content),'destination_hash':digest(content['destinations'])}
    manifest['digest'] = digest(manifest)
    db.execute('INSERT INTO reports VALUES(?,?,?,?,?)',(rid,version,canonical(manifest),canonical(content),now()))
    # Prior approvals become invalid by latest-version checks, retained as immutable history.
    db.commit()
    return {'report_id':rid,'version':version,'digest':manifest['digest'],'paths':paths,'status':'DRAFT_REQUIRES_EXPLICIT_APPROVAL','errors':errors}


def run(input_path,state,output,handoff_paths=None,retry_failed=False):
    db=connect(state)
    run_id=uuid.uuid4().hex
    started=time.perf_counter()
    db.execute('INSERT INTO runs VALUES(?,?,NULL,?,0,0,?)',(run_id,now(),'RUNNING','[]'))
    db.commit()
    results=[]; errors=[]; processed=0
    try:
        batch=check_batch(json.loads(Path(input_path).read_text(encoding='utf-8')))
        # Preserve raw normalized data separately from reports; access-control required.
        raw_dir=Path(state)/'raw'; raw_dir.mkdir(exist_ok=True)
        (raw_dir/(digest(batch)+'.json')).write_text(canonical(batch),encoding='utf-8')
        supplied_handoffs=[]
        if handoff_paths:
            for path in handoff_paths:
                supplied_handoffs.extend(json.loads(Path(path).read_text(encoding='utf-8')))
            expected={(business_id(batch,i),d) for i in batch['tables']['invoices'] for d in DOMAINS}
            got=[(h['business_id'],h['domain']) for h in supplied_handoffs]
            if len(got)!=len(set(got)) or set(got)!=expected:
                raise ValueError('ASSEMBLY_COVERAGE_DUPLICATE_OR_MISSING')
        ids=[business_id(batch,i) for i in batch['tables']['invoices']]
        if len(ids)!=len(set(ids)):
            raise ValueError('DUPLICATE_STABLE_ID_QUARANTINE: preserve records and fix identity before processing')
        if batch['retrieval_errors']:
            errors.extend(batch['retrieval_errors'])
        for invoice in batch['tables']['invoices']:
            cid=business_id(batch,invoice); ih=case_hash(batch,invoice)
            old=db.execute('SELECT * FROM cases WHERE id=?',(cid,)).fetchone()
            if old and old['input_hash']==ih and old['status']=='COMPLETE':
                results.append(json.loads(old['result'])); continue
            if old and old['status']=='FAILED' and old['input_hash']==ih and not retry_failed:
                errors.append({'business_id':cid,'error':'FAILED_CASE_REQUIRES_CONTROLLED_RETRY'}); continue
            attempts=(old['attempts'] if old else 0)+1
            db.execute('INSERT OR REPLACE INTO cases VALUES(?,?,?,?,?,?)',(cid,ih,'PROCESSING',None,attempts,now()))
            event(db,run_id,cid,'PROCESSING',{'attempt':attempts}); db.commit()
            try:
                if handoff_paths:
                    handoffs={h['domain']:h for h in supplied_handoffs if h['business_id']==cid}
                else:
                    from checks import evaluate
                    intake=evaluate(batch,invoice,'intake')
                    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
                        futures={d:pool.submit(evaluate,batch,invoice,d) for d in ('matching','fraud','accounting')}
                        handoffs={'intake':intake,**{d:f.result() for d,f in futures.items()}}
                result=assurance(batch,invoice,handoffs)
                if batch['retrieval_errors']:
                    raise ValueError('SOURCE_PROCESSING_ERRORS_REQUIRE_REPAIR')
                db.execute('UPDATE cases SET status=?,result=?,updated=? WHERE id=?',('COMPLETE',canonical(result),now(),cid))
                event(db,run_id,cid,'COMPLETE',{'assurance':'SUCCEEDED'}); results.append(result); processed+=1
            except Exception as exc:
                error={'business_id':cid,'error':str(exc)[:350],'error_type':type(exc).__name__}
                errors.append(error)
                db.execute('UPDATE cases SET status=?,result=?,updated=? WHERE id=?',('FAILED',canonical(error),now(),cid))
                event(db,run_id,cid,'FAILED',error)
            db.commit()
        status='PROCESSING_FAILURE' if errors else 'NO_NEW_RECORDS' if processed==0 else 'COMPLETED_DRAFT'
        report=create_report(db,batch,results,errors,time.perf_counter()-started,output) if processed or errors else None
        db.execute('UPDATE runs SET end=?,status=?,processed=?,unresolved=?,errors=? WHERE id=?',(now(),status,processed,sum(r['unresolved'] for r in results),canonical(errors),run_id)); db.commit()
        return {'run_id':run_id,'status':status,'records_processed':processed,'unresolved_cases':sum(r['unresolved'] for r in results),'errors':errors,'report':report}
    except Exception as exc:
        error={'error_type':type(exc).__name__,'error':str(exc)[:350]}
        db.execute('UPDATE runs SET end=?,status=?,errors=? WHERE id=?',(now(),'RETRIEVAL_OR_PROCESSING_FAILURE',canonical([error]),run_id)); db.commit()
        return {'run_id':run_id,'status':'RETRIEVAL_OR_PROCESSING_FAILURE','records_processed':processed,'errors':[error]}
    finally:
        db.close()


def get_report(db,rid,version):
    row=db.execute('SELECT * FROM reports WHERE id=? AND version=?',(rid,version)).fetchone()
    if not row: raise ValueError('REPORT_NOT_FOUND')
    return json.loads(row['manifest']),json.loads(row['content'])


def unchanged(db,rid,version,manifest,content):
    latest=db.execute('SELECT MAX(version) v FROM reports WHERE id=?',(rid,)).fetchone()['v']
    if latest!=version: raise ValueError('APPROVAL_INVALIDATED_NEW_VERSION')
    if digest(content)!=manifest['content_hash']: raise ValueError('REPORT_CONTENT_CHANGED')
    for key,path in manifest['paths'].items():
        if file_hash(path)!=manifest['file_hashes'][key]: raise ValueError('APPROVAL_INVALIDATED_ARTIFACT_CHANGED')
    from notifications import destination_manifest
    if digest(destination_manifest())!=manifest['destination_hash']: raise ValueError('APPROVAL_INVALIDATED_DESTINATIONS_CHANGED')


def decision(state,rid,version,reviewer,choice,expected_digest):
    db=connect(state)
    try:
        manifest,content=get_report(db,rid,version)
        unchanged(db,rid,version,manifest,content)
        if not reviewer.strip() or expected_digest!=manifest['digest']: raise ValueError('REVIEWER_OR_EXACT_DIGEST_REQUIRED')
        review=db.execute('SELECT * FROM reviews WHERE report_id=? AND version=?',(rid,version)).fetchone()
        seconds=max(0,time.time()-review['start_epoch']) if review else None
        db.execute('INSERT INTO approvals(report_id,version,digest,reviewer,decision,at,review_seconds) VALUES(?,?,?,?,?,?,?)',(rid,version,expected_digest,reviewer,choice,now(),seconds)); db.commit()
        return {'report_id':rid,'version':version,'reviewer':reviewer,'decision':choice,'timestamp':now(),'measured_review_seconds':seconds,'scope':'DISTRIBUTION_ONLY_NOT_PAYMENT_OR_EXCEPTION_CLEARANCE'}
    finally: db.close()


def distribute(state,rid,version):
    from notifications import deliver
    db=connect(state)
    try:
        manifest,content=get_report(db,rid,version)
        unchanged(db,rid,version,manifest,content)
        approval=db.execute('SELECT * FROM approvals WHERE report_id=? AND version=? ORDER BY id DESC LIMIT 1',(rid,version)).fetchone()
        if not approval or approval['decision']!='APPROVE' or approval['digest']!=manifest['digest']: raise ValueError('EXPLICIT_EXACT_VERSION_APPROVAL_REQUIRED')
        outcomes={}
        review=approval['review_seconds']
        summary='Invoice assurance '+rid+' v'+str(version)+'. '+canonical(content['metrics'])+'. Flagged exposure is suspected risk, not confirmed fraud or prevented loss. Human review seconds: '+str(review if review is not None else 'NOT_MEASURED')+'. Distribution approval does not authorize payment.'
        for channel in ('outlook','telegram'):
            db.execute('BEGIN IMMEDIATE')
            old=db.execute('SELECT * FROM notifications WHERE report_id=? AND version=? AND channel=?',(rid,version,channel)).fetchone()
            if old and old['status'] in ('ACCEPTED','CONFIRMED','UNCERTAIN','SENDING'):
                db.commit(); outcomes[channel]={'status':old['status'],'action':'NO_DUPLICATE_OR_UNCERTAIN_RETRY'}; continue
            attempts=(old['attempts'] if old else 0)+1
            db.execute('INSERT OR REPLACE INTO notifications VALUES(?,?,?,?,?,?,?)',(rid,version,channel,'SENDING','{}',attempts,now())); db.commit()
            try:
                outcome=deliver(channel,rid,version,summary,manifest['paths']['workbook'],approved=True)
            except Exception as exc:
                outcome={'status':'UNCERTAIN','error_type':type(exc).__name__,'action':'MANUAL_RECONCILIATION_REQUIRED'}
            db.execute('UPDATE notifications SET status=?,outcome=?,updated=? WHERE report_id=? AND version=? AND channel=?',(outcome['status'],canonical(outcome),now(),rid,version,channel)); db.commit()
            outcomes[channel]=outcome
        return outcomes
    finally: db.close()


def main():
    p=argparse.ArgumentParser(description=__doc__); sub=p.add_subparsers(dest='command',required=True)
    for cmd in ('run','assemble'):
        q=sub.add_parser(cmd); q.add_argument('--input',required=True); q.add_argument('--state',required=True); q.add_argument('--output',required=True); q.add_argument('--retry-failed',action='store_true')
        if cmd=='assemble': q.add_argument('--handoffs',nargs=4,required=True)
    q=sub.add_parser('demo'); q.add_argument('--output',required=True)
    q=sub.add_parser('validate-connections')
    q=sub.add_parser('status'); q.add_argument('--state',required=True)
    for cmd in ('review-start','approve','reject','revise','distribute','reconcile-delivery'):
        q=sub.add_parser(cmd); q.add_argument('--state',required=True); q.add_argument('--report-id',required=True); q.add_argument('--version',type=int,required=True)
        if cmd in ('approve','reject'): q.add_argument('--reviewer',required=True); q.add_argument('--digest',required=True)
        if cmd=='revise': q.add_argument('--output',required=True)
        if cmd=='reconcile-delivery':
            q.add_argument('--channel',choices=['outlook','telegram'],required=True); q.add_argument('--status',choices=['CONFIRMED','FAILED','UNCERTAIN'],required=True); q.add_argument('--evidence',required=True); q.add_argument('--reviewer',required=True)
    a=p.parse_args()
    try:
        if a.command in ('run','assemble'): result=run(a.input,a.state,a.output,getattr(a,'handoffs',None),a.retry_failed)
        elif a.command=='demo':
            from demo import build_demo
            batch=build_demo(); Path(a.output).write_text(json.dumps(batch,indent=2),encoding='utf-8'); result={'status':'SYNTHETIC_DEMO_CREATED','path':a.output}
        elif a.command=='validate-connections':
            from notifications import validate_connections
            result=validate_connections()
        elif a.command in ('approve','reject'): result=decision(a.state,a.report_id,a.version,a.reviewer,'APPROVE' if a.command=='approve' else 'REJECT',a.digest)
        elif a.command=='distribute': result=distribute(a.state,a.report_id,a.version)
        else:
            db=connect(a.state)
            if a.command=='status': result={t:[dict(r) for r in db.execute('SELECT * FROM '+t)] for t in ('runs','cases','approvals','notifications')}; result['cases']=[{k:v for k,v in r.items() if k!='result'} for r in result['cases']]
            elif a.command=='review-start':
                get_report(db,a.report_id,a.version); db.execute('INSERT OR REPLACE INTO reviews VALUES(?,?,?,?)',(a.report_id,a.version,now(),time.time())); db.commit(); result={'status':'REVIEW_TIMER_STARTED'}
            elif a.command=='revise':
                manifest,c=get_report(db,a.report_id,a.version)
                batch={'dataset_kind':c['dataset_kind'],'dataset_id':c['dataset_id'],'batch_id':c['batch_id'],'source_manifest':c['source_manifest'],'policy':c['policy']}
                approval=db.execute('SELECT review_seconds FROM approvals WHERE report_id=? AND version=? ORDER BY id DESC LIMIT 1',(a.report_id,a.version)).fetchone()
                result=create_report(db,batch,c['results'],c['processing_errors'],c['processing_seconds'],a.output,a.report_id,approval['review_seconds'] if approval else None)
            else:
                old=db.execute('SELECT * FROM notifications WHERE report_id=? AND version=? AND channel=?',(a.report_id,a.version,a.channel)).fetchone()
                if not old: raise ValueError('NO_NOTIFICATION_ATTEMPT_TO_RECONCILE')
                evidence={'evidence':a.evidence,'reviewer':a.reviewer,'at':now(),'previous_outcome':json.loads(old['outcome'])}
                db.execute('UPDATE notifications SET status=?,outcome=?,updated=? WHERE report_id=? AND version=? AND channel=?',(a.status,canonical(evidence),now(),a.report_id,a.version,a.channel)); event(db,'MANUAL_RECONCILIATION',a.report_id,a.status,evidence); db.commit(); result={'status':a.status,'channel':a.channel}
            db.close()
        print(canonical(result))
    except Exception as exc:
        print(canonical({'status':'FAILED','error':str(exc)[:350],'error_type':type(exc).__name__})); raise SystemExit(2)

if __name__=='__main__': main()
