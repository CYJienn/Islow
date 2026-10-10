const form = document.querySelector('#marketingForm');
const results = document.querySelector('#results');
const requestMessage = document.querySelector('#requestMessage');
const runButton = document.querySelector('#runButton');
const reportState = document.querySelector('#reportState');
const reviewCount = document.querySelector('#reviewCount');
const connection = document.querySelector('#connection');
// Local Vite and plain static servers run on a different port from FastAPI.
const apiBase = window.location.port === '5173'
  ? `${window.location.protocol}//${window.location.hostname}:8000`
  : '';

function element(tag, className = '', text = '') {
  const item = document.createElement(tag);
  if (className) item.className = className;
  item.textContent = text;
  return item;
}

function field(name) {
  return form.elements.namedItem(name);
}

function list(value) {
  return value.split(',').map((part) => part.trim()).filter(Boolean);
}

function reviewLines() {
  return field('reviews').value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function updateReviewCount() {
  const count = reviewLines().length;
  reviewCount.textContent = `${count} ${count === 1 ? 'review' : 'reviews'}`;
}

function setMessage(message, isError = false) {
  requestMessage.textContent = message;
  requestMessage.classList.toggle('is-error', isError);
}

function setReportState(message, style = '') {
  reportState.textContent = message;
  reportState.className = `report-state ${style}`.trim();
}

function loadSample() {
  const values = {
    name: 'Sample Corner Cafe',
    industry: 'cafe',
    location: 'Subang Jaya, Malaysia',
    products: 'coffee, pastries',
    target_customers: 'university students and nearby office workers',
    marketing_budget_rm: '500',
    channels: 'Instagram, TikTok',
    objective: 'increase local awareness and weekday visits',
    competitor_names: '',
    reviews: [
      'The coffee tastes great and the staff are friendly.',
      'I liked the pastries, but the queue at lunch was too long.',
      'A convenient place to study, though seating fills up quickly.',
      'Good value for a quick morning coffee.',
    ].join('\n'),
  };
  for (const [name, value] of Object.entries(values)) field(name).value = value;
  form.querySelector('input[name="research_mode"][value="demo"]').checked = true;
  updateReviewCount();
  setMessage('Sample loaded. Run demo, or select live to use Tavily and OpenAI.');
}

function clearForm() {
  form.reset();
  for (const input of form.querySelectorAll('input:not([type="radio"]), textarea')) input.value = '';
  form.querySelector('input[name="research_mode"][value="demo"]').checked = true;
  results.replaceChildren();
  const empty = element('div', 'empty-state');
  empty.append(element('span', 'empty-icon', '✦'), element('h3', '', 'Your campaign plan will appear here.'),
    element('p', '', 'Enter your business details and reviews, then run an analysis.'));
  results.append(empty);
  setReportState('Awaiting request');
  setMessage('');
  updateReviewCount();
}

async function checkHealth() {
  connection.className = 'connection';
  connection.lastChild.textContent = ' Checking backend';
  try {
    const response = await fetch(`${apiBase}/health`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Backend did not respond');
    const health = await response.json();
    if (health.status !== 'ok') throw new Error('Backend is not healthy');
    connection.classList.add('is-online');
    connection.lastChild.textContent = ' Backend connected';
  } catch {
    connection.classList.add('is-offline');
    connection.lastChild.textContent = ' Backend offline';
  }
}

function requestPayload() {
  const values = new FormData(form);
  const products = list(String(values.get('products') || ''));
  const channels = list(String(values.get('channels') || ''));
  const competitorNames = list(String(values.get('competitor_names') || ''));
  const reviews = reviewLines();
  if (!products.length || products.length > 20) throw new Error('Enter between 1 and 20 products or services.');
  if (!channels.length || channels.length > 10) throw new Error('Enter between 1 and 10 channels.');
  if (competitorNames.length > 3) throw new Error('Enter at most 3 competitor names.');
  if (reviews.length > 200) throw new Error('Enter at most 200 reviews.');
  if (reviews.some((review) => review.length > 2000)) throw new Error('Each review must be 2,000 characters or shorter.');
  return {
    task_id: `marketing-ui-${Date.now()}`,
    business: {
      name: String(values.get('name')).trim(),
      industry: String(values.get('industry')).trim(),
      location: String(values.get('location')).trim(),
      products,
      target_customers: String(values.get('target_customers')).trim(),
      marketing_budget_rm: Number(values.get('marketing_budget_rm')),
      objective: String(values.get('objective')).trim(),
      channels,
      competitor_names: competitorNames,
    },
    reviews: reviews.map((text) => ({ text, language: 'en', source: 'marketing_ui' })),
    research_mode: String(values.get('research_mode')),
  };
}

function card(title, className = '') {
  const item = element('section', `report-card ${className}`.trim());
  item.append(element('h3', '', title));
  return item;
}

function pill(text, kind = '') {
  return element('span', `meta-pill ${kind}`.trim(), text);
}

function summaryCard(report) {
  const item = card('How this report was made');
  const row = element('div', 'meta-row');
  const execution = report.execution || {};
  const engines = [
    ['Sentiment', execution.sentiment_engine],
    ['Research', execution.research_engine],
    ['Drafting', execution.strategy_engine],
  ];
  for (const [label, engine] of engines) {
    const name = String(engine || 'unavailable');
    row.append(pill(`${label}: ${name.replaceAll('_', ' ')}`, name === 'fixture' ? 'is-fixture' : name === 'unavailable' ? '' : 'is-live'));
  }
  item.append(row);
  item.append(element('p', 'report-subtle', `${execution.search_calls ?? 0} search call(s) · ${execution.llm_calls ?? 0} LLM call(s) · ${execution.elapsed_ms ?? 0} ms · task ${report.task_id}`));
  return item;
}

function sentimentCard(sentiment) {
  const item = card('Review sentiment');
  item.append(element('p', 'report-subtle', `${sentiment.processed_count} processed · ${sentiment.excluded_count} excluded · model ${sentiment.model_status}`));
  const stats = element('div', 'stat-row');
  for (const [label, value] of [
    ['Positive', sentiment.positive_pct],
    ['Neutral', sentiment.neutral_pct],
    ['Negative', sentiment.negative_pct],
  ]) {
    const stat = element('div', 'stat');
    stat.append(element('b', '', value == null ? '—' : `${value}%`), element('span', '', label));
    stats.append(stat);
  }
  item.append(stats);
  for (let star = 5; star >= 1; star -= 1) {
    const count = Number(sentiment.five_star_counts?.[`${star}_star`] || 0);
    const percent = sentiment.processed_count ? 100 * count / sentiment.processed_count : 0;
    const row = element('div', 'star-row');
    const track = element('div', 'star-track');
    const fill = element('div', 'star-fill');
    fill.style.width = `${percent}%`;
    track.append(fill);
    row.append(element('span', '', `${star} star`), track, element('strong', '', String(count)));
    item.append(row);
  }
  return item;
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function findingsCard(findings) {
  const item = card('Competitor evidence');
  item.append(element('p', 'section-caption', `${findings.length} source${findings.length === 1 ? '' : 's'} returned. Search snippets are leads to verify, not confirmed offers.`));
  if (!findings.length) item.append(element('p', 'report-subtle', 'No usable competitor observations were returned.'));
  for (const finding of findings) {
    const entry = element('article', 'evidence-item');
    entry.append(element('h4', '', `${finding.evidence_id} · ${finding.competitor}`));
    entry.append(element('p', '', finding.fact));
    const url = safeUrl(finding.source_url);
    if (url) {
      const link = element('a', '', 'Open source ↗');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      entry.append(link);
    }
    item.append(entry);
  }
  return item;
}

function campaignsCard(campaigns) {
  const item = card('Ranked campaigns');
  item.append(element('p', 'section-caption', `${campaigns.length} proposal${campaigns.length === 1 ? '' : 's'} · owner approval required before any campaign is used.`));
  if (!campaigns.length) item.append(element('p', 'report-subtle', 'No campaigns were returned. Check the warnings and execution details.'));
  for (const campaign of campaigns) {
    const entry = element('article', 'campaign');
    const head = element('div', 'campaign-head');
    const title = element('div');
    title.append(element('span', 'campaign-rank', `RANK ${campaign.rank}`), element('h4', '', campaign.name));
    head.append(title, element('span', 'campaign-score', `${campaign.suitability_score}/100`));
    entry.append(head);
    entry.append(element('p', '', campaign.idea));
    entry.append(element('p', 'campaign-caption', campaign.sample_caption));
    entry.append(element('p', 'campaign-details', `${campaign.channel} · RM ${Number(campaign.estimated_budget_rm).toFixed(0)} · ${campaign.duration_days} days · KPI: ${campaign.kpi}`));
    entry.append(element('p', 'campaign-details', `Evidence: ${campaign.evidence_ids.length ? campaign.evidence_ids.join(', ') : 'none cited'} · Approval: ${campaign.approval_required ? 'required' : 'not marked'}`));
    if (campaign.ranking_rationale) entry.append(element('p', 'campaign-details', `Why it ranked here: ${campaign.ranking_rationale}`));
    item.append(entry);
  }
  return item;
}

function renderReport(report) {
  results.replaceChildren();
  setReportState(`${report.status} · ${report.data_mode}`, report.status === 'completed' ? 'is-ready' : 'is-partial');
  results.append(summaryCard(report), sentimentCard(report.sentiment));
  if (report.warnings?.length) {
    const warnings = card('Warnings and limits', 'warning-card');
    const listElement = element('ul');
    for (const warning of report.warnings) listElement.append(element('li', '', warning));
    warnings.append(listElement);
    results.append(warnings);
  }
  results.append(findingsCard(report.competitor_findings || []), campaignsCard(report.ranked_campaigns || []));
  const raw = element('details', 'report-card raw-json');
  raw.append(element('summary', '', 'View raw API response'), element('pre', '', JSON.stringify(report, null, 2)));
  results.append(raw);
}

function apiError(response, body) {
  if (response.status === 401) return 'The backend requires a Marketing API token. Add it under Connection options.';
  if (response.status === 422) {
    const detail = Array.isArray(body?.detail) ? body.detail.slice(0, 2).map((item) => item.msg).join('; ') : '';
    return `The request needs a correction.${detail ? ` ${detail}` : ''}`;
  }
  return typeof body?.detail === 'string' ? body.detail : `The backend returned HTTP ${response.status}.`;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  let payload;
  try {
    payload = requestPayload();
  } catch (error) {
    setMessage(error.message, true);
    return;
  }
  runButton.disabled = true;
  runButton.firstChild.textContent = 'Analyzing… ';
  setMessage(payload.research_mode === 'live' ? 'Running model inference, live research, and campaign drafting…' : 'Running model inference and demo analysis…');
  setReportState('Running');
  try {
    const token = field('api_token').value.trim();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${apiBase}/marketing/analyze`, { method: 'POST', headers, body: JSON.stringify(payload) });
    let body;
    try { body = await response.json(); } catch { body = null; }
    if (!response.ok) throw new Error(apiError(response, body));
    renderReport(body);
    setMessage(`Finished. ${body.execution?.sentiment_inference_count ?? 0} review(s) analyzed; ${body.ranked_campaigns?.length ?? 0} campaign(s) returned.`);
  } catch (error) {
    setReportState('Request failed', 'is-partial');
    setMessage(error instanceof TypeError ? 'Could not reach the backend. Start FastAPI on port 8000 and try again.' : error.message, true);
  } finally {
    runButton.disabled = false;
    runButton.firstChild.textContent = 'Run analysis ';
  }
});

field('reviews').addEventListener('input', updateReviewCount);
document.querySelector('#loadSample').addEventListener('click', loadSample);
document.querySelector('#clearForm').addEventListener('click', clearForm);
document.querySelector('#checkHealth').addEventListener('click', checkHealth);

loadSample();
checkHealth();
