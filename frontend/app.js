/* Kaunter: a dotted-canvas widget dashboard. Plain JS, no build, works from file:// on any device.
   Reads window.KAUNTER_DATA (written by WorkBuddy) and window.I18N. Layout + language live in localStorage. */
/* Auto-redirect: if opened from file://, hop to the bridge server so /api/chat works. */
if (location.protocol === 'file:') {
  try { location.replace('http://localhost:3120' + location.hash); } catch (e) { /* stay put */ }
}
(function () {
  'use strict';

  var D = window.KAUNTER_DATA || {};
  var I18N = window.I18N;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isMobile = function () { return matchMedia('(max-width: 720px)').matches; };
  var stripMode = function () { return matchMedia('(max-width: 1279px)').matches; };

  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode: layout just will not persist */ } }
  };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* ---------- language ---------- */
  var lang = store.get('kaunter.lang') || ((navigator.language || '').toLowerCase().indexOf('ms') === 0 ? 'ms' : 'en');
  var t = function (k, v) {
    var s = (I18N[lang] && I18N[lang][k]) || I18N.en[k] || k;
    if (v) for (var x in v) s = s.replace('{' + x + '}', v[x]);
    return s;
  };
  var loc = function () { return lang === 'ms' ? 'ms-MY' : 'en-MY'; };
  var ic = function (id) { return '<svg class="ic" aria-hidden="true"><use href="#' + id + '"/></svg>'; };

  /* ---------- dates, money ---------- */
  var startOfDay = function (d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  var isoOf = function (d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  var parse = function (s) { var p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  var dayDiff = function (s) { return Math.round((parse(s) - startOfDay(new Date())) / 864e5); };
  var money = function (n) { return 'RM ' + Number(n).toLocaleString(loc(), { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
  var moneyF = function (n) { return 'RM ' + Number(n).toLocaleString(loc(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var acts = function (n) { return n === 1 ? t('meet.action1') : t('meet.actions', { n: n }); };
  var kfmt = function (n) { return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n); };
  function dueLabel(s) {
    var n = dayDiff(s);
    if (n < 0) return { text: t('due.over', { n: -n }), late: true };
    if (n === 0) return { text: t('due.today') };
    if (n === 1) return { text: t('due.tomorrow') };
    return { text: new Intl.DateTimeFormat(loc(), { weekday: 'short', day: 'numeric', month: 'short' }).format(parse(s)) };
  }
  var pillFor = function (s) { var d = dueLabel(s); return '<span class="pill' + (d.late ? ' late' : '') + '">' + (d.late ? ic('i-alert') : '') + esc(d.text) + '</span>'; };
  var srcTag = function (k) { var i = { photo: 'i-photo', pdf: 'i-pdf', chat: 'i-chat', meeting: 'i-meet', note: 'i-note' }[k] || 'i-note'; return '<span class="src">' + ic(i) + esc(t('src.' + k)) + '</span>'; };

  /* ---------- modules ---------- */
  var S = { view: 'board', mode: 'view', layout: null, name: 'starter', dirty: false, cols: 12, cell: 88, bp: 'wide', done: store.get('kaunter.done') || {} };
  var todoDone = function (it) { return it.id in S.done ? S.done[it.id] : it.done; };

  var MODS = [
    { id: 'cal', ic: 'i-cal', g: ['#5eead4', '#0d9488'], gi: '#04201c', def: [4, 5], min: [2, 1], render: rCal, mini: mCal },
    { id: 'rem', ic: 'i-rem', g: ['#cbd5e1', '#64748b'], gi: '#0f172a', def: [4, 3], min: [2, 1], render: rRem, mini: mRem },
    { id: 'todo', ic: 'i-todo', g: ['#2dd4bf', '#0f766e'], def: [4, 4], min: [2, 1], render: rTodo, mini: mTodo },
    { id: 'sales', ic: 'i-sales', g: ['#99f6e4', '#14b8a6'], gi: '#04201c', def: [4, 4], min: [2, 1], render: rSales, mini: mSales },
    { id: 'spend', ic: 'i-spend', g: ['#94a3b8', '#475569'], def: [4, 4], min: [2, 1], render: rSpend, mini: mSpend },
    { id: 'meet', ic: 'i-meet', g: ['#a9b6c6', '#5b6b7f'], def: [4, 4], min: [2, 1], render: rMeet, mini: mMeet },
    { id: 'owe', ic: 'i-owe', g: ['#e2e8f0', '#94a3b8'], gi: '#0f172a', def: [4, 4], min: [2, 1], render: rOwe, mini: mOwe },
    { id: 'pack', ic: 'i-pack', g: ['#7dd3c8', '#2a9d8f'], gi: '#04201c', def: [4, 3], min: [2, 1], render: rPack, mini: mPack },
    { id: 'time', ic: 'i-time', g: ['#475569', '#1f2937'], def: [4, 2], min: [2, 1], render: rTime, mini: mTime }
  ];
  var MOD = {};
  MODS.forEach(function (m) { MOD[m.id] = m; });

  function rTime() {
    var now = new Date();
    var parts = new Intl.DateTimeFormat(loc(), { hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(now);
    var hm = parts.filter(function (p) { return p.type === 'hour' || p.type === 'minute' || p.type === 'literal'; }).map(function (p) { return p.value; }).join('').trim();
    var per = (parts.filter(function (p) { return p.type === 'dayPeriod'; })[0] || {}).value || '';
    var hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    var today = isoOf(now);
    var next = (D.events || []).filter(function (e) { return e.date === today && e.time >= hhmm; }).sort(function (a, b) { return a.time < b.time ? -1 : 1; })[0];
    var date = new Intl.DateTimeFormat(loc(), { weekday: 'long', day: 'numeric', month: 'long' }).format(now);
    return '<div class="clock"><span class="clock-t">' + esc(hm) + '</span><span class="clock-p">' + esc(per) + '</span></div>' +
      '<p class="clock-d">' + esc(date) + '</p>' +
      '<p class="clock-n">' + (next ? '<span class="muted">' + esc(t('time.next')) + ':</span> <b>' + esc(next.time) + '</b> ' + esc(next.title) : '<span class="muted">' + esc(t('time.none')) + '</span>') + '</p>';
  }

  function rCal() {
    var now = new Date(), y = now.getFullYear(), m = now.getMonth();
    var lead = (new Date(y, m, 1).getDay() + 6) % 7;
    var dim = new Date(y, m + 1, 0).getDate();
    var evDays = {};
    (D.events || []).forEach(function (e) { evDays[e.date] = 1; });
    var wd = '';
    for (var i = 0; i < 7; i++) wd += '<span class="wd">' + esc(new Intl.DateTimeFormat(loc(), { weekday: 'narrow' }).format(new Date(2024, 0, 1 + i))) + '</span>';
    var cells = '';
    for (var b = 0; b < lead; b++) cells += '<span></span>';
    for (var d = 1; d <= dim; d++) {
      var key = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      cells += '<span class="d' + (d === now.getDate() ? ' today' : '') + (evDays[key] ? ' has' : '') + '">' + d + '</span>';
    }
    var upcoming = (D.events || []).filter(function (e) { return dayDiff(e.date) >= 0; }).sort(function (a, b) { return (a.date + a.time) < (b.date + b.time) ? -1 : 1; }).slice(0, 4);
    var list = upcoming.map(function (e) {
      var dt = parse(e.date);
      return '<div class="row"><div class="ev-date"><b>' + dt.getDate() + '</b><span>' + esc(new Intl.DateTimeFormat(loc(), { month: 'short' }).format(dt)) + '</span></div>' +
        '<div class="row-main"><div class="row-t">' + esc(e.title) + '</div><div class="row-s"><span>' + esc(e.time) + '</span>' + srcTag(e.src) + '</div></div></div>';
    }).join('') || '<p class="empty">' + esc(t('cal.empty')) + '</p>';
    return '<div class="cal-block"><div class="cal-title">' + esc(new Intl.DateTimeFormat(loc(), { month: 'long', year: 'numeric' }).format(now)) + '</div><div class="mg">' + wd + cells + '</div></div>' + list;
  }

  function rTodo() {
    var items = (D.todo || []).slice().sort(function (a, b) { return (todoDone(a) - todoDone(b)) || (a.due < b.due ? -1 : 1); });
    var open = items.filter(function (i) { return !todoDone(i); });
    var late = open.filter(function (i) { return dayDiff(i.due) < 0; }).length;
    var head = '<p class="sum"><b>' + esc(t('todo.open', { n: open.length })) + '</b>' + (late ? ' · ' + esc(t('todo.overdue', { n: late })) : '') + '</p>';
    if (!items.length) return head + '<p class="empty">' + esc(t('todo.empty')) + '</p>';
    return head + items.map(function (i) {
      var done = todoDone(i);
      return '<div class="row"><button type="button" class="chk" role="checkbox" aria-checked="' + done + '" data-todo="' + esc(i.id) + '" aria-label="' + esc(i.text) + '">' + ic('i-check') + '</button>' +
        '<div class="row-main"><div class="row-t' + (done ? ' done' : '') + '">' + esc(i.text) + '</div><div class="row-s">' + (done ? '' : pillFor(i.due)) + srcTag(i.src) + '</div></div></div>';
    }).join('');
  }

  function rRem() {
    var items = (D.reminders || []).slice().sort(function (a, b) { return (a.date + a.time) < (b.date + b.time) ? -1 : 1; });
    if (!items.length) return '<p class="empty">' + esc(t('rem.empty')) + '</p>';
    return items.map(function (r) {
      var d = dueLabel(r.date);
      return '<div class="row"><span class="muted">' + ic('i-rem') + '</span><div class="row-main"><div class="row-t">' + esc(r.text) + '</div>' +
        '<div class="row-s"><span class="' + (d.late ? 'pill late' : '') + '">' + esc(d.text) + ' · ' + esc(r.time) + '</span>' + srcTag(r.src) + '</div></div></div>';
    }).join('');
  }

  function rSales() {
    var days = (D.sales && D.sales.days) || [];
    if (!days.length) return '<p class="empty">–</p>';
    var max = Math.max.apply(null, days.map(function (d) { return d.amount; })) || 1;
    var total = days.reduce(function (s, d) { return s + d.amount; }, 0);
    var last = days[days.length - 1];
    var cols = days.map(function (d, i) {
      return '<div class="col' + (i === days.length - 1 ? ' now' : '') + '"><span class="v">' + kfmt(d.amount) + '</span><div class="track"><i style="--p:' + Math.round(d.amount / max * 100) + '"></i></div><span>' +
        esc(new Intl.DateTimeFormat(loc(), { weekday: 'short' }).format(parse(d.date))) + '</span></div>';
    }).join('');
    return '<p class="sum">' + esc(t('sales.week')) + ' <b class="amt">' + money(total) + '</b> · ' + esc(t('sales.today')) + ' <b class="amt">' + money(last.amount) + '</b></p><div class="chart">' + cols + '</div>';
  }

  function rSpend() {
    var items = D.spend || [];
    var total = items.reduce(function (s, i) { return s + i.amount; }, 0);
    return '<p class="sum">' + esc(t('spend.month')) + ' <b class="amt">' + moneyF(total) + '</b></p>' + items.map(function (i) {
      return '<div class="row"><div class="row-main"><div class="row-t">' + esc(i.vendor) + '</div><div class="row-s"><span>' + esc(i.category) + '</span>' + srcTag(i.src) +
        (i.conf < 0.8 ? '<span class="pill warn" title="' + esc(t('spend.checkTitle')) + '">' + ic('i-alert') + esc(t('spend.check')) + '</span>' : '') + '</div></div><span class="amt">' + moneyF(i.amount) + '</span></div>';
    }).join('');
  }

  function rMeet() {
    var ms = D.meetings || [];
    if (!ms.length) return '<p class="empty">–</p>';
    var rel = new Intl.RelativeTimeFormat(loc(), { numeric: 'auto' });
    var m = ms[0];
    var dec = m.decisions && m.decisions.length ? '<div class="small muted">' + esc(t('meet.decisions')) + '</div><ul class="dec">' + m.decisions.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul>' : '';
    var earlier = ms.slice(1).map(function (e) {
      return '<div class="row"><div class="row-main"><div class="row-t">' + esc(e.title) + '</div><div class="row-s">' + esc(rel.format(dayDiff(e.date), 'day')) + ' · ' + esc(acts(e.actions)) + '</div></div></div>';
    }).join('');
    return '<div class="mt-title">' + esc(m.title) + '</div><div class="row-s" style="margin:4px 0 8px"><span>' + esc(rel.format(dayDiff(m.date), 'day')) + '</span><span>' + esc(t('meet.people', { n: m.people })) + '</span><span class="pill">' + esc(acts(m.actions)) + '</span></div>' + dec +
      (earlier ? '<div class="opt"><div class="small muted">' + esc(t('meet.earlier')) + '</div>' + earlier + '</div>' : '');
  }

  function rOwe() {
    var o = D.owe || { toMe: [], iOwe: [] };
    var sum = function (a) { return a.reduce(function (s, i) { return s + i.amount; }, 0); };
    var rows = function (a) {
      return a.map(function (i) { return '<div class="row"><div class="row-main"><div class="row-t">' + esc(i.who) + '</div><div class="row-s">' + pillFor(i.due) + '</div></div><span class="amt">' + money(i.amount) + '</span></div>'; }).join('');
    };
    return '<div class="grp"><span>' + esc(t('owe.toMe')) + '</span><b class="amt">' + money(sum(o.toMe)) + '</b></div>' + rows(o.toMe) +
      '<div class="grp"><span>' + esc(t('owe.iOwe')) + '</span><b class="amt">' + money(sum(o.iOwe)) + '</b></div>' + rows(o.iOwe);
  }

  function rPack() {
    var p = D.pack || {};
    var r = p.receipts || { have: 0, need: 1 };
    var ready = (r.have >= r.need ? 1 : 0) + (p.salesSheet ? 1 : 0) + (p.bank ? 1 : 0);
    var month = p.month ? new Intl.DateTimeFormat(loc(), { month: 'long', year: 'numeric' }).format(parse(p.month + '-01')) : '';
    var st = function (ok) { return '<span class="state ' + (ok ? 'ok' : 'no') + '">' + ic(ok ? 'i-check' : 'i-alert') + esc(t(ok ? 'pack.ready' : 'pack.missing')) + '</span>'; };
    return '<p class="sum"><b>' + esc(t('pack.for', { m: month })) + '</b> · ' + esc(t('pack.progress', { n: ready, m: 3 })) + '</p><div class="meter"><i style="width:' + Math.round(ready / 3 * 100) + '%"></i></div>' +
      '<div class="row"><div class="row-main"><div class="row-t">' + esc(t('pack.receipts')) + '</div><div class="row-s amt">' + r.have + ' / ' + r.need + '</div></div>' + st(r.have >= r.need) + '</div>' +
      '<div class="row"><div class="row-main"><div class="row-t">' + esc(t('pack.sales')) + '</div></div>' + st(!!p.salesSheet) + '</div>' +
      '<div class="row"><div class="row-main"><div class="row-t">' + esc(t('pack.bank')) + '</div></div>' + st(!!p.bank) + '</div>' +
      '<div class="opt row-s" style="margin-top:6px">' + esc(t('pack.folder')) + ': <code>' + esc(p.folder || '') + '</code></div>';
  }

  /* ---------- small forms: big number + two label lines, shown when a widget is shrunk ---------- */
  var mini = function (big, a, b) { return '<span class="big">' + esc(big) + '</span><div class="lbl"><div class="l1">' + esc(a) + '</div>' + (b ? '<div class="l2">' + esc(b) + '</div>' : '') + '</div>'; };
  var sumOf = function (a) { return a.reduce(function (s, i) { return s + i.amount; }, 0); };
  function mTime() {
    var now = new Date(), hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    var next = (D.events || []).filter(function (e) { return e.date === isoOf(now) && e.time >= hhmm; }).sort(function (a, b) { return a.time < b.time ? -1 : 1; })[0];
    return mini(new Intl.DateTimeFormat(loc(), { hour: 'numeric', minute: '2-digit', hour12: true }).format(now),
      new Intl.DateTimeFormat(loc(), { weekday: 'short', day: 'numeric', month: 'short' }).format(now), next ? next.time + ' ' + next.title : t('time.none'));
  }
  function mCal() {
    var now = new Date(), ev = (D.events || []).filter(function (e) { return dayDiff(e.date) >= 0; }).sort(function (a, b) { return (a.date + a.time) < (b.date + b.time) ? -1 : 1; })[0];
    return mini(now.getDate(), new Intl.DateTimeFormat(loc(), { weekday: 'long', month: 'short' }).format(now), ev ? ev.time + ' ' + ev.title : t('cal.empty'));
  }
  function mTodo() {
    var open = (D.todo || []).filter(function (i) { return !todoDone(i); });
    var late = open.filter(function (i) { return dayDiff(i.due) < 0; }).length;
    return mini(open.length, t('mini.tasks'), late ? t('todo.overdue', { n: late }) : t('mini.clear'));
  }
  function mRem() {
    var n = (D.reminders || []).slice().sort(function (a, b) { return (a.date + a.time) < (b.date + b.time) ? -1 : 1; })[0];
    return n ? mini(n.time, n.text, dueLabel(n.date).text) : mini('–', t('rem.empty'));
  }
  function mSales() {
    var days = (D.sales && D.sales.days) || [];
    return mini(money(days.length ? days[days.length - 1].amount : 0), t('sales.today'), t('sales.week') + ' ' + money(sumOf(days)));
  }
  function mSpend() { return mini(moneyF(sumOf(D.spend || [])), t('spend.month'), t('mini.receipts', { n: (D.spend || []).length })); }
  function mMeet() {
    var m = (D.meetings || [])[0];
    return m ? mini(m.actions, t('mini.actions'), m.title) : mini('–', t('w.meet'));
  }
  function mOwe() {
    var o = D.owe || { toMe: [], iOwe: [] };
    return mini(money(sumOf(o.toMe)), t('owe.toMe'), t('owe.iOwe') + ' ' + money(sumOf(o.iOwe)));
  }
  function mPack() {
    var p = D.pack || {}, r = p.receipts || { have: 0, need: 1 };
    var ready = (r.have >= r.need ? 1 : 0) + (p.salesSheet ? 1 : 0) + (p.bank ? 1 : 0);
    return mini(ready + '/3', t('pack.for', { m: p.month ? new Intl.DateTimeFormat(loc(), { month: 'long' }).format(parse(p.month + '-01')) : '' }), t('pack.progress', { n: ready, m: 3 }));
  }

  /* ---------- layouts ---------- */
  var P = {
    starter: [['time', 0, 0, 4, 1], ['rem', 4, 0, 4, 1], ['owe', 8, 0, 4, 1], ['todo', 0, 1, 4, 4], ['sales', 4, 1, 4, 3], ['cal', 8, 1, 4, 5], ['meet', 4, 4, 4, 3], ['spend', 0, 5, 4, 3]],
    shop: [['sales', 0, 0, 5, 4], ['spend', 5, 0, 4, 4], ['owe', 9, 0, 3, 4], ['todo', 0, 4, 4, 4], ['rem', 4, 4, 4, 4], ['pack', 8, 4, 4, 4]],
    founder: [['time', 0, 0, 4, 2], ['meet', 4, 0, 5, 5], ['todo', 9, 0, 3, 5], ['cal', 0, 2, 4, 5], ['owe', 4, 5, 5, 3], ['rem', 9, 5, 3, 3]]
  };
  var ORDER = { starter: ['time', 'rem', 'owe', 'todo', 'cal', 'sales', 'spend', 'meet'], shop: ['sales', 'spend', 'owe', 'todo', 'rem', 'pack'], founder: ['time', 'meet', 'todo', 'cal', 'owe', 'rem'] };
  var CH = { time: 2, cal: 7, todo: 5, rem: 4, sales: 4, spend: 5, meet: 6, owe: 5, pack: 4 };
  var hOf = function (id) { return S.bp === 'compact' ? CH[id] : MOD[id].def[1]; };

  /* ---------- custom widgets: "/create {spec}" in the chat, or D.widgets in data.js. Spec format: skills/kaunter-create/SKILL.md ----------
     Specs are data, never HTML: every string goes through esc() and every block type is drawn with the built-in classes, so any LLM's output looks native and cannot inject script. */
  var BUILTIN = Object.keys(MOD);
  var CUSTOM_KEY = 'kaunter.custom.v1';
  var str = function (v, n) { return String(v == null ? '' : v).slice(0, n || 120); };
  var pct = function (v) { return clamp(Number(v) || 0, 0, 100); };
  var CC = ['#14b8a6', '#64748b', '#5eead4', '#94a3b8', '#0a7f72', '#cbd5e1', '#7dd3c8', '#5b6b7f', '#475569', '#1f2937'];
  var BLOCK = {
    sum: function (b) { return '<p class="sum">' + (b.bold ? '<b>' + esc(str(b.bold)) + '</b> ' : '') + esc(str(b.text)) + '</p>'; },
    text: function (b) { return '<p class="small muted">' + esc(str(b.text, 400)) + '</p>'; },
    group: function (b) { return '<div class="grp"><span>' + esc(str(b.label)) + '</span><b class="amt">' + esc(str(b.value)) + '</b></div>'; },
    row: function (b) {
      var s = (b.sub ? esc(str(b.sub)) : '') + (b.pill ? '<span class="pill' + (b.late ? ' late' : '') + '">' + esc(str(b.pill, 40)) + '</span>' : '');
      return '<div class="row"><div class="row-main"><div class="row-t">' + esc(str(b.title)) + '</div>' + (s ? '<div class="row-s">' + s + '</div>' : '') + '</div>' +
        (b.value != null ? '<span class="amt">' + esc(str(b.value, 30)) + '</span>' : '') + '</div>';
    },
    meter: function (b) { return (b.label ? '<p class="sum">' + esc(str(b.label)) + '</p>' : '') + '<div class="meter"><i style="width:' + pct(b.value) + '%"></i></div>'; },
    bars: function (b) {
      var it = (b.items || []).slice(0, 12), max = Math.max.apply(null, it.map(function (i) { return Number(i.value) || 0; }).concat(1));
      return '<div class="chart">' + it.map(function (i, n) {
        return '<div class="col' + (n === it.length - 1 ? ' now' : '') + '"><span class="v">' + esc(str(i.value, 8)) + '</span><div class="track"><i style="--p:' + Math.round((Number(i.value) || 0) / max * 100) + '"></i></div><span>' + esc(str(i.label, 8)) + '</span></div>';
      }).join('') + '</div>';
    },
    /* line chart: items: [{label, value}] */
    line: function (b) {
      var it = (b.items || []).slice(0, 20);
      if (!it.length) return '';
      var vals = it.map(function (i) { return Number(i.value) || 0; });
      var max = Math.max.apply(null, vals.concat(1)), min = Math.min.apply(null, vals.concat(0)), range = (max - min) || 1;
      var W = 200, H = 80, pad = 6;
      var step = it.length > 1 ? (W - pad * 2) / (it.length - 1) : 0;
      var pts = it.map(function (i, n) {
        var x = pad + n * step, y = H - pad - ((Number(i.value) || 0) - min) / range * (H - pad * 2);
        return [x.toFixed(1), y.toFixed(1)];
      });
      var poly = pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' ');
      var area = pad + ',' + (H - pad) + ' ' + poly + ' ' + pts[pts.length - 1][0] + ',' + (H - pad);
      var dots = pts.map(function (p) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="2.2" />'; }).join('');
      var skip = Math.ceil(it.length / 6), labels = it.map(function (i, n) { return n % skip === 0 ? '<span>' + esc(str(i.label, 6)) + '</span>' : '<span></span>'; }).join('');
      return '<div class="chart-line"><svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none"><polygon class="line-area" points="' + area + '" /><polyline class="line-stroke" points="' + poly + '" />' + dots + '</svg><div class="lbls">' + labels + '</div></div>';
    },
    /* pie chart: slices: [{label, value}] or items */
    pie: function (b) {
      var it = (b.slices || b.items || []).slice(0, 8);
      if (!it.length) return '';
      var total = it.reduce(function (s, i) { return s + (Number(i.value) || 0); }, 0) || 1, off = 0;
      var arcs = it.map(function (i, n) {
        var frac = (Number(i.value) || 0) / total * 100, s = '<circle cx="21" cy="21" r="15.9" fill="none" stroke="' + CC[n % CC.length] + '" stroke-width="6" pathLength="100" stroke-dasharray="' + frac.toFixed(2) + ' ' + (100 - frac).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 21 21)" />';
        off += frac; return s;
      }).join('');
      var lg = it.map(function (i, n) { return '<div class="lg-item"><span class="lg-dot" style="background:' + CC[n % CC.length] + '"></span><span class="lg-l">' + esc(str(i.label, 16)) + '</span><b>' + esc(str(i.value, 10)) + '</b></div>'; }).join('');
      return '<div class="chart-pie"><svg viewBox="0 0 42 42">' + arcs + '</svg><div class="lg">' + lg + '</div></div>';
    },
    /* donut chart: slices: [{label, value}], center, sub */
    donut: function (b) {
      var it = (b.slices || b.items || []).slice(0, 8);
      if (!it.length) return '';
      var total = it.reduce(function (s, i) { return s + (Number(i.value) || 0); }, 0) || 1, off = 0;
      var arcs = it.map(function (i, n) {
        var frac = (Number(i.value) || 0) / total * 100, s = '<circle cx="21" cy="21" r="15.9" fill="none" stroke="' + CC[n % CC.length] + '" stroke-width="4.5" pathLength="100" stroke-dasharray="' + frac.toFixed(2) + ' ' + (100 - frac).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 21 21)" />';
        off += frac; return s;
      }).join('');
      var ctr = b.center ? '<div class="donut-c"><b>' + esc(str(b.center, 12)) + '</b>' + (b.sub ? '<span>' + esc(str(b.sub, 20)) + '</span>' : '') + '</div>' : '';
      var lg = it.map(function (i, n) { return '<div class="lg-item"><span class="lg-dot" style="background:' + CC[n % CC.length] + '"></span><span class="lg-l">' + esc(str(i.label, 16)) + '</span><b>' + esc(str(i.value, 10)) + '</b></div>'; }).join('');
      return '<div class="chart-donut"><svg viewBox="0 0 42 42">' + arcs + '</svg>' + ctr + '<div class="lg">' + lg + '</div></div>';
    },
    /* histogram: items: [{label, value}] — bars with no gaps */
    hist: function (b) {
      var it = (b.items || []).slice(0, 15);
      if (!it.length) return '';
      var max = Math.max.apply(null, it.map(function (i) { return Number(i.value) || 0; }).concat(1));
      return '<div class="chart-hist">' + it.map(function (i, n) {
        return '<div class="hbar' + (n === it.length - 1 ? ' now' : '') + '"><i style="--p:' + Math.round((Number(i.value) || 0) / max * 100) + '"></i><span>' + esc(str(i.label, 6)) + '</span></div>';
      }).join('') + '</div>';
    },
    /* gauge: value 0-100, label, center */
    gauge: function (b) {
      var v = pct(b.value), filled = (v * 0.75).toFixed(2);
      return '<div class="chart-gauge"><svg viewBox="0 0 42 42"><circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--track)" stroke-width="4" pathLength="100" stroke-dasharray="75 100" transform="rotate(135 21 21)" stroke-linecap="round" /><circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--teal)" stroke-width="4" pathLength="100" stroke-dasharray="' + filled + ' 100" transform="rotate(135 21 21)" stroke-linecap="round" /></svg><div class="gauge-c"><b>' + esc(str(b.center != null ? b.center : Math.round(v), 8)) + '</b>' + (b.label ? '<span>' + esc(str(b.label, 20)) + '</span>' : '') + '</div></div>';
    },
    /* ring: value 0-100, label, center */
    ring: function (b) {
      var v = pct(b.value);
      return '<div class="chart-ring"><svg viewBox="0 0 42 42"><circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--track)" stroke-width="4" pathLength="100" /><circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--teal)" stroke-width="4" pathLength="100" stroke-dasharray="' + v + ' ' + (100 - v) + '" transform="rotate(-90 21 21)" stroke-linecap="round" /></svg><div class="ring-c"><b>' + esc(str(b.center != null ? b.center : Math.round(v), 8)) + '</b>' + (b.label ? '<span>' + esc(str(b.label, 20)) + '</span>' : '') + '</div></div>';
    },
    /* scatter: points: [{x, y, label}] — x and y are 0-100 */
    scatter: function (b) {
      var pts = (b.points || []).slice(0, 30);
      if (!pts.length) return '';
      var W = 200, H = 80, pad = 6;
      var dots = pts.map(function (p) {
        var x = pad + (clamp(Number(p.x), 0, 100) / 100) * (W - pad * 2), y = H - pad - (clamp(Number(p.y), 0, 100) / 100) * (H - pad * 2);
        return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="2.5" fill="var(--teal)" opacity="0.7" />';
      }).join('');
      return '<div class="chart-scatter"><svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none"><line x1="' + pad + '" y1="' + (H - pad) + '" x2="' + (W - pad) + '" y2="' + (H - pad) + '" stroke="var(--edge-strong)" stroke-width="0.5" /><line x1="' + pad + '" y1="' + pad + '" x2="' + pad + '" y2="' + (H - pad) + '" stroke="var(--edge-strong)" stroke-width="0.5" />' + dots + '</svg></div>';
    },
    /* heatmap: items: [{label, value}] — value 0-100, colored by intensity */
    heat: function (b) {
      var it = (b.items || []).slice(0, 49);
      if (!it.length) return '';
      var max = Math.max.apply(null, it.map(function (i) { return Number(i.value) || 0; }).concat(1));
      return '<div class="chart-heat">' + it.map(function (i) {
        var v = (Number(i.value) || 0) / max, op = (0.08 + v * 0.92).toFixed(2);
        return '<div class="hcell" style="background:rgba(20,184,166,' + op + ')" title="' + esc(str(i.label, 20)) + ': ' + esc(str(i.value, 10)) + '"></div>';
      }).join('') + '</div>';
    }
  };
  var HEX = /^#[0-9a-f]{3,8}$/i;
  var DEFAULT_ICON = 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z';

  function registerCustom(spec) {
    if (!spec || typeof spec !== 'object') throw new Error('spec must be a JSON object');
    var id = str(spec.id, 24);
    if (!/^[a-z][a-z0-9-]{1,23}$/.test(id)) throw new Error('id must be 2-24 chars: a-z, 0-9, dash');
    if (BUILTIN.indexOf(id) > -1) throw new Error('"' + id + '" is a built-in widget');
    if (!Array.isArray(spec.blocks) || !spec.blocks.length) throw new Error('blocks must be a non-empty array');
    var bad = spec.blocks.filter(function (b) { return !b || !BLOCK[b.type]; })[0];
    if (bad !== undefined) throw new Error('unknown block type "' + (bad && bad.type) + '" (use ' + Object.keys(BLOCK).join(', ') + ')');
    var ti = typeof spec.title === 'object' && spec.title ? spec.title : { en: spec.title };
    var title = str(ti.en || id, 40);
    I18N.en['w.' + id] = title;
    I18N.ms['w.' + id] = str(ti.ms || title, 40);
    var g = (spec.colors || []).filter(function (c) { return HEX.test(c); });
    var sz = spec.size || [];
    var dw = clamp(Math.round(sz[0]) || 4, 2, 12), dh = clamp(Math.round(sz[1]) || 4, 1, 12);
    var path = /^[MmLlHhVvCcSsQqTtAaZz0-9 ,.\-]+$/.test(spec.icon || '') ? spec.icon : DEFAULT_ICON;
    var defs = $('svg defs'), old = $('#i-c-' + id, defs);
    if (old) old.remove();
    defs.insertAdjacentHTML('beforeend', '<symbol id="i-c-' + id + '" viewBox="0 0 24 24"><path d="' + path + '"/></symbol>');
    var blocks = spec.blocks.slice(0, 40);
    var mn = spec.mini || {};
    var isNew = !MOD[id];
    MOD[id] = {
      id: id, ic: 'i-c-' + id, g: g.length > 1 ? g.slice(0, 2) : ['#7dd3c8', '#2a9d8f'], gi: HEX.test(spec.iconColor) ? spec.iconColor : '', def: [dw, dh], min: [2, 1], custom: 1,
      render: function () { return blocks.map(function (b) { return BLOCK[b.type](b); }).join(''); },
      mini: function () { return mini(mn.big != null ? mn.big : blocks.length, mn.l1 || title, mn.l2); }
    };
    CH[id] = dh;
    if (isNew) TRAY.push(id);
    var all = store.get(CUSTOM_KEY) || {};
    all[id] = spec;
    store.set(CUSTOM_KEY, all);
    return id;
  }
  /* register, show in the tray, and put it on the board (or refresh it if already there) */
  function createWidget(spec) {
    var id = registerCustom(spec);
    buildTiles();
    if (els[id]) { fill(id); updateTray(); pulse(id); } else addWidget(id);
    return id;
  }
  function loadCustom() {
    var all = store.get(CUSTOM_KEY) || {};
    Object.keys(all).concat((D.widgets || []).map(function (s) { return s; })).forEach(function (k) {
      try { registerCustom(typeof k === 'string' ? all[k] : k); } catch (e) { /* a bad saved spec is skipped, not fatal */ }
    });
  }
  function chatCreate(text) {
    var raw = text.replace(/^\/create\s*/i, '').replace(/^```(?:json)?\s*|\s*```$/gi, '').trim();
    if (!raw) return t('chat.create.help');
    /* Only attempt JSON parse if it looks like JSON; natural-language descriptions
       need the bridge server (which is apparently not running right now). */
    if (raw.charAt(0) !== '{' && raw.charAt(0) !== '[') {
      return t('chat.bridge.desc');
    }
    try { return t('chat.create.ok', { w: t('w.' + createWidget(JSON.parse(raw))) }); } catch (e) { return t('chat.create.bad', { e: e.message }); }
  }
  function preset(n) {
    var wide = P[n].map(function (a) { return { id: a[0], x: a[1], y: a[2], w: a[3], h: a[4] }; });
    var y = 0;
    var compact = ORDER[n].map(function (id) { var h = n === 'starter' && (id === 'time' || id === 'rem' || id === 'owe') ? 1 : CH[id]; var o = { id: id, x: 0, y: y, w: 4, h: h }; y += h; return o; });
    return { wide: wide, compact: compact };
  }
  var cur = function () { return S.layout[S.bp]; };
  var overlap = function (a, b) { return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; };
  var minW = function (id) { return S.cols < 8 ? 2 : MOD[id].min[0]; };

  function freeSpot(others, box, cols) {
    var maxY = others.reduce(function (m, o) { return Math.max(m, o.y + o.h); }, 0) + box.h;
    var best = null, bd = 1e9;
    for (var y = 0; y <= maxY; y++) {
      for (var x = 0; x <= cols - box.w; x++) {
        var c = { id: box.id, x: x, y: y, w: box.w, h: box.h };
        if (others.some(function (o) { return overlap(c, o); })) continue;
        var d = (x - box.x) * (x - box.x) + (y - box.y) * (y - box.y);
        if (d < bd) { bd = d; best = c; }
      }
    }
    return best || { id: box.id, x: 0, y: maxY, w: box.w, h: box.h };
  }
  function normalize(list, cols) {
    var out = [];
    list.slice().sort(function (a, b) { return a.y - b.y || a.x - b.x; }).forEach(function (w) {
      var c = { id: w.id, x: w.x, y: w.y, w: clamp(w.w, Math.min(cols < 8 ? 2 : MOD[w.id].min[0], cols), cols), h: Math.max(w.h, MOD[w.id].min[1]) };
      c.x = clamp(c.x, 0, cols - c.w);
      if (out.some(function (o) { return overlap(c, o); })) c = freeSpot(out, c, cols);
      out.push(c);
    });
    return out;
  }

  /* ---------- canvas ---------- */
  var app = $('#app'), grid = $('#grid'), ghost = $('#ghost'), tray = $('#tray'), tilesEl = $('#tiles');
  var els = {};

  function measure() {
    if (!grid.clientWidth) return; /* board is hidden while the Pipeline view is open */
    var W = grid.clientWidth || 360;
    S.bp = W < 560 ? 'compact' : 'wide';
    S.cols = W < 560 ? 4 : W < 760 ? 8 : 12;
    S.cell = W / S.cols;
    grid.style.setProperty('--cell', S.cell + 'px');
  }

  function build(id, index) {
    var m = MOD[id];
    var el = document.createElement('article');
    el.className = 'w fresh'; /* the rise-in runs once; without this the pulse class ending would replay it */
    el.addEventListener('animationend', function (e) { if (e.animationName === 'rise') el.classList.remove('fresh'); });
    el.dataset.id = id;
    el.style.setProperty('--g1', m.g[0]);
    el.style.setProperty('--g2', m.g[1]);
    if (m.gi) el.style.setProperty('--gi', m.gi);
    el.style.setProperty('--i', index || 0);
    el.innerHTML = '<header class="w-head"><span class="w-ic">' + ic(m.ic) + '</span><h2 class="w-title"></h2><span class="w-tools"><span class="w-grip" aria-hidden="true"></span><button type="button" class="w-x">' + ic('i-close') + '</button></span></header><div class="w-body"></div><span class="w-resize" aria-hidden="true"></span>';
    el.tabIndex = S.mode === 'edit' ? 0 : -1;
    grid.appendChild(el);
    els[id] = el;
    fill(id);
    return el;
  }
  function fill(id) {
    var el = els[id];
    if (!el) return;
    var name = t('w.' + id);
    $('.w-title', el).textContent = name;
    $('.w-body', el).innerHTML = '<div class="mini">' + MOD[id].mini() + '</div><div class="full">' + MOD[id].render() + '</div>';
    $('.w-x', el).setAttribute('aria-label', t('w.remove', { w: name }));
    el.setAttribute('aria-label', t('w.move', { w: name }));
  }
  function place(el, w) {
    el.style.setProperty('--x', w.x);
    el.style.setProperty('--y', w.y);
    el.style.setProperty('--w', w.w);
    el.style.setProperty('--h', w.h);
  }

  function render() {
    var list = cur();
    var rows = list.reduce(function (m, w) { return Math.max(m, w.y + w.h); }, 0);
    var minRows = Math.ceil((window.innerHeight - 220) / S.cell);
    grid.style.height = (S.mode === 'edit' ? Math.max(rows + 3, minRows, 5) : Math.max(rows, 1)) * S.cell + 'px';
    list.forEach(function (w, i) { place(els[w.id] || build(w.id, i), w); });
    Object.keys(els).forEach(function (id) {
      if (list.some(function (w) { return w.id === id; })) return;
      var el = els[id];
      delete els[id];
      el.classList.add('leaving');
      setTimeout(function () { el.remove(); }, 200);
    });
    updateTray();
  }
  function commit(list) {
    S.layout[S.bp] = list;
    S.dirty = true;
    S.name = 'custom';
    render();
    updateDock();
  }

  function showGhost(b) {
    ghost.hidden = false;
    ghost.style.setProperty('--x', b.x);
    ghost.style.setProperty('--y', b.y);
    ghost.style.setProperty('--w', b.w);
    ghost.style.setProperty('--h', b.h);
  }
  var hideGhost = function () { ghost.hidden = true; };

  var sv = 0, sraf = 0;
  function edgeScroll(y) {
    var m = 70;
    sv = y < m ? -(m - y) / 4 : y > innerHeight - m ? (y - (innerHeight - m)) / 4 : 0;
    if (sv && !sraf) sraf = requestAnimationFrame(sloop);
  }
  function sloop() { if (!sv) { sraf = 0; return; } scrollBy(0, sv); sraf = requestAnimationFrame(sloop); }

  function watch(move, end) {
    var up = function (e) {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', up);
      sv = 0;
      end(e);
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
  }

  function startMove(e, el) {
    var id = el.dataset.id, list = cur();
    var w = list.filter(function (o) { return o.id === id; })[0];
    var others = list.filter(function (o) { return o.id !== id; });
    var er = el.getBoundingClientRect();
    var off = { x: e.clientX - er.left, y: e.clientY - er.top };
    var target = { id: id, x: w.x, y: w.y, w: w.w, h: w.h };
    el.classList.add('dragging');
    showGhost(target);
    e.preventDefault();
    watch(function (ev) {
      var gr = grid.getBoundingClientRect();
      var left = ev.clientX - off.x - gr.left, top = ev.clientY - off.y - gr.top;
      el.style.left = left + 'px';
      el.style.top = top + 'px';
      target = freeSpot(others, { id: id, x: clamp(Math.round(left / S.cell), 0, S.cols - w.w), y: Math.max(0, Math.round(top / S.cell)), w: w.w, h: w.h }, S.cols);
      showGhost(target);
      edgeScroll(ev.clientY);
    }, function () {
      el.classList.remove('dragging');
      el.style.left = el.style.top = '';
      hideGhost();
      if (target.x !== w.x || target.y !== w.y) { w.x = target.x; w.y = target.y; commit(list); } else render();
    });
  }

  function startResize(e, el) {
    var id = el.dataset.id, list = cur();
    var w = list.filter(function (o) { return o.id === id; })[0];
    var others = list.filter(function (o) { return o.id !== id; });
    var size = { w: w.w, h: w.h };
    el.classList.add('resizing');
    showGhost(w);
    e.preventDefault();
    e.stopPropagation();
    watch(function (ev) {
      var gr = grid.getBoundingClientRect();
      var nw = clamp(Math.round((ev.clientX - gr.left) / S.cell) - w.x, minW(id), S.cols - w.x);
      var nh = Math.max(MOD[id].min[1], Math.round((ev.clientY - gr.top) / S.cell) - w.y);
      var cand = { id: id, x: w.x, y: w.y, w: nw, h: nh };
      if (!others.some(function (o) { return overlap(cand, o); })) size = { w: nw, h: nh };
      el.style.setProperty('--w', size.w);
      el.style.setProperty('--h', size.h);
      showGhost({ x: w.x, y: w.y, w: size.w, h: size.h });
      edgeScroll(ev.clientY);
    }, function () {
      el.classList.remove('resizing');
      hideGhost();
      if (size.w !== w.w || size.h !== w.h) { w.w = size.w; w.h = size.h; commit(list); } else render();
    });
  }

  grid.addEventListener('pointerdown', function (e) {
    if (S.mode !== 'edit' || e.button > 0) return;
    var el = e.target.closest('.w');
    if (!el) return;
    if (e.target.closest('.w-resize')) return startResize(e, el);
    if (e.target.closest('.w-x')) return;
    if (e.target.closest('.w-head')) startMove(e, el);
  });
  grid.addEventListener('click', function (e) {
    var x = e.target.closest('.w-x');
    if (x && S.mode === 'edit') return removeWidget(x.closest('.w').dataset.id);
    var c = e.target.closest('.chk');
    if (c) {
      var id = c.dataset.todo;
      var it = (D.todo || []).filter(function (i) { return i.id === id; })[0];
      S.done[id] = !todoDone(it);
      store.set('kaunter.done', S.done);
      fill('todo');
    }
  });
  grid.addEventListener('keydown', function (e) {
    if (S.mode !== 'edit') return;
    var el = e.target.closest('.w');
    if (!el || e.target !== el) return;
    var list = cur(), id = el.dataset.id;
    var w = list.filter(function (o) { return o.id === id; })[0];
    var others = list.filter(function (o) { return o.id !== id; });
    var k = e.key, dx = 0, dy = 0;
    if (k === 'ArrowLeft') dx = -1; else if (k === 'ArrowRight') dx = 1; else if (k === 'ArrowUp') dy = -1; else if (k === 'ArrowDown') dy = 1;
    else if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); return removeWidget(id); }
    else return;
    e.preventDefault();
    var c = e.shiftKey
      ? { id: id, x: w.x, y: w.y, w: clamp(w.w + dx, minW(id), S.cols - w.x), h: Math.max(MOD[id].min[1], w.h + dy) }
      : { id: id, x: clamp(w.x + dx, 0, S.cols - w.w), y: Math.max(0, w.y + dy), w: w.w, h: w.h };
    if (others.some(function (o) { return overlap(c, o); })) return;
    Object.assign(w, c);
    commit(list);
    els[id] && els[id].focus();
  });

  function removeWidget(id) {
    commit(cur().filter(function (w) { return w.id !== id; }));
    toast(t('toast.removed', { w: t('w.' + id) }));
  }
  function addWidget(id, at) {
    var m = MOD[id], list = cur();
    var spot = freeSpot(list, { id: id, x: at ? at.x : 0, y: at ? at.y : 0, w: Math.min(m.def[0], S.cols), h: hOf(id) }, S.cols);
    list.push(spot);
    commit(list);
    toast(t('toast.added', { w: t('w.' + id) }));
    pulse(id);
  }
  function pulse(id) {
    var el = els[id];
    if (!el) return;
    el.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
    setTimeout(function () { el.classList.remove('pulse'); }, 900);
  }

  /* ---------- tray (glass tiles) ---------- */
  var TRAY = ['cal', 'rem', 'todo', 'sales', 'spend', 'meet', 'owe', 'pack', 'time'];
  var introDone = false, justDragged = false;
  function buildTiles() {
    tilesEl.innerHTML = TRAY.map(function (id, i) {
      var m = MOD[id];
      return '<button type="button" class="tile" data-id="' + id + '" style="--g1:' + m.g[0] + ';--g2:' + m.g[1] + ';--i:' + i + '"><span class="plate"></span><span class="glass"></span><span class="face">' + ic(m.ic) + '</span><span class="tile-on">' + ic('i-check') + '</span><span class="tile-l"></span></button>';
    }).join('');
    labelTiles();
  }
  function labelTiles() { $$('.tile', tilesEl).forEach(function (b) { var n = t('w.' + b.dataset.id); $('.tile-l', b).textContent = n; b.setAttribute('aria-label', n); }); }
  function updateTray() {
    var placed = cur().map(function (w) { return w.id; });
    $$('.tile', tilesEl).forEach(function (b) {
      var on = placed.indexOf(b.dataset.id) > -1;
      b.classList.toggle('placed', on);
      b.setAttribute('aria-disabled', on ? 'true' : 'false');
      b.title = on ? t('tray.on') : '';
    });
    $('#trayCount').textContent = t('tray.count', { n: placed.length, m: TRAY.length });
  }

  tilesEl.addEventListener('pointermove', function (e) {
    var b = e.target.closest('.tile');
    if (!b || e.pointerType === 'touch') return;
    var r = b.getBoundingClientRect();
    b.style.setProperty('--px', clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1));
    b.style.setProperty('--py', clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1));
  });
  tilesEl.addEventListener('pointerleave', function () { $$('.tile', tilesEl).forEach(function (b) { b.style.setProperty('--px', 0); b.style.setProperty('--py', 0); }); }, true);
  tilesEl.addEventListener('click', function (e) {
    var b = e.target.closest('.tile');
    if (!b) return;
    if (justDragged) { justDragged = false; return; }
    var id = b.dataset.id;
    if (b.classList.contains('placed')) { toast(t('toast.exists', { w: t('w.' + id) })); pulse(id); } else addWidget(id);
  });
  tilesEl.addEventListener('pointerdown', function (e) {
    var b = e.target.closest('.tile');
    if (!b || S.mode !== 'edit' || b.classList.contains('placed') || e.button > 0) return;
    var id = b.dataset.id, m = MOD[id];
    var start = { x: e.clientX, y: e.clientY }, touch = e.pointerType === 'touch', dragging = false, chip = null, target = null;
    watch(function (ev) {
      var dx = ev.clientX - start.x, dy = ev.clientY - start.y;
      if (!dragging) {
        var far = Math.hypot(dx, dy) > 6;
        var ok = !(touch && stripMode()) || (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx));
        if (!far || !ok) return;
        dragging = true;
        chip = b.cloneNode(true);
        chip.className = 'chip-drag';
        chip.removeAttribute('aria-label');
        $('.tile-l', chip).remove();
        $('.tile-on', chip).remove();
        document.body.appendChild(chip);
        document.body.classList.add('dragging');
      }
      chip.style.transform = 'translate(' + (ev.clientX - 36) + 'px,' + (ev.clientY - 36) + 'px) scale(1.12)';
      var gr = grid.getBoundingClientRect();
      var inside = ev.clientX > gr.left - 20 && ev.clientX < gr.right + 20 && ev.clientY > gr.top - 20 && ev.clientY < gr.bottom + 60;
      if (!inside) { target = null; hideGhost(); return; }
      var w = Math.min(m.def[0], S.cols), h = hOf(id);
      var left = ev.clientX - gr.left - w * S.cell / 2, top = ev.clientY - gr.top - h * S.cell / 2;
      target = freeSpot(cur(), { id: id, x: clamp(Math.round(left / S.cell), 0, S.cols - w), y: Math.max(0, Math.round(top / S.cell)), w: w, h: h }, S.cols);
      showGhost(target);
      edgeScroll(ev.clientY);
    }, function () {
      if (!dragging) return;
      justDragged = true;
      setTimeout(function () { justDragged = false; }, 60);
      chip.remove();
      document.body.classList.remove('dragging');
      hideGhost();
      if (target) { var l = cur(); l.push(target); commit(l); toast(t('toast.added', { w: t('w.' + id) })); pulse(id); }
    });
  });

  /* ---------- dock (magnifying) ---------- */
  var dock = $('#dock'), dockBtns = [], dockS = [], dockPtr = null, dockRaf = 0;
  var DOCK = [
    { id: 'edit', ic: 'i-edit', label: function () { return S.mode === 'edit' ? 'dock.done' : 'dock.edit'; }, cap: function () { return S.mode === 'edit' ? 'dock.cap.done' : 'dock.cap.edit'; }, pressed: function () { return S.mode === 'edit'; }, act: function () { setMode(S.mode === 'edit' ? 'view' : 'edit'); } },
    { id: 'layouts', ic: 'i-layout', label: function () { return 'dock.layouts'; }, cap: function () { return 'dock.cap.layouts'; }, act: function (b) { togglePop('popLayouts', b); } },
    { id: 'save', ic: 'i-save', label: function () { return S.dirty ? 'dock.unsaved' : 'dock.save'; }, cap: function () { return 'dock.cap.save'; }, badge: function () { return S.dirty; }, act: function () { save(); } },
    { id: 'sync', ic: 'i-sync', label: function () { return 'dock.sync'; }, cap: function () { return 'dock.cap.sync'; }, act: function () { if (okToDiscard()) location.reload(); } },
    { id: 'pipeline', ic: 'i-flow', label: function () { return 'dock.pipeline'; }, cap: function () { return 'dock.cap.pipeline'; }, pressed: function () { return S.view === 'pipeline'; }, act: function () { setView(S.view === 'pipeline' ? 'board' : 'pipeline'); } },
    { sep: true },
    { id: 'settings', ic: 'i-gear', label: function () { return 'dock.settings'; }, cap: function () { return 'dock.cap.settings'; }, act: function (b) { togglePop('popSettings', b); } }
  ];
  function buildDock() {
    dock.innerHTML = '';
    dockBtns = [];
    DOCK.forEach(function (d) {
      if (d.sep) { var s = document.createElement('span'); s.className = 'dock-sep'; s.setAttribute('aria-hidden', 'true'); dock.appendChild(s); return; }
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'dock-item';
      b.dataset.id = d.id;
      b.innerHTML = '<span class="dock-tile">' + ic(d.ic) + '</span><span class="dock-dot"></span><span class="dock-badge"></span><span class="dock-label"></span><span class="dock-cap"></span>';
      b.addEventListener('click', function () {
        b.classList.remove('hop');
        void b.offsetWidth;
        if (!reduce) b.classList.add('hop');
        d.act(b);
      });
      dock.appendChild(b);
      dockBtns.push(b);
    });
    dockS = dockBtns.map(function () { return 1; });
    updateDock();
  }
  function updateDock() {
    dock.setAttribute('aria-label', t('dock.label'));
    DOCK.forEach(function (d) {
      if (d.sep) return;
      var b = $('.dock-item[data-id="' + d.id + '"]', dock);
      var name = t(d.label());
      $('.dock-label', b).textContent = name;
      $('.dock-cap', b).textContent = t(d.cap());
      b.setAttribute('aria-label', name);
      if (d.pressed) b.setAttribute('aria-pressed', d.pressed()); else b.removeAttribute('aria-pressed');
      if (d.badge && d.badge()) b.setAttribute('data-badge', ''); else b.removeAttribute('data-badge');
    });
  }
  function dockTick() {
    var v = !isMobile(), size = dockBtns[0].offsetWidth || 48, peak = 1.5, reach = 120;
    var centers = dockBtns.map(function (b) { var r = b.getBoundingClientRect(); return v ? r.top + r.height / 2 : r.left + r.width / 2; });
    var moving = dockPtr != null;
    var sc = dockBtns.map(function (b, i) {
      var target = 1;
      if (dockPtr != null && !reduce) {
        var d = Math.abs(dockPtr - centers[i]) / reach;
        if (d < 1) target = 1 + (peak - 1) * Math.pow(Math.cos(d * Math.PI / 2), 2);
      }
      var s = dockS[i] + (target - dockS[i]) * 0.28;
      if (Math.abs(target - s) < 0.004) s = target;
      dockS[i] = s;
      return s;
    });
    var extra = sc.map(function (s) { return (s - 1) * size; });
    var total = extra.reduce(function (a, b) { return a + b; }, 0), acc = 0;
    dockBtns.forEach(function (b, i) {
      var shift = acc + extra[i] / 2 - total / 2, cross = (sc[i] - 1) * size / 2;
      acc += extra[i];
      $('.dock-tile', b).style.transform = v ? 'translate(' + cross + 'px,' + shift + 'px) scale(' + sc[i] + ')' : 'translate(' + shift + 'px,' + (-cross) + 'px) scale(' + sc[i] + ')';
      b.style.setProperty('--bump', cross * 2 + 'px');
      if (sc[i] !== 1) moving = true;
    });
    dock.style.setProperty('--grow', total + 'px');
    dockRaf = moving ? requestAnimationFrame(dockTick) : 0;
  }
  dock.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    dockPtr = isMobile() ? e.clientX : e.clientY;
    if (!dockRaf) dockRaf = requestAnimationFrame(dockTick);
  });
  dock.addEventListener('pointerleave', function () { dockPtr = null; if (!dockRaf) dockRaf = requestAnimationFrame(dockTick); });
  dock.addEventListener('keydown', function (e) {
    var i = dockBtns.indexOf(document.activeElement);
    if (i < 0) return;
    var fwd = e.key === 'ArrowDown' || e.key === 'ArrowRight', back = e.key === 'ArrowUp' || e.key === 'ArrowLeft';
    if (!fwd && !back) return;
    e.preventDefault();
    dockBtns[(i + (fwd ? 1 : -1) + dockBtns.length) % dockBtns.length].focus();
  });

  /* ---------- popovers ---------- */
  var popOpen = null, popAnchor = null;
  function closePop(restore) {
    if (!popOpen) return;
    $('#' + popOpen).hidden = true;
    if (popAnchor) { popAnchor.removeAttribute('aria-expanded'); if (restore) popAnchor.focus(); }
    popOpen = popAnchor = null;
  }
  function togglePop(id, btn) {
    if (popOpen === id) return closePop();
    closePop();
    if (id === 'popLayouts') fillLayouts(); else if (id === 'popSettings') syncLang(); else if (id === 'popChat') chatOpen();
    var p = $('#' + id);
    p.hidden = false;
    popOpen = id;
    popAnchor = btn;
    btn.setAttribute('aria-expanded', 'true');
    var r = btn.getBoundingClientRect();
    if (id === 'popChat') { p.style.left = p.style.right = p.style.top = p.style.bottom = ''; }
    else if (isMobile()) { p.style.left = p.style.right = p.style.top = ''; p.style.bottom = innerHeight - r.top + 22 + 'px'; }
    else { var h = p.offsetHeight; p.style.right = 'auto'; p.style.bottom = 'auto'; p.style.left = r.right + 30 + 'px'; p.style.top = clamp(r.top + r.height / 2 - h / 2, 12, innerHeight - h - 12) + 'px'; }
    var first = $('input, button', p);
    if (first) first.focus();
  }
  document.addEventListener('pointerdown', function (e) { if (popOpen && !e.target.closest('.pop') && !e.target.closest('.dock-item') && !e.target.closest('.fab')) closePop(); });
  var bud = function (k) { if (window.Buddy) window.Buddy.react(k); };
  var askBtn = $('#askBtn');
  askBtn.addEventListener('click', function () { togglePop('popChat', askBtn); bud(popOpen === 'popChat' ? 'open' : 'close'); });
  askBtn.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') bud('hover'); });
  askBtn.addEventListener('pointerleave', function () { bud('leave'); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePop(true); });

  function fillLayouts() {
    var items = [['starter', 'layout.starter'], ['shop', 'layout.shop'], ['founder', 'layout.founder']];
    if (store.get('kaunter.layout.v1')) items.push(['saved', 'layout.saved']);
    var p = $('#popLayouts');
    p.setAttribute('aria-label', t('layout.title'));
    p.innerHTML = '<h3>' + esc(t('layout.title')) + '</h3>' + items.map(function (i) {
      return '<button type="button" class="menu-i" role="menuitemradio" aria-checked="' + (S.name === i[0]) + '" data-l="' + i[0] + '"><span class="ck">' + ic('i-check') + '</span>' + esc(t(i[1])) + '</button>';
    }).join('');
  }
  $('#popLayouts').addEventListener('click', function (e) {
    var b = e.target.closest('.menu-i');
    if (!b) return;
    var n = b.dataset.l;
    if (!okToDiscard()) return;
    S.layout = n === 'saved' ? store.get('kaunter.layout.v1') : preset(n);
    S.name = n;
    S.dirty = n !== 'saved';
    measure();
    S.layout[S.bp] = normalize(S.layout[S.bp], S.cols);
    render();
    updateDock();
    closePop(true);
    toast(t('toast.layout', { n: t('layout.' + n) }));
  });

  /* ---------- chat (WorkBuddy bridge) ----------
     The chat sends messages to the local bridge server (POST /api/chat).
     For /create <description>: the bridge generates a widget JSON spec and we call Kaunter.create(spec).
     For /create <JSON>: the bridge validates and returns the spec.
     For regular chat: the bridge returns a helpful response.
     If the server is not running, we fall back to local /create JSON parsing. */
  var chatLog = $('#chatLog'), chatIn = $('#chatIn'), chatHist = [];
  function chatAdd(who, text, isTyping) {
    if (!isTyping) chatHist.push([who, text]);
    var m = document.createElement('div');
    m.className = 'msg ' + who + (isTyping ? ' typing' : '');
    if (isTyping) { m.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>'; }
    else { m.textContent = text; }
    chatLog.appendChild(m);
    chatLog.scrollTop = chatLog.scrollHeight;
    return m;
  }
  function chatOpen() { if (!chatHist.length) chatAdd('bot', t('chat.hello')); }

  /* "Thinking..." line (port of React Bits ThoughtLine, no React/Tailwind): breathing sparkle, shimmering label, live timer, a step trace.
     step(text) appends a step (the last one is current, earlier ones tick); settle() freezes the clock into "Thought for 2.3s" and folds the trace. */
  var fmtDs = function (ds) { return ds < 600 ? (ds / 10).toFixed(1) + 's' : Math.floor(ds / 600) + 'm ' + ((ds % 600) / 10).toFixed(1) + 's'; };
  function thinking() {
    var m = document.createElement('div'), t0 = Date.now(), steps = [], done = false;
    m.className = 'msg bot think';
    m.dataset.working = '';
    m.dataset.open = '';
    m.innerHTML = '<button type="button" class="tl-head" aria-expanded="true"><span class="tl-glyph" aria-hidden="true">' + ic('i-spark') + '</span>' +
      '<span class="tl-stack"><span class="tl-work"><span class="tl-sheen">' + esc(t('chat.thinking')) + '</span> <span class="tl-t">0.0s</span></span><span class="tl-done"></span></span>' +
      '<span class="tl-chev" aria-hidden="true">' + ic('i-down') + '</span></button><div class="tl-trace"><div><ul class="tl-steps"></ul></div></div>';
    var head = $('.tl-head', m), clock = $('.tl-t', m), list = $('.tl-steps', m);
    var tick = setInterval(function () { clock.textContent = fmtDs(Math.floor((Date.now() - t0) / 100)); }, 100);
    head.addEventListener('click', function () {
      if (!steps.length) return;
      var on = m.hasAttribute('data-open');
      if (on) m.removeAttribute('data-open'); else m.dataset.open = '';
      head.setAttribute('aria-expanded', !on);
    });
    chatLog.appendChild(m);
    chatLog.scrollTop = chatLog.scrollHeight;
    return {
      step: function (text) {
        if (done) return;
        steps.push(text);
        m.dataset.has = '';
        list.insertAdjacentHTML('beforeend', '<li><span class="tl-mark">' + ic('i-check') + '<i></i></span><span>' + esc(text) + '</span></li>');
        $$('li', list).forEach(function (li, i, a) { if (i < a.length - 1) li.setAttribute('data-done', ''); });
        chatLog.scrollTop = chatLog.scrollHeight;
      },
      settle: function () {
        if (done) return;
        done = true;
        clearInterval(tick);
        $('.tl-done', m).textContent = t('chat.thought', { t: fmtDs(Math.floor((Date.now() - t0) / 100)) });
        m.removeAttribute('data-working');
        m.removeAttribute('data-open');
        head.setAttribute('aria-expanded', 'false');
        $$('li', list).forEach(function (li) { li.setAttribute('data-done', ''); });
      }
    };
  }

  function chatSend(text) {
    var th = thinking();
    th.step(t('chat.think.read'));
    th.step(t('chat.think.ask'));
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text })
    }).then(function(r) { return r.json(); }).then(function(res) {
      th.settle();
      if (res.type === 'widget' && res.spec) {
        try {
          var id = window.Kaunter.create(res.spec);
          chatAdd('bot', res.message || t('chat.create.ok', { w: t('w.' + id) }));
        } catch (e) {
          chatAdd('bot', t('chat.create.bad', { e: e.message }));
        }
      } else if (res.type === 'error') {
        chatAdd('bot', res.message);
      } else {
        chatAdd('bot', res.message || String(res));
      }
      if (window.Buddy) window.Buddy.react('reply');
    }).catch(function() {
      th.settle();
      /* Fallback: if bridge is not running, handle /create locally (raw JSON only) */
      if (/^\/create(\s|$)/i.test(text)) {
        var reply = chatCreate(text);
        chatAdd('bot', reply);
        /* If the reply is a bridge-needed message, don't double-up with another bridge hint */
        if (reply.indexOf('bridge server') === -1 && reply.indexOf('Could not create') > -1) {
          chatAdd('bot', t('chat.bridge.down'));
        }
      } else {
        chatAdd('bot', t('chat.bridge.down'));
      }
      if (window.Buddy) window.Buddy.react('reply');
    });
  }

  $('#chatForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var text = chatIn.value.trim();
    if (!text) return;
    chatIn.value = '';
    chatAdd('me', text.length > 60 ? text.slice(0, 57) + '…' : text);
    if (window.Buddy) window.Buddy.react('send');
    chatSend(text);
  });

  function syncLang() { $$('[data-lang]').forEach(function (b) { b.setAttribute('aria-checked', b.dataset.lang === lang); }); }
  $('#popSettings').addEventListener('click', function (e) {
    var b = e.target.closest('[data-lang]');
    if (b) return setLang(b.dataset.lang);
    if (e.target.closest('#resetBtn')) {
      if (!okToDiscard()) return;
      S.layout = preset('starter');
      S.name = 'starter';
      S.dirty = true;
      measure();
      S.layout[S.bp] = normalize(S.layout[S.bp], S.cols);
      render();
      updateDock();
      closePop(true);
      toast(t('toast.reset'));
    }
  });

  /* ---------- mode, save, language, toast ---------- */
  var toastT = 0;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }
  function renderBar() {
    var now = new Date(), name = (D.owner && D.owner.name) || '';
    $('#hello').textContent = name ? t('greet.back', { name: name }) : t('greet.back0');
    $('#avatar').innerHTML = name ? esc(name.charAt(0).toUpperCase()) : ic('i-user');
    $('#avatar').setAttribute('aria-label', name || t('avatar.label'));
    $('#today').textContent = new Intl.DateTimeFormat(loc(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now);
    var ts = new Intl.DateTimeFormat(loc(), { hour: 'numeric', minute: '2-digit' }).format(new Date(D.generatedAt || now));
    $('#fresh').textContent = t('bar.updated', { t: ts }) + (D.demo ? ' · ' + t('bar.demo') : '');
    var mc = $('#modeChip');
    mc.innerHTML = ic(S.mode === 'edit' ? 'i-check' : 'i-edit') + esc(t(S.mode === 'edit' ? 'dock.done' : 'dock.edit'));
    mc.setAttribute('aria-pressed', S.mode === 'edit');
    if (S.mode === 'edit') mc.setAttribute('data-edit', ''); else mc.removeAttribute('data-edit');
  }
  function applyI18n() {
    $$('[data-i18n]').forEach(function (e) { e.textContent = t(e.dataset.i18n); });
    $$('[data-i18n-attr]').forEach(function (e) { e.dataset.i18nAttr.split(',').forEach(function (s) { var p = s.split(':'); e.setAttribute(p[0], t(p[1])); }); });
    document.documentElement.lang = lang;
  }
  function setLang(l) {
    lang = l;
    store.set('kaunter.lang', l);
    applyI18n();
    renderBar();
    Object.keys(els).forEach(fill);
    labelTiles();
    updateTray();
    updateDock();
    syncLang();
    toast(t('toast.lang'));
  }
  function setMode(m) {
    S.mode = m;
    app.dataset.mode = m;
    var prev = S.bp + S.cols;
    measure();
    if (S.bp + S.cols !== prev) S.layout[S.bp] = normalize(S.layout[S.bp], S.cols);
    tray.inert = m !== 'edit';
    if (m === 'edit' && !introDone && !reduce) {
      introDone = true;
      tray.classList.add('intro');
      setTimeout(function () { tray.classList.remove('intro'); }, 1600);
    }
    $$('.w').forEach(function (e) { e.tabIndex = m === 'edit' ? 0 : -1; });
    closePop();
    renderBar();
    render();
    updateDock();
    if (m === 'view' && S.dirty) toast(t('toast.unsaved'));
  }
  /* Pipeline view: same page, the dock toggles it in place of the dotted canvas (pipeline.js draws it) */
  function setView(v) {
    S.view = v;
    app.dataset.view = v;
    $('#canvas').hidden = v === 'pipeline';
    $('#plView').hidden = v !== 'pipeline';
    closePop();
    if (v === 'pipeline') window.KaunterPipeline.show(); else { measure(); render(); }
    updateDock();
    scrollTo(0, 0);
  }
  $('#plBack').addEventListener('click', function () { setView('board'); });
  function okToDiscard() { return !S.dirty || confirm(t('confirm.discard')); }
  function save() {
    store.set('kaunter.layout.v1', S.layout);
    S.dirty = false;
    S.name = 'saved';
    updateDock();
    toast(t('toast.saved'));
  }

  /* WorkBuddy (or a demo) can call Kaunter.refresh() after it rewrites window.KAUNTER_DATA; pass a widget id to pulse it. */
  window.Kaunter = {
    refresh: function (pulseId) { loadCustom(); Object.keys(els).forEach(fill); renderBar(); if (pulseId) pulse(pulseId); },
    create: createWidget /* Kaunter.create(spec): same as chat "/create"; WorkBuddy can call it directly */
  };

  /* ---------- boot ---------- */
  function init() {
    loadCustom();
    S.layout = store.get('kaunter.layout.v1');
    if (S.layout && S.layout.wide && S.layout.compact) {
      S.name = 'saved';
      ['wide', 'compact'].forEach(function (k) { S.layout[k] = S.layout[k].filter(function (w) { return MOD[w.id]; }); }); /* drop widgets whose spec is gone */
    } else { S.layout = preset('starter'); S.name = 'starter'; }
    measure();
    S.layout[S.bp] = normalize(S.layout[S.bp], S.cols);
    applyI18n();
    renderBar();
    buildTiles();
    buildDock();
    tray.inert = true;
    render();
    $('#modeChip').addEventListener('click', function () { setMode(S.mode === 'edit' ? 'view' : 'edit'); });
    var lastKey = S.bp + S.cols;
    addEventListener('resize', function () {
      measure();
      if (S.bp + S.cols !== lastKey) { lastKey = S.bp + S.cols; S.layout[S.bp] = normalize(S.layout[S.bp], S.cols); }
      if (S.view === 'board') render();
      closePop();
    });
    setInterval(function () { if (els.time) fill('time'); renderBar(); }, 15000);
  }
  init();
})();
