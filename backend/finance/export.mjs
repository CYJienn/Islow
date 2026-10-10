import fs from 'node:fs/promises';
import path from 'node:path';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: export.mjs report.json output.xlsx');
const report = JSON.parse(await fs.readFile(input, 'utf8'));
const supplied = report.cases.filter(c => c.dataset_kind === 'SUPPLIED');
const tests = report.cases.filter(c => c.dataset_kind === 'TEST');
const safe = v => typeof v === 'string' && /^[=+@-]/.test(v) ? "'" + v : v;
const col = n => { let s = ''; for (; n; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };

const invoiceRows = cases => cases.map(c => [c.invoice_id,c.invoice_reference,c.vendor_id,c.po_id,c.currency,c.amount === null ? null : Number(c.amount),c.status,c.flagged,c.unresolved,c.source_ref]);
const exceptions = [];
for(const c of supplied) for(const f of c.findings) if(f.status !== 'PASS' && f.status !== 'NOT_APPLICABLE') exceptions.push([c.invoice_id,c.vendor_id,f.rule_id,f.status,f.severity,typeof f.observed_value==='object'?JSON.stringify(f.observed_value):String(f.observed_value),String(f.expected_value),f.explanation,f.recommended_action]);
const evidence=[];
for(const c of supplied) for(const f of c.findings) evidence.push([c.invoice_id,f.rule_id,f.status,f.evidence_class,f.source_refs.join('\n')]);
const originRow=evidence.length+7;
const ordered = Workbook.create();
const sum = ordered.worksheets.add('Summary'); sum.showGridLines=false;
const summaryRows=[['Supplied records',report.summary.supplied_records],['Synthetic test records (separate)',report.summary.test_records],['Flagged supplied records',report.summary.flagged_records],['Supplied records with missing evidence',report.summary.unresolved_records],['Unquantified flagged records',report.summary.unquantified_flagged_records],['Processing seconds',report.processing_seconds]];
sum.getRange('A2').values=[['Invoice Assurance Report']];
sum.getRange('A2').format.font={name:'Arial',size:16,bold:true};
sum.getRange('A4:B4').values=[['Metric','Result']];
sum.getRange('A4:B4').format={fill:'#203A5C',font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},rowHeight:30};
sum.getRange('A5:B10').values=summaryRows;
sum.getRange('A12:C12').values=[['Currency','Flagged face-value exposure','Distinct flagged business invoices']];
sum.getRange('A12:C12').format={fill:'#203A5C',font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},wrapText:true,rowHeight:42};
const currencies=[...new Set(supplied.map(c=>c.currency))].sort();
if(currencies.length){
sum.getRange(`A13:C${12+currencies.length}`).values=currencies.map(currency=>[currency,Number(report.summary.flagged_exposure[currency]||0),new Set(supplied.filter(c=>c.currency===currency && c.flagged && c.amount!==null).map(c=>c.business_key)).size]);
sum.getRange(`B13:B${12+currencies.length}`).setNumberFormat('#,##0.00');
}
sum.getRange('A20').values=[['Important limitations']];sum.getRange('A20').format.font={bold:true};
sum.getRange(`A21:A${20+report.limitations.length}`).values=report.limitations.map(x=>[x]);
sum.getRange('A31:B34').values=[['Report ID',report.report_id],['Version',report.version],['Distribution','Draft — explicit human approval required'],['Exposure method',report.summary.exposure_method]];
sum.getRange('A4:C34').format.font={name:'Arial',size:10,color:'#172B4D'};
// Restore header contrast after applying the summary body font.
for (const range of ['A4:B4', 'A12:C12']) sum.getRange(range).format.font={name:'Arial',size:10,bold:true,color:'#FFFFFF'};
sum.getRange('A4:C34').format.verticalAlignment='center';
sum.getRange('A4:A34').format.columnWidth=78;sum.getRange('B4:B34').format.columnWidth=44;sum.getRange('C4:C34').format.columnWidth=33;
sum.getRange('A21:A27').format.wrapText=true;sum.getRange('A21:A27').format.rowHeight=38;
sum.getRange('A31:B34').format.wrapText=true;sum.getRange('A31:B34').format.rowHeight=42;
function detail(name,headers,rows,widths,numbers=[]) {
  const s=ordered.worksheets.add(name);s.showGridLines=false;const last=col(headers.length),end=Math.max(5,rows.length+4);
  s.getRange('A2').values=[[name]];s.getRange('A2').format.font={name:'Arial',size:14,bold:true};
  s.getRange(`A4:${last}4`).values=[headers];s.getRange(`A4:${last}4`).format={fill:'#203A5C',font:{name:'Arial',size:10,bold:true,color:'#FFFFFF'},rowHeight:32,wrapText:true};
  if(rows.length)s.getRange(`A5:${last}${end}`).values=rows.map(r=>r.map(v=>safe(v??null)));
  s.getRange(`A5:${last}${end}`).format={font:{name:'Arial',size:10,color:'#172B4D'},verticalAlignment:'center',wrapText:true,rowHeight:name==='Exception Details'?90:name==='Evidence References'?48:48};
  widths.forEach((w,i)=>s.getRange(`${col(i+1)}4:${col(i+1)}${end}`).format.columnWidth=w);
  numbers.forEach(n=>s.getRange(`${col(n)}5:${col(n)}${end}`).setNumberFormat('#,##0.00'));
  for(let i=0;i<rows.length;i++)if(i%2)s.getRange(`A${i+5}:${last}${i+5}`).format.fill='#F2F5F9';
  s.freezePanes.freezeRows(4);return s;
}
detail('Invoice Results',['Invoice ID','Vendor reference','Vendor','PO','Currency','Face amount','Assurance status','Risk flagged','Evidence missing','Source reference'],invoiceRows(supplied),[17,21,14,15,11,18,25,14,18,64],[6]);
detail('Exception Details',['Invoice','Vendor','Rule','Status','Severity','Observed','Expected','Explanation','Recommended action'],exceptions,[17,14,30,15,13,35,39,66,56]);
const evid=detail('Evidence References',['Invoice','Rule','Status','Evidence class','Source references'],evidence,[17,32,15,24,100]);
evid.getRange(`A${originRow}:B${originRow+report.source_manifest.length-1}`).values=report.source_manifest.map(s=>[s.role,s.path]);
detail('Demo Cases',['Test invoice','Vendor reference','Vendor','PO','Currency','Face amount','Assurance status','Risk flagged','Evidence missing','Source reference'],invoiceRows(tests),[32,32,19,17,11,18,25,14,18,70],[6]);
if(report.document_intake?.length) detail('Document Intake',['Source','Intake result','Extraction method','Error type'],report.document_intake.map(d=>[d.source_ref,d.status,d.method||'',d.error_type||'']),[85,40,25,35]);
if(report.batch_results){
  const b=report.batch_results;
  detail('Final Results',['Invoice','Source','Reference verdict','Verification','Currency','Amount','Risk flagged','Dataset','Failed rules'],b.invoices.map(r=>[r.invoice,r.source,r.reference_verdict,r.verification,r.currency,Number(r.amount||0),r.flagged,r.dataset_kind,r.failed_rules.join(', ')]),[22,30,36,28,12,20,16,16,52],[6]);
  const totals=[];
  for(const [label, amounts] of [['Supplied suspected exposure',b.supplied_suspected_exposure],['Test suspected exposure',b.test_suspected_exposure]]) for(const [currency,value] of Object.entries(amounts)) totals.push([label,currency+' '+value]);
  detail('Batch Summary',['Metric','Result'],[['Valid reference matches',b.valid_reference_matches],['Invalid reference matches',b.invalid_reference_matches],['Fully verified invoices',b.fully_verified],...totals,['Confirmed fraud','Not established'],['Exposure basis',b.exposure_method]],[38,100]);
}
ordered.recalculate();
const errors=await ordered.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!',options:{useRegex:true,maxResults:20},maxChars:1000});
console.log(errors.ndjson);
const xlsx=await SpreadsheetFile.exportXlsx(ordered);await xlsx.save(output);
if(process.env.ASSURANCE_RENDER==='1'){
  for(const name of ['Summary','Invoice Results','Exception Details','Evidence References','Demo Cases']){
    const preview=await ordered.render({sheetName:name,range:name==='Summary'?'A1:C34':name==='Evidence References'?'A1:E8':name==='Exception Details'?'A1:I8':'A1:J8',scale:1,format:'png'});
    await fs.writeFile(path.join(path.dirname(output),`preview-${name.replaceAll(' ','-')}.png`),new Uint8Array(await preview.arrayBuffer()));
  }
}
console.log(JSON.stringify({output,supplied:supplied.length,tests:tests.length}));
