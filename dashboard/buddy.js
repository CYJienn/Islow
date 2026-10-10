/* Kaunter pixel buddy: a tiny WorkBuddy-style robot cat that lives in a fixed strip at the bottom right.
   Decorative only (aria-hidden, no pointer events). Plain canvas, no libraries. app.js calls Buddy.react(kind). */
(function () {
  'use strict';

  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PAL = { o: '#10162e', w: '#f4f7ff', s: '#b9c4dd', k: '#0a0f24', h: '#8794b4', e: '#3ee6b0', p: '#ff7aa8', b: '#ff9ecb', x: '#10162e' };

  /* 16x16 body: cat ears, white shell, black visor, headphones. Eyes, arms and feet are drawn on top per pose. */
  var BASE = [
    '..oo........oo..',
    '.owwo......owwo.',
    '.owwoooooooowwo.',
    '.owwwwwwwwwwwwo.',
    'hhowkkkkkkkkwohh',
    'hhokkkkkkkkkkohh',
    'hhokkkkkkkkkkohh',
    'hhokkkkkkkkkkohh',
    'hhokkkkkkkkkkohh',
    '.owwwwwwwwwwwwo.',
    '..oowwwwwwwwoo..',
    '..owwwwwwwwwwo..',
    '..owwwwsswwwwo..',
    '..oswwwwwwwwso..',
    '...oooooooooo...',
    '................'
  ];
  var EYES = { /* left eye; the right one is mirrored */
    open: [[4, 5], [5, 5], [4, 6], [5, 6], [4, 7], [5, 7]],
    blink: [[4, 6], [5, 6]],
    happy: [[3, 7], [4, 6], [5, 6], [6, 7]],
    love: [[4, 5], [6, 5], [4, 6], [5, 6], [6, 6], [5, 7]]
  };
  var WAVE = [
    [[14, 12, 'h'], [15, 11, 'h'], [15, 10, 'h'], [15, 9, 'w'], [15, 8, 'w']],
    [[14, 12, 'h'], [14, 11, 'h'], [14, 10, 'h'], [14, 9, 'w'], [14, 8, 'w']]
  ];
  var FLY = [['.bb.bb.', 'bbbxbbb', '.bbxbb.', '..b.b..'], ['..b.b..', '..bxb..', '..bxb..', '..b.b..']];

  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  function paint(cv, rows) {
    var c = cv.getContext('2d');
    c.clearRect(0, 0, cv.width, cv.height);
    rows.forEach(function (r, y) {
      for (var x = 0; x < r.length; x++) if (r[x] !== '.') { c.fillStyle = PAL[r[x]]; c.fillRect(x, y, 1, 1); }
    });
  }
  function body(p) {
    var g = BASE.map(function (r) { return r.split(''); });
    var set = function (x, y, c) { g[y][x] = c; };
    var color = p.eyes === 'love' ? 'p' : 'e';
    var shift = p.eyes === 'open' || p.eyes === 'blink' ? p.look : 0;
    EYES[p.eyes].forEach(function (q) { set(q[0] + shift, q[1], color); set(15 - q[0] - shift, q[1], color); });
    [11, 12, 13].forEach(function (y) { set(1, y, 'h'); });
    if (p.arm === 'rest') [11, 12, 13].forEach(function (y) { set(14, y, 'h'); });
    else WAVE[p.arm === 'A' ? 0 : 1].forEach(function (q) { set(q[0], q[1], q[2]); });
    (p.feet === 'step' ? [2, 3, 4, 11, 12, 13] : [3, 4, 5, 10, 11, 12]).forEach(function (x) { set(x, 15, 'h'); });
    return g.map(function (r) { return r.join(''); });
  }

  var stage = document.createElement('div');
  stage.className = 'buddy-stage';
  stage.setAttribute('aria-hidden', 'true');
  var cv = document.createElement('canvas'); cv.className = 'bd'; cv.width = cv.height = 16;
  var bf = document.createElement('canvas'); bf.className = 'bf'; bf.width = 7; bf.height = 4;
  stage.appendChild(cv);
  stage.appendChild(bf);
  (document.getElementById('app') || document.body).appendChild(stage);

  var SZ = 64, W = 300, H = 96;
  var p = { eyes: 'open', look: 0, arm: 'rest', feet: 'stand' }, key = '';
  var x = 0, jump = 0, vj = 0;
  var bx = 0, by = 0, bt = { x: 0, y: 0 }, bon = false, bfk = -1;
  var act = null, hovering = false, now = 0, last = 0, nextBlink = 2500, blinkUntil = 0;

  function measure() { W = stage.clientWidth || 300; H = stage.clientHeight || 96; x = clamp(x, 0, Math.max(0, W - SZ)); }
  function draw() {
    var k = [p.eyes, p.look, p.arm, p.feet].join();
    if (k !== key) { key = k; paint(cv, body(p)); }
    cv.style.transform = 'translate(' + Math.round(x / 4) * 4 + 'px,' + Math.round((H - SZ - jump) / 4) * 4 + 'px)';
    if (bon) {
      var f = Math.floor(now / 130) % 2;
      if (f !== bfk) { bfk = f; paint(bf, FLY[f]); }
      bf.style.transform = 'translate(' + Math.round(bx / 4) * 4 + 'px,' + Math.round(by / 4) * 4 + 'px)';
    }
    bf.style.display = bon ? 'block' : 'none';
  }

  function walkTo(tx, dt, sp) {
    var d = tx - x;
    if (Math.abs(d) < 1.5) return true;
    var dir = d > 0 ? 1 : -1;
    x += dir * Math.min(Math.abs(d), sp * dt);
    p.look = dir;
    p.feet = Math.floor(now / 160) % 2 ? 'step' : 'stand';
    return false;
  }
  var mk = function (a) { a.t0 = now; return a; };
  function go(a) { act = mk(a); if (a.n !== 'chase') bon = false; }
  function pick() {
    if (hovering) return mk({ n: 'watch' });
    var r = Math.random();
    if (r < 0.2) return mk({ n: 'wave', d: 1800 });
    if (r < 0.4) return mk({ n: 'hop', left: 1 + (Math.random() * 2 | 0) });
    if (r < 0.65) return mk({ n: 'chase', d: rnd(5000, 8000) });
    if (r < 0.85) return mk({ n: 'walk', x: rnd(0, Math.max(0, W - SZ)) });
    return mk({ n: 'idle', d: rnd(1500, 3200) });
  }

  function update(dt) {
    if (!act) act = pick();
    var a = act, el = now - a.t0, done = false;
    p.eyes = 'open'; p.arm = 'rest'; p.look = 0; p.feet = 'stand';
    if (a.n === 'idle') done = el > a.d;
    else if (a.n === 'walk') done = walkTo(a.x, dt, 46) || el > 7000;
    else if (a.n === 'wave') { p.arm = Math.floor(el / 220) % 2 ? 'B' : 'A'; p.eyes = 'happy'; done = el > a.d; }
    else if (a.n === 'hop') {
      p.eyes = a.love ? 'love' : 'happy';
      if (!jump && !vj) { if (a.left-- <= 0) done = true; else vj = 260; }
    } else if (a.n === 'watch') { /* face the chat button and wave until the pointer leaves */
      var there = walkTo(W - SZ, dt, 90);
      if (there) { p.look = 1; p.arm = Math.floor(el / 220) % 2 ? 'B' : 'A'; p.eyes = 'happy'; }
      done = !hovering && there;
    } else if (a.n === 'chase') {
      if (!a.init) { a.init = 1; bon = true; bx = rnd(0, W - 28); by = 4; a.next = 0; }
      if (!a.caught) {
        if (now > a.next) { bt = { x: rnd(0, W - 28), y: rnd(0, 42) }; a.next = now + rnd(700, 1400); }
        bx += (bt.x - bx) * Math.min(1, 3 * dt);
        by += (bt.y - by) * Math.min(1, 3 * dt);
        walkTo(clamp(bx - 18, 0, W - SZ), dt, 80);
        if (Math.abs(bx - 18 - x) < 14 && !jump && !vj && Math.random() < 2 * dt) vj = 260;
        if (el > a.d) a.caught = now;
      } else {
        p.eyes = 'love';
        if (now - a.caught < 1500) {
          bx += (x + SZ / 2 - 14 - bx) * Math.min(1, 6 * dt);
          by += (H - SZ - jump - 14 - by) * Math.min(1, 6 * dt);
        } else { by -= 140 * dt; if (by < -20) { bon = false; done = true; } }
      }
    }
    if (jump > 0 || vj > 0) { jump += vj * dt; vj -= 900 * dt; if (jump <= 0) jump = vj = 0; }
    if (now > nextBlink) { blinkUntil = now + 130; nextBlink = now + rnd(2500, 5000); }
    if (now < blinkUntil && p.eyes === 'open') p.eyes = 'blink';
    if (done) act = pick();
  }
  function tick(ts) {
    var dt = Math.min(0.05, (ts - last) / 1000);
    last = now = ts;
    if (stage.offsetWidth) { update(dt); draw(); }
    requestAnimationFrame(tick);
  }

  var Buddy = {
    react: function (k) {
      if (reduce) {
        if (k === 'open' || k === 'send') { p.eyes = 'love'; } else if (k === 'reply') { p.eyes = 'happy'; } else return;
        draw();
        setTimeout(function () { p.eyes = 'open'; draw(); }, 1600);
        return;
      }
      if (k === 'hover') { hovering = true; go({ n: 'watch' }); }
      else if (k === 'leave') hovering = false;
      else if (k === 'open') go({ n: 'hop', left: 2, love: 1 });
      else if (k === 'send') go({ n: 'hop', left: 1 });
      else if (k === 'reply' || k === 'close') go({ n: 'wave', d: 1600 });
    },
    /* play('chase' | 'wave' | 'hop' | 'walk'): start a behaviour on demand (used by demos) */
    play: function (n) {
      if (reduce) return;
      var d = { chase: { n: 'chase', d: 6000 }, wave: { n: 'wave', d: 2000 }, hop: { n: 'hop', left: 3 }, walk: { n: 'walk', x: rnd(0, Math.max(0, W - SZ)) } }[n];
      if (d) go(d);
    }
  };
  window.Buddy = Buddy;

  measure();
  addEventListener('resize', measure);
  x = reduce ? Math.max(0, W - SZ) : 0;
  if (reduce) { draw(); } else { go({ n: 'wave', d: 1800 }); requestAnimationFrame(tick); }
})();
