/* Kaunter Bridge: a local server that connects the Kaunter chat UI to a dynamic widget-generation agent.
   Serves the frontend and handles POST /api/chat.
   For /create <description>: dynamically detects chart type + topic, generates varied demo data,
   and returns a widget JSON spec using the kaunter-create vocabulary.
   For /create <JSON>: passes through the raw spec.
   For regular chat: responds with helpful context about Kaunter.

   Usage: node bridge.js  (serves on http://localhost:3120)
*/
var http = require('http');
var fs = require('fs');
var path = require('path');

var PORT = process.env.PORT || 3120;
var ROOT = __dirname;
var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

/* ---------- design tokens (from kaunter-create skill) ---------- */
var PAL = {
  teal:  ['#99f6e4', '#14b8a6'], tealD: ['#5eead4', '#0d9488'],
  tealM: ['#7dd3c8', '#2a9d8f'], gray:  ['#cbd5e1', '#64748b'],
  blue:  ['#a9b6c6', '#5b6b7f'], dark:  ['#475569', '#1f2937'],
  light: ['#e2e8f0', '#94a3b8']
};
var IC = {
  water: 'M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z',
  money: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9.5 8h5M9.5 12h5',
  chart: 'M5 20v-7M12 20V5M19 20v-10',
  list:  'M10 6h10M10 12h10M10 18h10M3.5 6l1.2 1.2L7 4.8M3.5 12l1.2 1.2L7 10.8M3.5 18l1.2 1.2L7 16.8',
  bell:  'M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0',
  cal:   'M4 5h16v15H4zM4 10h16M8 3v4M16 3v4',
  people:'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c.7-3 3.2-4.5 6-4.5s5.3 1.5 6 4.5',
  box:   'M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4zM3.5 7.5 12 11.5l8.5-4M12 11.5v9',
  arrow: 'M4 8h14l-3.2-3.2M20 16H6l3.2 3.2',
  bolt:  'M13 3L4 14h7l-2 7 9-11h-7z',
  star:  'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  fire:  'M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z',
  clock: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z'
};
var DARK_INK = '#04201c';
var SLATE_INK = '#0f172a';

/* ---------- pseudo-random with seed (varied output per call) ---------- */
function rnd(a, b) { return a + Math.random() * (b - a); }
function rint(a, b) { return Math.floor(rnd(a, b + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/* ---------- chart type detection ---------- */
var CHART_DETECT = [
  { type: 'hist',     keys: ['histogram', 'hist ', 'frequency', 'distribution'] },
  { type: 'line',     keys: ['line', 'trend', 'time series', 'timeseries', 'curve'] },
  { type: 'pie',      keys: ['pie', 'slice', 'proportion', 'breakdown'] },
  { type: 'donut',    keys: ['donut', 'doughnut'] },
  { type: 'gauge',    keys: ['gauge', 'speedometer', 'dial'] },
  { type: 'ring',     keys: ['ring', 'circular progress'] },
  { type: 'scatter',  keys: ['scatter', 'correlation', 'dot plot'] },
  { type: 'heat',     keys: ['heatmap', 'heat map', 'activity map'] },
  { type: 'bars',     keys: ['bar chart', 'bar graph', 'column chart', ' barchart'] },
  { type: 'meter',    keys: ['meter', 'progress bar', 'progress'] }
];

function detectChartType(desc) {
  for (var i = 0; i < CHART_DETECT.length; i++) {
    var cd = CHART_DETECT[i];
    for (var j = 0; j < cd.keys.length; j++) {
      if (desc.indexOf(cd.keys[j]) > -1) return cd.type;
    }
  }
  return null; /* no chart type keyword found */
}

/* ---------- topic detection ---------- */
var TOPICS = {
  sales:    { keys: ['sale', 'revenue', 'income', 'jualan', 'jual'], icon: IC.chart,  colors: PAL.teal,  ink: DARK_INK },
  water:    { keys: ['water', 'hydration', 'drink', 'minum', 'air'], icon: IC.water, colors: PAL.teal,  ink: DARK_INK },
  expense:  { keys: ['expense', 'spend', 'cost', 'belanja', 'bayar'], icon: IC.money, colors: PAL.gray,  ink: SLATE_INK },
  task:     { keys: ['task', 'todo', 'to-do', 'tugas', 'senarai'],   icon: IC.list,  colors: PAL.tealD, ink: DARK_INK },
  meeting:  { keys: ['meeting', 'mesyuarat', 'decision', 'keputusan'], icon: IC.people, colors: PAL.blue, ink: SLATE_INK },
  reminder: { keys: ['reminder', 'peringat', 'alert', 'alarm'],       icon: IC.bell,  colors: PAL.light, ink: SLATE_INK },
  debt:     { keys: ['owe', 'debt', 'hutang', 'loan', 'pinjam'],     icon: IC.arrow, colors: PAL.light, ink: SLATE_INK },
  schedule: { keys: ['calendar', 'schedule', 'event', 'jadual'],     icon: IC.cal,   colors: PAL.tealM, ink: DARK_INK },
  inventory:{ keys: ['inventory', 'stok', 'stock', 'barang'],        icon: IC.box,   colors: PAL.blue,  ink: SLATE_INK },
  goals:    { keys: ['goal', 'target', 'matlamat', 'objective'],     icon: IC.star,  colors: PAL.tealD, ink: DARK_INK },
  mood:     { keys: ['mood', 'feeling', 'perasaan', 'wellness'],      icon: IC.heart, colors: PAL.teal,  ink: DARK_INK },
  energy:   { keys: ['energy', 'stamina', 'fuel', 'tenaga'],          icon: IC.bolt,  colors: PAL.teal,  ink: DARK_INK },
  customers:{ keys: ['customer', 'pelanggan', 'client', 'buyer'],     icon: IC.people, colors: PAL.teal,  ink: DARK_INK },
  time:     { keys: ['time', 'masa', 'hour', 'clock'],               icon: IC.clock, colors: PAL.tealM, ink: DARK_INK }
};

function detectTopic(desc) {
  for (var k in TOPICS) {
    var t = TOPICS[k];
    for (var j = 0; j < t.keys.length; j++) {
      if (desc.indexOf(t.keys[j]) > -1) return k;
    }
  }
  return null;
}

/* ---------- topic data generators ---------- */
var WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

var DATA = {
  sales: function() {
    return {
      title: 'Sales', items: WEEKDAYS.map(function(d) { return { label: d, value: rint(600, 2200) }; }),
      sum: 'RM ' + rint(900, 1800), sumLabel: 'today', groupLabel: 'This week',
      slices: [
        { label: 'Nasi lemak', value: rint(300, 800) },
        { label: 'Catering', value: rint(400, 1200) },
        { label: 'Drinks', value: rint(100, 400) },
        { label: 'Snacks', value: rint(50, 300) }
      ],
      value: rint(40, 95), valueLabel: 'of monthly target'
    };
  },
  water: function() {
    var drunk = rint(4, 9);
    return {
      title: 'Water', items: WEEKDAYS.map(function(d) { return { label: d, value: rint(3, 10) }; }),
      sum: drunk + '/8', sumLabel: 'glasses today', value: Math.round(drunk / 8 * 100), valueLabel: 'hydration',
      slices: [{ label: 'Morning', value: rint(1, 4) }, { label: 'Afternoon', value: rint(1, 4) }, { label: 'Evening', value: rint(0, 3) }]
    };
  },
  expense: function() {
    return {
      title: 'Expenses', items: MONTHS.map(function(m) { return { label: m, value: rint(400, 1500) }; }),
      sum: 'RM ' + rint(500, 900), sumLabel: 'this month',
      slices: [
        { label: 'Stock', value: rint(200, 500) }, { label: 'Utilities', value: rint(100, 400) },
        { label: 'Supplies', value: rint(30, 150) }, { label: 'Transport', value: rint(15, 100) }
      ],
      value: rint(30, 80), valueLabel: 'of budget'
    };
  },
  task: function() {
    var n = rint(2, 6);
    return {
      title: 'Tasks', items: WEEKDAYS.map(function(d) { return { label: d, value: rint(1, 8) }; }),
      sum: n + ' open', sumLabel: rint(0, 2) + ' overdue', value: Math.round(n / 8 * 100), valueLabel: 'completion'
    };
  },
  meeting: function() {
    return {
      title: 'Meeting', items: MONTHS.map(function(m) { return { label: m, value: rint(1, 6) }; }),
      sum: rint(2, 6) + ' actions', sumLabel: 'from last meeting',
      slices: [{ label: 'Done', value: rint(1, 4) }, { label: 'Open', value: rint(1, 4) }, { label: 'Blocked', value: rint(0, 2) }],
      value: rint(40, 90), valueLabel: 'action completion'
    };
  },
  reminder: function() {
    var n = rint(2, 6);
    return {
      title: 'Reminders', items: WEEKDAYS.map(function(d) { return { label: d, value: rint(0, 3) }; }),
      sum: n + ' upcoming', sumLabel: 'this week', value: Math.round(n / 8 * 100), valueLabel: ' reminders'
    };
  },
  debt: function() {
    var toMe = rint(500, 2500), iOwe = rint(400, 2000);
    return {
      title: 'Money Owed', items: [
        { label: 'Wk1', value: toMe }, { label: 'Wk2', value: iOwe }, { label: 'Wk3', value: rint(200, 800) }, { label: 'Wk4', value: rint(100, 600) }
      ],
      sum: 'RM ' + toMe, sumLabel: 'owed to you',
      slices: [{ label: 'To you', value: toMe }, { label: 'You owe', value: iOwe }],
      value: Math.round(toMe / (toMe + iOwe) * 100), valueLabel: 'net positive'
    };
  },
  schedule: function() {
    var n = rint(2, 7);
    return {
      title: 'Schedule', items: WEEKDAYS.map(function(d) { return { label: d, value: rint(0, 4) }; }),
      sum: n + ' events', sumLabel: 'this week', value: Math.round(n / 10 * 100), valueLabel: 'booked'
    };
  },
  inventory: function() {
    return {
      title: 'Inventory', items: [
        { label: 'Flour', value: rint(1, 20) }, { label: 'Oil', value: rint(2, 15) },
        { label: 'Rice', value: rint(5, 30) }, { label: 'Sugar', value: rint(3, 25) },
        { label: 'Eggs', value: rint(10, 50) }, { label: 'Spice', value: rint(2, 12) }
      ],
      sum: rint(2, 6) + ' low', sumLabel: 'need reorder',
      slices: [{ label: 'OK', value: rint(5, 15) }, { label: 'Low', value: rint(2, 6) }, { label: 'Out', value: rint(0, 2) }],
      value: rint(40, 85), valueLabel: 'stock health'
    };
  },
  goals: function() {
    var hit = rint(1, 4), total = rint(3, 5);
    return {
      title: 'Goals', items: MONTHS.map(function(m) { return { label: m, value: rint(30, 95) }; }),
      sum: hit + '/' + total, sumLabel: 'on track', value: Math.round(hit / total * 100), valueLabel: 'goal completion',
      slices: [{ label: 'On track', value: hit }, { label: 'Behind', value: total - hit }]
    };
  },
  mood: function() {
    var days = WEEKDAYS.map(function(d) { return { label: d, value: rint(40, 95) }; });
    var avg = Math.round(days.reduce(function(s, d) { return s + d.value; }, 0) / days.length);
    return {
      title: 'Mood', items: days, sum: pick(['Great', 'Good', 'Okay', 'Fair']), sumLabel: 'mood today',
      slices: [{ label: 'Happy', value: rint(2, 6) }, { label: 'Neutral', value: rint(1, 4) }, { label: 'Stressed', value: rint(0, 2) }],
      value: avg, valueLabel: 'wellness score'
    };
  },
  energy: function() {
    var v = rint(50, 95);
    return {
      title: 'Energy', items: WEEKDAYS.map(function(d) { return { label: d, value: rint(40, 100) }; }),
      sum: v + '%', sumLabel: 'energy level', value: v, valueLabel: 'stamina'
    };
  },
  customers: function() {
    return {
      title: 'Customers', items: WEEKDAYS.map(function(d) { return { label: d, value: rint(5, 40) }; }),
      sum: rint(10, 30) + '', sumLabel: 'today', 
      slices: [{ label: 'New', value: rint(3, 12) }, { label: 'Returning', value: rint(8, 25) }, { label: 'Catering', value: rint(1, 6) }],
      value: rint(30, 80), valueLabel: 'of weekly target'
    };
  },
  time: function() {
    return {
      title: 'Time', items: ['6am', '9am', '12pm', '3pm', '6pm', '9pm'].map(function(l) { return { label: l, value: rint(1, 8) }; }),
      sum: rint(4, 10) + 'h', sumLabel: 'tracked today', value: rint(40, 85), valueLabel: 'productive time'
    };
  }
};

function generateTopicData(topic) {
  var gen = DATA[topic];
  if (gen) return gen();
  /* default: generic numeric data */
  return {
    title: 'Widget', items: WEEKDAYS.map(function(d) { return { label: d, value: rint(10, 100) }; }),
    sum: rint(50, 90) + '', sumLabel: 'summary', value: rint(30, 80), valueLabel: 'metric'
  };
}

/* ---------- widget builder ---------- */
function cleanDesc(desc) {
  /* Strip conversational prefixes so titles read cleanly.
     Apply repeatedly to handle layered phrases like "please give me a ..." */
  var d = desc;
  var prev;
  do {
    prev = d;
    d = d.replace(/^(please\s+|kindly\s+|can you\s+|could you\s+)/i, '');
    d = d.replace(/^(i\s+(want|need|would like|wish)\s+(to\s+)?(see|have|get|view)?\s*)/i, '');
    d = d.replace(/^(give|make|create|show|build|generate|draw|plot|display|add)\s+(me\s+)?/i, '');
    d = d.replace(/^(a|an|the)\s+/i, '');
    d = d.trim();
  } while (d !== prev);
  return d || desc.trim();
}

function buildWidget(desc) {
  var chartType = detectChartType(desc);
  var topic = detectTopic(desc);
  var data = generateTopicData(topic);
  var topicInfo = topic ? TOPICS[topic] : { icon: IC.star, colors: PAL.teal, ink: DARK_INK };
  
  /* Generate unique-ish id from topic + chart type + random suffix */
  var idParts = [topic || 'widget'];
  if (chartType && chartType !== 'bars') idParts.push(chartType);
  var id = idParts.join('-').replace(/[^a-z0-9-]/g, '');
  /* Ensure 2-24 chars, starts with letter */
  if (id.length < 2) id = 'widget';
  if (id.length > 24) id = id.slice(0, 24);
  if (!/^[a-z]/.test(id)) id = 'w-' + id;
  
  /* Build title from cleaned description */
  var clean = cleanDesc(desc);
  var titleText = clean.length > 40 ? clean.charAt(0).toUpperCase() + clean.slice(1, 37) + '...' : clean.charAt(0).toUpperCase() + clean.slice(1);
  
  /* Build blocks based on chart type (or default to a mix) */
  var blocks = [];
  var size = [4, 4];
  
  if (chartType === 'hist') {
    blocks.push({ type: 'sum', bold: data.sum, text: data.sumLabel });
    blocks.push({ type: 'hist', items: data.items });
    size = [4, 4];
  } else if (chartType === 'line') {
    blocks.push({ type: 'sum', bold: data.sum, text: data.sumLabel });
    blocks.push({ type: 'line', items: data.items });
    size = [4, 4];
  } else if (chartType === 'pie') {
    blocks.push({ type: 'sum', bold: data.sum, text: data.sumLabel });
    blocks.push({ type: 'pie', slices: data.slices });
    size = [4, 4];
  } else if (chartType === 'donut') {
    blocks.push({ type: 'donut', slices: data.slices, center: data.sum, sub: data.sumLabel });
    size = [4, 3];
  } else if (chartType === 'gauge') {
    blocks.push({ type: 'gauge', value: data.value, center: data.sum + (typeof data.sum === 'string' && data.sum.indexOf('%') > -1 ? '' : '%'), label: data.valueLabel });
    size = [4, 3];
  } else if (chartType === 'ring') {
    blocks.push({ type: 'ring', value: data.value, center: data.sum, label: data.valueLabel });
    size = [4, 3];
  } else if (chartType === 'scatter') {
    blocks.push({ type: 'sum', bold: data.sum, text: data.sumLabel });
    var pts = data.items.map(function(i) { return { x: rint(5, 95), y: i.value, label: i.label }; });
    blocks.push({ type: 'scatter', points: pts });
    size = [4, 4];
  } else if (chartType === 'heat') {
    blocks.push({ type: 'sum', bold: data.sum, text: data.sumLabel });
    var cells = [];
    for (var i = 0; i < 21; i++) cells.push({ label: 'D' + (i + 1), value: rint(0, 100) });
    blocks.push({ type: 'heat', items: cells });
    size = [4, 4];
  } else if (chartType === 'bars') {
    blocks.push({ type: 'sum', bold: data.sum, text: data.sumLabel });
    blocks.push({ type: 'bars', items: data.items });
    size = [4, 4];
  } else if (chartType === 'meter') {
    blocks.push({ type: 'sum', bold: data.sum, text: data.sumLabel });
    blocks.push({ type: 'meter', value: data.value, label: data.valueLabel });
    blocks.push({ type: 'row', title: data.items[0].label, sub: 'Demo', value: String(data.items[0].value) });
    blocks.push({ type: 'row', title: data.items[1].label, sub: 'Demo', value: String(data.items[1].value) });
    size = [4, 4];
  } else {
    /* No chart type specified — build a rich mixed widget */
    blocks.push({ type: 'sum', bold: data.sum, text: data.sumLabel });
    if (data.slices && Math.random() > 0.5) {
      blocks.push({ type: 'pie', slices: data.slices });
    } else if (data.items && Math.random() > 0.5) {
      blocks.push({ type: 'bars', items: data.items });
    } else {
      blocks.push({ type: 'meter', value: data.value, label: data.valueLabel });
    }
    if (data.items) {
      data.items.slice(0, 3).forEach(function(it) {
        blocks.push({ type: 'row', title: String(it.label), sub: 'Demo data', value: String(it.value) });
      });
    }
    size = [4, 4];
  }
  
  return {
    id: id,
    title: { en: titleText, ms: titleText },
    icon: topicInfo.icon,
    colors: topicInfo.colors,
    iconColor: topicInfo.ink,
    size: size,
    mini: { big: String(data.sum).slice(0, 12), l1: data.sumLabel.slice(0, 20), l2: titleText.slice(0, 20) },
    blocks: blocks
  };
}

/* ---------- chat response generator ---------- */
function chatResponse(text) {
  var l = text.toLowerCase();
  if (l.indexOf('help') > -1 || l.indexOf('what') > -1 || l.indexOf('how') > -1) {
    return 'Kaunter is a draggable widget board. Type /create followed by a description. You can specify a chart type and topic:\n\nChart types: histogram, line, pie, donut, gauge, ring, scatter, heatmap, bar\n\nExamples:\n  /create histogram of sales\n  /create a line chart of expenses\n  /create pie chart of spending\n  /create a gauge for energy\n  /create a water tracker\n  /create scatter plot of customers';
  }
  if (l.indexOf('edit') > -1) {
    return 'Tap the Edit button in the dock (left side) to enter edit mode. Then you can drag widgets from the tray onto the canvas, move them around, and resize them. Press Done when finished, then Save.';
  }
  if (l.indexOf('chart') > -1 || l.indexOf('graph') > -1 || l.indexOf('visual') > -1) {
    return 'I can generate many chart types: histogram, line, pie, donut, gauge, ring, scatter, heatmap, and bar. Just type /create followed by the chart type and topic. Examples: /create histogram of daily sales, /create a line chart for water intake, /create pie chart of expenses.';
  }
  return 'I can create widgets with different chart types. Try: /create histogram of sales, /create line chart of expenses, /create pie chart of spending, /create a gauge for mood, /create a water tracker, /create scatter plot of customers.';
}

/* ---------- HTTP server ---------- */
function serveFile(req, res) {
  var url = req.url === '/' ? '/index.html' : req.url;
  url = url.split('?')[0];
  if (url.indexOf('..') > -1) { res.writeHead(403); res.end('Forbidden'); return; }
  var fp = path.join(ROOT, url);
  var ext = path.extname(fp);
  fs.readFile(fp, function(err, data) {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found: ' + url); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function handleChat(req, res) {
  var body = '';
  req.on('data', function(chunk) { body += chunk; });
  req.on('end', function() {
    try {
      var data = JSON.parse(body);
      var text = (data.text || '').trim();
      if (!text) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'No text provided' })); return; }

      var createMatch = text.match(/^\/create\s*(.*)$/i);
      if (createMatch) {
        var after = createMatch[1].replace(/^```(?:json)?\s*|\s*```$/gi, '').trim();

        /* Raw JSON spec — pass through */
        if (after.charAt(0) === '{') {
          try {
            var spec = JSON.parse(after);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ type: 'widget', spec: spec, message: 'Widget created from your JSON spec.' }));
            return;
          } catch (e) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ type: 'error', message: 'Invalid JSON: ' + e.message + '. Try a description instead, e.g. /create histogram of sales.' }));
            return;
          }
        }

        /* Bare /create — help */
        if (!after) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ type: 'text', message: 'Type /create followed by a chart type and topic.\n\nChart types: histogram, line, pie, donut, gauge, ring, scatter, heatmap, bar\n\nExamples:\n  /create histogram of sales\n  /create line chart of expenses\n  /create pie chart of spending\n  /create a gauge for energy\n  /create a water tracker' }));
          return;
        }

        /* Description — dynamically generate widget */
        var widget = buildWidget(after.toLowerCase());
        if (widget) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            type: 'widget',
            spec: widget,
            message: 'Created "' + widget.title.en + '" widget with ' + (widget.blocks[0].type === 'gauge' || widget.blocks[0].type === 'ring' || widget.blocks[0].type === 'donut' ? widget.blocks[0].type : (widget.blocks[1] ? widget.blocks[1].type : 'mixed')) + ' visualization. It is on your board. Save the layout to keep its position.'
          }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ type: 'error', message: 'Could not generate a widget from "' + after + '". Try: /create histogram of sales, /create line chart of water, /create pie chart of expenses.' }));
        }
        return;
      }

      /* Regular chat */
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ type: 'text', message: chatResponse(text) }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
  });
}

var server = http.createServer(function(req, res) {
  if (req.method === 'POST' && req.url.indexOf('/api/chat') === 0) return handleChat(req, res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end(); return;
  }
  serveFile(req, res);
});

server.listen(PORT, function() {
  console.log('Kaunter bridge running at http://localhost:' + PORT);
  console.log('');
  console.log('Chart types available:');
  console.log('  histogram  line  pie  donut  gauge  ring  scatter  heatmap  bar  meter');
  console.log('');
  console.log('Examples:');
  console.log('  /create histogram of sales');
  console.log('  /create a line chart of expenses');
  console.log('  /create pie chart of spending');
  console.log('  /create a gauge for mood');
  console.log('  /create scatter plot of customers');
  console.log('  /create a water tracker');
});
