/* Kaunter pipeline view (lives inside index.html, toggled from the dock): draws how WorkBuddy built a widget (input -> classify -> JSON -> widget) as a clickable flow.
   Reads custom specs from localStorage (spec.pipeline, see skills/kaunter-create/SKILL.md); built-in widgets get a standard flow. */
(function () {
  'use strict';

  var I18N = window.I18N;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var str = function (v, n) { return String(v == null ? '' : v).slice(0, n || 160); };
  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  };
  var lang;
  var readLang = function () { lang = store.get('kaunter.lang') || ((navigator.language || '').toLowerCase().indexOf('ms') === 0 ? 'ms' : 'en'); };
  readLang();
  var t = function (k, v) {
    var s = (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k;
    if (v) for (var x in v) s = s.replace('{' + x + '}', v[x]);
    return s;
  };

  var ICON = {
    trigger: 'M13 3L5 13.5h6L10 21l8-10.5h-6z',
    ai: 'M6 8h12v9H6zM12 4v4M9.5 12v1.5M14.5 12v1.5M9 17v2M15 17v2',
    branch: 'M6 4v6a4 4 0 0 0 4 4h8M6 20v-6M15 11l3 3-3 3',
    data: 'M9 4c-2 0-3 1-3 3v2c0 1.5-1 3-2 3 1 0 2 1.5 2 3v2c0 2 1 3 3 3M15 4c2 0 3 1 3 3v2c0 1.5 1 3 2 3-1 0-2 1.5-2 3v2c0 2-1 3-3 3',
    tool: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM12 3v3M12 18v3M3 12h3M18 12h3',
    model: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9',
    memory: 'M5 6c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3zM5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3',
    widget: 'M4 4h7v9H4zM13 4h7v5h-7zM13 11h7v9h-7zM4 15h7v5H4z',
    output: 'M5 12h12M13 7l5 5-5 5'
  };
  var SUBS = { model: 1, memory: 1, tool: 1 };
  var PATH_OK = /^[MmLlHhVvCcSsQqTtAaZz0-9 ,.\-]+$/;

  /* ---------- widgets: built-ins (standard flow) + customs (spec.pipeline or a 3-step flow) ---------- */
  var BUILT = { /* id: [input title, input sub, what it reads, data key] */
    time: ['Device clock', 'system', 'Reads the time from your device. There is no AI step for this widget.', 'events'],
    cal: ['Chats and meeting notes', 'chat, meeting', 'Dates and times mentioned in your messages and meeting notes.', 'events'],
    rem: ['Chat messages', 'chat', 'Messages like "remind me to pay rent on Friday".', 'reminders'],
    todo: ['Chats, photos, notes', 'chat, photo, note', 'Anything you ask WorkBuddy to keep track of.', 'todo'],
    sales: ['Sales sheet', 'spreadsheet, photo', 'Daily takings you drop into the input folder.', 'sales'],
    spend: ['Receipts and bills', 'photo, PDF', 'Receipt photos and bills dropped into the input folder.', 'spend'],
    meet: ['Meeting notes', 'meeting', 'Notes or recordings from a meeting.', 'meetings'],
    owe: ['Chats and invoices', 'chat, PDF', 'Who owes you and who you owe.', 'owe'],
    pack: ['Month folder', 'files', 'Receipts, the sales sheet and the bank statement for your accountant.', 'pack']
  };
  function standard(id, title, inT, inS, inD, key, noAi) {
    var n = [{ id: 'in', kind: 'trigger', title: inT, label: inS, desc: inD },
      { id: 'json', kind: 'data', title: 'JSON data', label: 'data.js', desc: 'WorkBuddy writes the result as structured JSON into window.KAUNTER_DATA.' + key + '. The board only ever reads this file.' },
      { id: 'w', kind: 'widget', title: title, label: 'on your board', desc: 'The ' + title + ' widget draws the JSON. You can move it, resize it and save the layout.' }];
    if (!noAi) n.splice(1, 0, { id: 'wb', kind: 'ai', title: 'WorkBuddy', label: 'reads and classifies', desc: 'WorkBuddy reads the input, works out what it is and pulls out the facts: dates, amounts, names. Nothing is sent anywhere else.' });
    var e = [];
    n.forEach(function (x, i) { if (i) e.push({ from: n[i - 1].id, to: x.id }); });
    return { nodes: n, edges: e };
  }
  function list() {
    var customs = store.get('kaunter.custom.v1') || {};
    var out = Object.keys(BUILT).map(function (id) { return { id: id, title: I18N[lang]['w.' + id] || id, std: 1 }; });
    Object.keys(customs).forEach(function (id) {
      var s = customs[id], ti = typeof s.title === 'object' && s.title ? s.title : { en: s.title };
      out.push({ id: id, title: str(ti[lang] || ti.en || id, 40), spec: s });
    });
    return out;
  }
  function flowOf(w) {
    if (w.spec && w.spec.pipeline && Array.isArray(w.spec.pipeline.nodes) && w.spec.pipeline.nodes.length) return clean(w.spec.pipeline, w);
    if (w.spec) return standard(w.id, w.title, 'Your request', '/create', 'You described this widget in the chat. WorkBuddy turned it into a spec.', 'widgets', true);
    var b = BUILT[w.id];
    return standard(w.id, w.title, b[0], b[1], b[2], b[3], w.id === 'time');
  }
  /* LLM-written pipelines are data: strings are trimmed and escaped on render, unknown kinds fall back to "data" */
  function clean(p, w) {
    var seen = {};
    var nodes = p.nodes.slice(0, 24).map(function (n, i) {
      var id = str(n.id || 'n' + i, 24);
      seen[id] = 1;
      return { id: id, kind: ICON[n.kind] ? n.kind : 'data', title: str(n.title || id, 40), label: str(n.sub, 40), desc: str(n.desc, 500), x: isFinite(n.x) && n.x !== null ? Number(n.x) : null, y: isFinite(n.y) && n.y !== null ? Number(n.y) : null, icon: PATH_OK.test(n.icon || '') ? n.icon : '' };
    });
    var edges = (p.edges || []).slice(0, 60).map(function (e) {
      var a = Array.isArray(e) ? e : [e.from, e.to, e.label, e.dashed ? 'dashed' : ''];
      return { from: String(a[0]), to: String(a[1]), label: str(a[2], 20), dashed: a[3] === 'dashed' };
    }).filter(function (e) { return seen[e.from] && seen[e.to]; });
    return { nodes: nodes, edges: edges };
  }

  /* ---------- layout (cells -> pixels). Explicit x,y win; otherwise columns by depth, sub-nodes hang under their parent ---------- */
  var CW = 240, RH = 175, PAD_X = 50, PAD_Y = 50;
  function layout(f) {
    var by = {};
    f.nodes.forEach(function (n) { by[n.id] = n; n.sub = !!SUBS[n.kind] || f.edges.some(function (e) { return e.dashed && e.from === n.id; }); });
    var solid = f.edges.filter(function (e) { return !e.dashed; }), d = {};
    f.nodes.forEach(function (n) { d[n.id] = 0; });
    for (var k = 0; k < f.nodes.length; k++) solid.forEach(function (e) { if (d[e.to] < d[e.from] + 1 && d[e.from] + 1 < f.nodes.length) d[e.to] = d[e.from] + 1; });
    var rows = {};
    f.nodes.forEach(function (n) {
      if (n.sub) return;
      n.cx = n.x != null ? n.x : d[n.id];
      n.cy = n.y != null ? n.y : (rows[n.cx] = rows[n.cx] == null ? 0 : rows[n.cx] + 1);
    });
    var kids = {};
    f.nodes.forEach(function (n) {
      if (!n.sub) return;
      var pe = f.edges.filter(function (e) { return e.from === n.id && e.dashed; })[0] || f.edges.filter(function (e) { return e.from === n.id || e.to === n.id; })[0];
      var par = pe && by[pe.from === n.id ? pe.to : pe.from];
      n.par = par && !par.sub ? par : null;
      if (n.par) (kids[n.par.id] = kids[n.par.id] || []).push(n);
      else { n.cx = n.x != null ? n.x : 0; n.cy = n.y != null ? n.y : 2; }
    });
    Object.keys(kids).forEach(function (pid) {
      var ks = kids[pid], p = by[pid];
      ks.forEach(function (n, i) { n.cx = n.x != null ? n.x : p.cx + (i - (ks.length - 1) / 2) * 0.8; n.cy = n.y != null ? n.y : p.cy + 1.3; });
    });
    f.nodes.forEach(function (n) { n.px = PAD_X + n.cx * CW; n.py = PAD_Y + n.cy * RH; n.s = n.sub ? 64 : 88; });
    return by;
  }

  /* ---------- draw ---------- */
  var S = { z: 1, w0: 0, h0: 0, id: null, flow: null, by: null, sel: null, w: null };
  var board = $('#board'), stage = $('#stage'), panel = $('#panel');
  var ic = function (path) { return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="' + path + '"/></svg>'; };
  var requests = function () { return store.get('kaunter.alter.v1') || []; };
  var flagged = function (nid) { return requests().some(function (r) { return r.widget === S.id && r.node === nid; }); };

  function draw() {
    var f = S.flow, w = 0, h = 0;
    f.nodes.forEach(function (n) { w = Math.max(w, n.px + 150); h = Math.max(h, n.py + n.s + 70); });
    var paths = '', labels = '';
    f.edges.forEach(function (e) {
      var a = S.by[e.from], b = S.by[e.to], x1, y1, x2, y2, c;
      if (e.dashed) { x1 = a.px + a.s / 2; y1 = a.py; x2 = b.px + b.s / 2; y2 = b.py + b.s + (b.label ? 44 : 26); c = Math.max(30, Math.abs(y2 - y1) / 2); paths += '<path class="dashed" d="M' + x1 + ' ' + y1 + 'C' + x1 + ' ' + (y1 - c) + ' ' + x2 + ' ' + (y2 + c) + ' ' + x2 + ' ' + y2 + '"/><circle class="tip" cx="' + x2 + '" cy="' + (y2 + 2) + '" r="4"/>'; }
      else {
        x1 = a.px + a.s; y1 = a.py + a.s / 2; x2 = b.px; y2 = b.py + b.s / 2; c = Math.max(40, Math.abs(x2 - x1) / 2);
        paths += '<path d="M' + x1 + ' ' + y1 + 'C' + (x1 + c) + ' ' + y1 + ' ' + (x2 - c) + ' ' + y2 + ' ' + x2 + ' ' + y2 + '"/><path class="tip" d="M' + (x2 - 9) + ' ' + (y2 - 6) + 'L' + x2 + ' ' + y2 + 'L' + (x2 - 9) + ' ' + (y2 + 6) + 'z"/>';
      }
      if (e.label) labels += '<span class="pl-el" style="left:' + (x1 + (x2 - x1) * 0.35) + 'px;top:' + (y1 + (y2 - y1) * 0.35 - 14) + 'px">' + esc(e.label) + '</span>';
    });
    stage.style.width = w + 'px';
    stage.style.height = h + 'px';
    S.w0 = w; S.h0 = h;
    applyZoom();
    stage.innerHTML = '<svg class="pl-edges" width="' + w + '" height="' + h + '" aria-hidden="true">' + paths + '</svg>' + labels + f.nodes.map(function (n) {
      return '<button type="button" class="pl-node' + (n.sub ? ' sub' : '') + '" data-k="' + n.kind + '" data-id="' + esc(n.id) + '" aria-pressed="' + (S.sel === n.id) + '" style="left:' + n.px + 'px;top:' + n.py + 'px">' +
        '<span class="pl-tile">' + ic(n.icon || (n.kind === 'widget' && S.w.spec && PATH_OK.test(S.w.spec.icon || '') ? S.w.spec.icon : ICON[n.kind])) + (flagged(n.id) ? '<span class="pl-flag" title="' + esc(t('pl.flag')) + '"></span>' : '') + '</span>' +
        '<span class="pl-nt">' + esc(n.title) + '</span>' + (n.label ? '<span class="pl-ns">' + esc(n.label) + '</span>' : '') + '</button>';
    }).join('');
  }
  /* ---------- zoom and pan ---------- */
  var ZMIN = 0.4, ZMAX = 2;
  function applyZoom() {
    stage.style.transform = 'scale(' + S.z + ')';
    $('#size').style.width = S.w0 * S.z + 'px';
    $('#size').style.height = S.h0 * S.z + 'px';
    $('#zPct').textContent = Math.round(S.z * 100) + '%';
  }
  function zoomTo(z, px, py) { /* keep the point under (px,py), in board pixels, fixed */
    z = Math.min(ZMAX, Math.max(ZMIN, z));
    if (px == null) { px = board.clientWidth / 2; py = board.clientHeight / 2; }
    var cx = (board.scrollLeft + px) / S.z, cy = (board.scrollTop + py) / S.z;
    S.z = z;
    applyZoom();
    board.scrollLeft = cx * z - px;
    board.scrollTop = cy * z - py;
  }
  function fit() {
    S.z = Math.min(1, Math.max(ZMIN, Math.min(board.clientWidth / S.w0, board.clientHeight / S.h0)));
    applyZoom();
    board.scrollLeft = board.scrollTop = 0;
  }
  $('#zIn').addEventListener('click', function () { zoomTo(S.z * 1.25); });
  $('#zOut').addEventListener('click', function () { zoomTo(S.z / 1.25); });
  $('#zPct').addEventListener('click', function () { zoomTo(1); });
  $('#zFit').addEventListener('click', fit);
  board.addEventListener('wheel', function (e) {
    if (!e.ctrlKey && !e.metaKey) return; /* plain wheel keeps scrolling; trackpad pinch arrives as ctrl+wheel */
    e.preventDefault();
    var r = board.getBoundingClientRect();
    zoomTo(S.z * Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  board.addEventListener('keydown', function (e) {
    if (e.key === '+' || e.key === '=') zoomTo(S.z * 1.25); else if (e.key === '-') zoomTo(S.z / 1.25); else if (e.key === '0') fit(); else return;
    e.preventDefault();
  });
  board.addEventListener('pointerdown', function (e) { /* drag empty canvas to pan (mouse/pen; touch scrolls natively) */
    if (e.pointerType === 'touch' || e.button > 0 || e.target.closest('.pl-node')) return;
    var sx = e.clientX, sy = e.clientY, l = board.scrollLeft, tp = board.scrollTop;
    board.classList.add('panning');
    var move = function (ev) { board.scrollLeft = l - (ev.clientX - sx); board.scrollTop = tp - (ev.clientY - sy); };
    var up = function () { board.classList.remove('panning'); removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  });
  function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }

  function drawPanel() {
    var n = S.sel && S.by[S.sel];
    if (!n) {
      var mine = requests().filter(function (r) { return r.widget === S.id; });
      panel.innerHTML = '<h2>' + esc(S.w.title) + '</h2><p class="pl-empty">' + esc(t('pl.pickStep')) + '</p>' + queueHtml(mine);
      return;
    }
    var from = S.flow.edges.filter(function (e) { return e.to === n.id; }).map(function (e) { return S.by[e.from].title; });
    var to = S.flow.edges.filter(function (e) { return e.from === n.id; }).map(function (e) { return S.by[e.to].title; });
    var li = function (a) { return a.length ? '<ul>' + a.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '<p class="pl-empty">–</p>'; };
    panel.innerHTML = '<span class="pl-kind">' + esc(t('pl.k.' + n.kind)) + '</span><h2>' + esc(n.title) + '</h2>' +
      '<section><h3>' + esc(t('pl.what')) + '</h3><p>' + esc(n.desc || t('pl.nodesc')) + '</p></section>' +
      '<section><h3>' + esc(t('pl.in')) + '</h3>' + li(from) + '</section><section><h3>' + esc(t('pl.out')) + '</h3>' + li(to) + '</section>' +
      '<section><h3>' + esc(t('pl.alter')) + '</h3><textarea id="alterText" maxlength="500" placeholder="' + esc(t('pl.ph')) + '" aria-label="' + esc(t('pl.alter')) + '"></textarea></section>' +
      '<button type="button" class="pl-go" id="alterGo" disabled>' + esc(t('pl.send')) + '</button>' + queueHtml(requests().filter(function (r) { return r.widget === S.id && r.node === n.id; }));
  }
  function queueHtml(rs) { return rs.length ? '<section class="pl-q"><h3>' + esc(t('pl.queue')) + '</h3><ul>' + rs.slice(-5).map(function (r) { return '<li>' + esc(r.text) + ' <button type="button" class="pl-copy" data-at="' + esc(r.at) + '">' + esc(t('pl.copy')) + '</button></li>'; }).join('') + '</ul></section>' : ''; }

  function select(id) { S.sel = id; draw(); drawPanel(); }
  function open(id) {
    var w = list().filter(function (x) { return x.id === id; })[0] || list()[0];
    S.id = w.id; S.w = w; S.sel = null; S.flow = flowOf(w);
    S.by = layout(S.flow);
    $$('#pick button').forEach(function (b) { b.setAttribute('aria-checked', b.dataset.id === w.id); });
    if ($('#pick')._jelly) $('#pick')._jelly.sync();
    draw(); drawPanel();
    fit();
  }

  /* ---------- ask for a change: saved to a queue and copied as a ready-to-paste WorkBuddy prompt ---------- */
  var toastT = 0;
  function toast(m) { var el = $('#toast'); el.textContent = m; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('show'); }, 3200); }
  function ask(text) {
    var n = S.by[S.sel];
    var prompt = 'Change the "' + n.title + '" step (node id "' + n.id + '") of the Kaunter "' + S.w.title + '" widget (id "' + S.id + '"): ' + text +
      '\nKeep every other step. Reply with the full updated kaunter-create JSON spec, including the pipeline field.';
    var q = requests();
    q.push({ widget: S.id, node: n.id, text: text, prompt: prompt, at: new Date().toISOString() });
    store.set('kaunter.alter.v1', q.slice(-50));
    var done = function (ok) { toast(t(ok ? 'pl.saved' : 'pl.savedNoCopy')); draw(); drawPanel(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(prompt).then(function () { done(true); }, function () { done(false); }); else done(false);
  }

  stage.addEventListener('click', function (e) { var b = e.target.closest('.pl-node'); if (b) select(b.dataset.id); });
  panel.addEventListener('input', function (e) { if (e.target.id === 'alterText') $('#alterGo').disabled = !e.target.value.trim(); });
  panel.addEventListener('click', function (e) {
    var c = e.target.closest('.pl-copy');
    if (c) {
      var r = requests().filter(function (x) { return x.at === c.dataset.at; })[0];
      if (r && navigator.clipboard) navigator.clipboard.writeText(r.prompt).then(function () { toast(t('pl.saved')); }, function () { toast(t('pl.savedNoCopy')); });
      return;
    }
    if (!e.target.closest('#alterGo')) return;
    var v = $('#alterText').value.trim();
    if (v) ask(v);
  });

  /* called by app.js every time the Pipeline view opens, so new /create widgets and language changes show up */
  function show(id) {
    readLang();
    $('#plBack').textContent = '← ' + t('pl.back');
    $('#plTitle').textContent = t('pl.title');
    $('#plHint').textContent = t('pl.hint');
    $('#pick').innerHTML = list().map(function (w) { return '<button type="button" data-id="' + esc(w.id) + '" aria-checked="false">' + esc(w.title) + '</button>'; }).join('');
    window.Jelly.mount($('#pick'), { onChange: function (wid) { open(wid); } }).refresh(); /* springy chips (jelly.js) */
    open(id || S.id || 'todo');
  }
  window.KaunterPipeline = { show: show };
})();
