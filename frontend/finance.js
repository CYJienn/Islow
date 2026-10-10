const button = document.createElement('button');
button.type = 'button'; button.className = 'chip chip-mode'; button.textContent = 'Finance';
document.querySelector('.bar-end').prepend(button);
const dialog = document.createElement('dialog');
dialog.className = 'finance-panel';
dialog.innerHTML = `<header><h2>Invoice checks</h2><button type="button" data-close aria-label="Close invoice checks">Close</button></header>
<p>Compare OneDrive invoices with your finance Excel reference. Telegram receives results when you run analysis.</p>
<div class="finance-actions"><button type="button" data-run>Check invoices</button><button type="button" data-refresh>Refresh results</button></div>
<p data-status role="status"></p><div data-results></div>`;
document.body.append(dialog);
const status = dialog.querySelector('[data-status]');
const results = dialog.querySelector('[data-results]');
let token = '';
async function api(path, body) {
  const response = await fetch('/api/v1/finance/' + path, {method: body ? 'POST' : 'GET',
    headers: {'Content-Type': 'application/json', 'X-Local-Token': token}, body: body ? JSON.stringify(body) : undefined});
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || value.detail || 'Finance service unavailable');
  return value;
}
function paragraph(parent, text) { const p = document.createElement('p'); p.textContent = text; parent.append(p); }
function display(report) {
  results.replaceChildren();
  const locations = report.input_locations || {};
  paragraph(results, 'OneDrive account: ' + (locations.onedrive_account || 'Not configured'));
  paragraph(results, 'Invoices: ' + (locations.invoice_input_dir || 'Not configured'));
  paragraph(results, 'Reference: ' + (locations.workbook || 'Not configured'));
  for (const invoice of report.cases) {
    const card = document.createElement('section'); card.className = 'finance-invoice';
    const heading = document.createElement('h3'); heading.textContent = 'Invoice ' + (invoice.invoice_reference || invoice.invoice_id); card.append(heading);
    const check = invoice.findings.find(f => f.rule_id === 'FINANCE_EXPORT_COMPARISON');
    paragraph(card, 'Excel comparison: ' + (check?.status === 'PASS' ? 'Valid against reference' : check?.status === 'FAIL' ? 'Mismatch' : 'Needs review'));
    paragraph(card, 'Overall verification: ' + invoice.status.replaceAll('_', ' '));
    const details = document.createElement('details'); const label = document.createElement('summary'); label.textContent = 'View checks and missing evidence'; details.append(label);
    for (const finding of invoice.findings) paragraph(details, `${finding.rule_id}: ${finding.status} — ${finding.explanation}`);
    card.append(details); results.append(card);
  }
  for (const doc of report.document_intake || []) if (doc.status !== 'INVOICE_CANDIDATE') paragraph(results, `${doc.source_ref.split('::')[0]}: ${doc.status.replaceAll('_', ' ')}`);
  if (!report.cases.length) paragraph(results, 'No invoice candidates found.');
  if (report.batch_results) {
    const b = report.batch_results;
    paragraph(results, `Final result: ${b.valid_reference_matches} valid reference matches; ${b.invalid_reference_matches} mismatches; ${b.fully_verified} fully verified.`);
    for (const [label, totals] of [['Suspected exposure', b.supplied_suspected_exposure], ['Test suspected exposure', b.test_suspected_exposure]]) {
      const text = Object.entries(totals).map(([currency, amount]) => `${currency} ${amount}`).join('; ');
      if (text) paragraph(results, label + ': ' + text);
    }
    paragraph(results, 'Confirmed fraud is not established. Exposure is the full value of flagged business invoices, counted once each.');
  }
  paragraph(results, report.approved_for_distribution ? 'Report distribution approved.' : 'Review the results here, then use Approve report or Reject report in Telegram.');
  const download = document.createElement('a'); download.href = `/api/v1/finance/reports/${report.report_id}/files/report.xlsx`; download.textContent = 'Download Excel report'; results.append(download);
  const finalReport = document.createElement('a'); finalReport.href = `/api/v1/finance/reports/${report.report_id}/files/final-report.md`; finalReport.textContent = 'Download final report'; finalReport.style.marginLeft = '16px'; results.append(finalReport);
}
async function refresh() {
  token = (await api('session')).local_token;
  const history = await api('history');
  if (!history.reports.length) { status.textContent = 'Ready. Put invoices in your configured OneDrive folder and run a check.'; return; }
  const report = await api('reports/' + history.reports[0].id); display(report);
  status.textContent = report.snapshot_valid ? 'Latest invoice results' : 'Inputs changed. Run a new check.';
}
button.onclick = async () => { dialog.showModal(); try { await refresh(); } catch (e) { status.textContent = e.message; } };
dialog.querySelector('[data-close]').onclick = () => dialog.close();
dialog.querySelector('[data-refresh]').onclick = async () => { try { await refresh(); } catch (e) { status.textContent = e.message; } };
dialog.querySelector('[data-run]').onclick = async function () {
  this.disabled = true; status.textContent = 'Checking invoices…';
  try {
    token = (await api('session')).local_token;
    const run = await api('runs', {}); display(await api('reports/' + run.report_id));
    status.textContent = 'Check complete. Telegram notification: ' + (run.telegram_review || 'not configured').replaceAll('_', ' ');
  } catch (e) { status.textContent = e.message; } finally { this.disabled = false; }
};
