/* CUT A "Monday, survived": hectic story ad. 60 s, 120 bpm (1 beat = 0.5 s).
   0-9 chaos, 9-13 logo, 13-19 reveal, 19-30 drag & drop, 30-35 shrink, 35-43 ask AI, 43-47 buddy, 47-51 Bahasa, 51-55 devices, 55-60 outro */
(async () => {
  resetStorage('en');
  const G = (a, b) => `linear-gradient(135deg, ${a}, ${b})`;
  const bg = (t0, t1, css) => { const s = scene(t0, t1, '', bgl); E('div', 'bg', '', s).style.background = css; E('div', 'dots', '', s); return s; };

  /* ---------- scenes' backgrounds (first, so they sit under the app) ---------- */
  bg(0, 9, 'radial-gradient(1100px 700px at 78% 10%, #4a2410 0%, transparent 62%), radial-gradient(900px 600px at 10% 100%, #0b3196 0%, transparent 60%), #061744');
  const chaos = scene(0, 9);
  bg(9, 13, 'radial-gradient(900px 700px at 50% 55%, #0c6b57 0%, transparent 65%), #061744');
  bg(13, 51, 'radial-gradient(1300px 760px at 8% -12%, #0b3196 0%, transparent 62%), #061744');
  bg(51, 55, 'radial-gradient(1000px 700px at 50% 120%, #0c6b57 0%, transparent 65%), radial-gradient(1000px 700px at 90% -10%, #0b3196 0%, transparent 60%), #061744');
  bg(55, 60, 'radial-gradient(1000px 800px at 50% 50%, #0c6b57 0%, transparent 65%), #061744');

  /* ---------- the real dashboard ---------- */
  const app = new App({ x: 96, y: 54, s: 1.2 });
  await app.load();
  const L = await scout(async (a) => {
    const R = (s) => a.rect(s), o = { dock: { edit: R('.dock-item[data-id=edit]'), save: R('.dock-item[data-id=save]'), set: R('.dock-item[data-id=settings]') }, fab: R('#askBtn'), chip: R('#modeChip') };
    o.rect = {}; ['time', 'rem', 'owe', 'todo', 'sales', 'cal', 'meet', 'spend'].forEach((id) => { o.rect[id] = R(`.w[data-id=${id}]`); });
    a.q('#modeChip').click(); a.settle();
    o.grid = R('#grid');
    o.cell = o.grid.w / 12;
    o.tile = { pack: R('.tile[data-id=pack]'), spend: R('.tile[data-id=spend]') };
    o.x = R('.w[data-id=spend] .w-x');
    o.rs = { todo: R('.w[data-id=todo] .w-resize'), cal: R('.w[data-id=cal] .w-resize'), sales: R('.w[data-id=sales] .w-resize') };
    return o;
  }, { x: 96, y: 54, s: 1.2 });
  const L2 = await scout(async (a) => {
    a.q('.dock-item[data-id=settings]').click(); a.settle();
    return { ms: a.rect('[data-lang=ms]'), en: a.rect('[data-lang=en]') };
  });
  const L3 = await scout(async (a) => {
    a.q('#askBtn').click(); a.settle();
    return { input: a.rect('#chatIn'), send: a.rect('.send'), pop: a.rect('#popChat') };
  });
  const sp = (r) => app.st(r.cx, r.cy);
  const cur = mkCursor();
  const cell = L.cell, gx = (col) => L.grid.x + col * cell, gy = (row) => L.grid.y + row * cell;

  /* ======== 0 - 9  CHAOS ======== */
  const CARDS = [
    { c: 'bubble', t: 'bang, invois mana??', s: 'WhatsApp · 9:02' },
    { i: ['#6fd8ff', '#1b8fe0'], t: 'Supplier call 15:30', s: 'Reminder' },
    { c: 'paper', t: 'RM 312.40', s: 'Pasar borong · receipt' },
    { c: 'warn', t: 'Overdue 3 days', s: 'Pelanggan katering owes RM 1,850' },
    { c: 'bubble', t: 'stok dah habis!!', s: 'WhatsApp · 9:07' },
    { i: ['#b69aff', '#6a46e0'], t: 'Meeting notes??', s: 'Where did I save that?' },
    { c: 'paper', t: 'TNB RM 286.10', s: 'Bill · due soon' },
    { i: ['#4fe0b8', '#009273'], t: 'Bayar sewa kedai', s: 'To-do · overdue' },
    { c: 'bubble', t: 'boss, resit Grab lupa hantar', s: 'WhatsApp' },
    { i: ['#97a8ff', '#4152d8'], t: 'Accountant needs receipts', s: 'Email · 3 unread' },
    { c: 'warn', t: 'SST filing due Friday', s: 'Reminder' },
    { c: 'paper', t: 'Grab RM 23.00', s: 'photo of a receipt' }
  ];
  const N = 46;
  for (let i = 0; i < N; i++) {
    const c = CARDS[i % CARDS.length];
    const el = E('div', 'card ' + (c.c || ''), (c.i ? `<i style="--g1:${c.i[0]};--g2:${c.i[1]}"></i>` : '') + `<div><b>${c.t}</b><span>${c.s}</span></div>`, chaos);
    const ts = 0.3 + 6.9 * Math.pow(i / N, 1.7), side = i % 4;
    const ex = rr(-20, 1560), ey = rr(40, 940);
    const sx = side === 0 ? -460 : side === 1 ? 1980 : ex, sy = side === 2 ? -220 : side === 3 ? 1120 : ey;
    const r0 = rr(-50, 50), r1 = rr(-14, 14);
    A(el, [{ opacity: 1, translate: `${sx}px ${sy}px`, rotate: `${r0}deg`, scale: 0.7 }, { opacity: 1, translate: `${ex}px ${ey}px`, rotate: `${r1}deg`, scale: 1 }], ts, 0.38, { ease: BACK });
    A(el, [{ opacity: 1, translate: `${ex}px ${ey}px`, rotate: `${r1}deg`, scale: 1 }, { opacity: 1, translate: '780px 490px', rotate: `${r1 + rr(200, 500)}deg`, scale: 0.06, offset: 0.9 }, { opacity: 0, translate: '780px 490px', rotate: `${r1 + 560}deg`, scale: 0.02 }], 7.5 + i * 0.008, 0.7, { ease: IN });
    if (i % 3 === 0) sfx(ts + 0.2, 'pop');
  }
  shake(0.3, 7.5, 1, 20);
  const cnt = E('div', 'cnt', '<span>3</span><small>UNREAD</small>', hud);
  A(cnt, [{ opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1 }], 0.3, 0.3, { ease: BACK });
  A(cnt, [{ opacity: 1 }, { opacity: 0 }], 7.5, 0.2, { ease: IN });
  during(0.3, 7.4, (p) => { cnt.firstChild.textContent = Math.round(3 * Math.pow(333, p)); });
  [['Monday.', 0.2, 1.45, 260], ['47 *WhatsApps.', 1.5, 2.95, 200], ['12 !receipts.', 3.0, 4.2, 210], ['3 meetings.', 4.25, 5.2, 230], ['Zero idea', 5.25, 6.2, 210], ['what is !due.', 6.25, 7.45, 230]].forEach(([txt, a, b, size]) => {
    words(txt.replace(/ (?=\w)/g, ' ').replace('what is', 'what’s'), 960, 520, { size, slam: true, t0: a, t1: b, stag: 0.12, dur: 0.35, w: 1800 });
    sfx(a, 'whoosh2');
  });

  /* ======== 7.5 - 9  RECORD SCRATCH ======== */
  words('What if it just *handled it?', 960, 520, { size: 134, t0: 7.95, t1: 8.9, stag: 0.1, w: 1700 });

  /* ======== 9 - 13  LOGO SLAM ======== */
  const logoS = scene(9, 13);
  flash(9.0, 0.5);
  burst(9.05, 960, 540, 70, 950);
  burst(9.5, 960, 560, 40, 700);
  shake(9.0, 9.5, 26, 0);
  const mark = E('div', 'logo', LOGO(200), logoS);
  mark.style.cssText += ';left:470px;top:330px;opacity:0';
  A(mark, [{ opacity: 0, scale: 0.1, rotate: '-200deg' }, { opacity: 1, scale: 1, rotate: '0deg' }], 9.0, 0.65, { ease: BACK });
  A(mark, [{ opacity: 1, scale: 1 }, { opacity: 0, scale: 1.3 }], 12.8, 0.2, { ease: IN });
  words('Kaunter', 1110, 430, { size: 210, letters: true, stag: 0.05, t0: 9.15, t1: 12.8, dur: 0.45 });
  words('The dashboard that runs your *day.', 960, 640, { size: 84, t0: 10.4, t1: 12.8, stag: 0.07, w: 1700 });
  const bd = buddyCanvas(220, 'happy');
  bd.style.cssText += ';left:1480px;top:790px';
  A(bd, [{ opacity: 1, translate: '0 320px' }, { opacity: 1, translate: '0 0' }], 10.9, 0.55, { ease: BACK });
  A(bd, [{ opacity: 1, translate: '0 0' }, { opacity: 1, translate: '0 320px' }], 12.6, 0.3, { ease: IN });
  sfx(10.9, 'pop');
  beatPulse(9, 55);

  /* ======== 13 - 19  REVEAL ======== */
  zoom(12.9, 0.1, 960, 540, 0.8);
  app.in(13.0);
  app.replay(13.15);
  flash(13.0, 0.4, '#0052d9');
  words('Your whole business. *One screen.', 960, 88, { size: 92, t0: 13.35, t1: 16.3, stag: 0.05, w: 1800 });
  const tagList = [['time', 'Time'], ['rem', 'Reminders'], ['owe', 'Money owed'], ['todo', 'To-do'], ['sales', 'Sales'], ['cal', 'Calendar'], ['meet', 'Meetings'], ['spend', 'Spending']];
  tagList.forEach(([id, label], k) => {
    const r = L.rect[id], [px, py] = app.view(r.x + 18, r.y + 8);
    tag(label, px, py - 20, 14.0 + k * 0.17, 16.2, (k % 2 ? 3 : -3));
  });
  words('WorkBuddy reads the mess. *Kaunter *shows *the *answer.', 960, 88, { size: 70, t0: 16.45, t1: 18.7, stag: 0.05, w: 1800 });
  zoom(13.2, 5.6, 960, 540, 0.86, LIN);

  /* ======== 19 - 30  DRAG & DROP ======== */
  zoom(18.9, 0.7, 960, 540, 1);
  cursorPath(cur, [[18.0, 1200, 1250], [19.0, 1000, 800], [19.9, ...sp(L.dock.edit)]]);
  const edit = sp(L.dock.edit);
  app.click(20.0, L.dock.edit.cx, L.dock.edit.cy);
  clickFx(cur, 20.0, edit[0], edit[1]);
  flash(20.05, 0.3, '#28b894');
  pill('Edit mode', 960, 1000, 20.0, 21.0, { size: 44 });
  /* remove the Spending widget */
  const xs = sp(L.x);
  cursorPath(cur, [[20.0, edit[0], edit[1]], [21.0, xs[0], xs[1]]]);
  app.click(21.15, L.x.cx, L.x.cy);
  clickFx(cur, 21.15, xs[0], xs[1]);
  pill('Remove.', 960, 1000, 21.15, 22.0, { size: 48 });
  /* drag its tile back to a new spot */
  const t1 = sp(L.tile.spend), d1 = app.st(gx(8) + 2 * cell, gy(6) + 1.5 * cell);
  cursorPath(cur, [[21.15, xs[0], xs[1]], [22.2, t1[0], t1[1]], [23.6, d1[0], d1[1], IO]]);
  app.drag(22.3, 23.6, [L.tile.spend.cx, L.tile.spend.cy], [gx(8) + 2 * cell, gy(6) + 1.5 * cell]);
  zoom(22.1, 1.2, (t1[0] + d1[0]) / 2, (t1[1] + d1[1]) / 2, 1.35);
  pill('Drag.', 960, 1000, 22.3, 23.4, { size: 56, g: true });
  pill('Drop.', 960, 1000, 23.6, 24.5, { size: 56, g: true });
  burst(23.7, d1[0], d1[1], 24, 420);
  /* second tile */
  const t2 = sp(L.tile.pack), d2 = app.st(gx(0) + 2 * cell, gy(5) + 1.5 * cell);
  cursorPath(cur, [[23.6, d1[0], d1[1]], [24.5, t2[0], t2[1]], [26.0, d2[0], d2[1], IO]]);
  app.drag(24.6, 26.0, [L.tile.pack.cx, L.tile.pack.cy], [gx(0) + 2 * cell, gy(5) + 1.5 * cell]);
  zoom(24.4, 1.4, (t2[0] + d2[0]) / 2, (t2[1] + d2[1]) / 2, 1.35);
  pill('Again.', 960, 1000, 24.6, 25.6, { size: 56, g: true });
  burst(26.1, d2[0], d2[1], 24, 420);
  zoom(26.4, 0.8, 960, 540, 1);
  words('Your layout. *Your *rules.', 960, 540, { size: 150, slam: true, t0: 27.0, t1: 29.7, stag: 0.14, w: 1800 });
  sfx(27.0, 'hit');

  /* ======== 30 - 35  SHRINK ======== */
  const rs = (id) => sp(L.rs[id]);
  const rt = rs('todo'), rc = rs('cal'), rsl = rs('sales');
  const tgt = (id, col, row) => ({ lx: gx(col), ly: gy(row) });
  const T1 = tgt('todo', 2, 3), T2 = tgt('cal', 10, 2), T3 = tgt('sales', 7, 2);
  zoom(29.8, 0.6, 960, 540, 1.1);
  cursorPath(cur, [[29.7, 960, 600], [30.4, rt[0], rt[1]], [31.3, ...app.st(T1.lx, T1.ly), IO], [31.5, ...app.st(T1.lx, T1.ly)], [32.0, rc[0], rc[1]], [32.8, ...app.st(T2.lx, T2.ly), IO], [33.0, ...app.st(T2.lx, T2.ly)], [33.3, rsl[0], rsl[1]], [34.0, ...app.st(T3.lx, T3.ly), IO]]);
  app.drag(30.5, 31.3, [L.rs.todo.cx, L.rs.todo.cy], [T1.lx, T1.ly]);
  app.drag(32.1, 32.8, [L.rs.cal.cx, L.rs.cal.cy], [T2.lx, T2.ly]);
  app.drag(33.35, 34.0, [L.rs.sales.cx, L.rs.sales.cy], [T3.lx, T3.ly]);
  pill('Tiny when you need tiny.', 960, 1000, 30.4, 34.2, { size: 52 });
  sfx(31.3, 'pop'); sfx(32.8, 'pop'); sfx(34.0, 'pop');
  /* save + back to view */
  const sv = sp(L.dock.save);
  cursorPath(cur, [[34.0, ...app.st(T3.lx, T3.ly)], [34.6, sv[0], sv[1]], [35.1, edit[0], edit[1]]]);
  app.click(34.65, L.dock.save.cx, L.dock.save.cy);
  clickFx(cur, 34.65, sv[0], sv[1]);
  app.click(35.15, L.dock.edit.cx, L.dock.edit.cy);
  clickFx(cur, 35.15, edit[0], edit[1]);
  zoom(35.0, 0.8, 960, 540, 1);
  burst(35.2, 960, 540, 50, 900);
  words('Big. Small. *Yours.', 960, 540, { size: 190, slam: true, t0: 35.6, t1: 37.4, stag: 0.18, w: 1800 });
  sfx(35.6, 'hit');

  /* ======== 37 - 43  ASK AI ======== */
  const fab = sp(L.fab), inp = sp(L3.input);
  app.fakeReply('Done! I will remind you at 2:00 pm and added it to your calendar.');
  const FZ = [fab[0] - 120, fab[1] - 120];
  zoom(37.2, 0.9, FZ[0], FZ[1], 1.55);
  cursorPath(cur, [[35.2, edit[0], edit[1]], [36.2, 1100, 700], [37.6, fab[0], fab[1]]]);
  app.click(37.7, L.fab.cx, L.fab.cy);
  clickFx(cur, 37.7, fab[0], fab[1]);
  pill('Just ask.', 960, 1000, 37.7, 43.0, { size: 64, g: true });
  app.type(38.4, 40.2, '#chatIn', 'remind me to call the supplier at 2pm');
  app.submit(40.45, '#chatForm');
  app.release(41.6);
  app.data((d) => {
    d.reminders.push({ id: 'r9', text: 'Call the supplier', date: '2026-10-10', time: '14:00', src: 'chat' });
    d.events.push({ id: 'e9', title: 'Call the supplier', date: '2026-10-10', time: '14:00', src: 'chat' });
  }, 'rem', 41.8);
  app.call(42.1, (a) => a.w.Kaunter.refresh('time'));
  zoom(41.9, 0.9, 960, 540, 1);
  burst(41.8, 960, 300, 40, 800);
  sfx(41.7, 'ding');
  app.call(43.0, (a) => a.q('#askBtn').click());

  /* ======== 43 - 47  BUDDY ======== */
  const BZ = app.st(L.fab.cx - 260, L.fab.cy);
  zoom(43.0, 0.7, BZ[0], BZ[1], 2.6);
  app.call(43.2, (a) => a.w.Buddy.play('chase'));
  words('Meet *Buddy.', 700, 230, { size: 150, slam: true, t0: 43.3, t1: 46.8, stag: 0.18, w: 1300 });
  pill('Waves. Chases butterflies. Cheers you on.', 960, 960, 44.2, 46.8, { size: 46 });
  app.call(45.6, (a) => a.q('#askBtn').dispatchEvent(new a.w.PointerEvent('pointerenter', { pointerType: 'mouse', bubbles: true })));
  app.call(46.6, (a) => a.q('#askBtn').dispatchEvent(new a.w.PointerEvent('pointerleave', { pointerType: 'mouse', bubbles: true })));
  zoom(46.7, 0.5, 960, 540, 1);

  /* ======== 47 - 51  BAHASA ======== */
  const gear = sp(L.dock.set), ms = sp(L2.ms), en = sp(L2.en);
  cursorPath(cur, [[46.2, fab[0], fab[1]], [47.1, gear[0], gear[1]], [48.2, ms[0], ms[1]], [49.6, en[0], en[1]], [50.4, gear[0], gear[1]]]);
  app.click(47.2, L.dock.set.cx, L.dock.set.cy);
  clickFx(cur, 47.2, gear[0], gear[1]);
  app.click(48.25, L2.ms.cx, L2.ms.cy);
  clickFx(cur, 48.25, ms[0], ms[1]);
  pill('Cakap Melayu? *Boleh!', 960, 1000, 48.25, 49.55, { size: 60 });
  app.click(49.65, L2.en.cx, L2.en.cy);
  clickFx(cur, 49.65, en[0], en[1]);
  pill('English? Also boleh.', 960, 1000, 49.65, 50.7, { size: 60 });
  app.click(50.45, L.dock.set.cx, L.dock.set.cy);
  sfx(48.25, 'pop'); sfx(49.65, 'pop');

  /* ======== 51 - 55  ANY DEVICE ======== */
  app.out(50.9);
  const lap = new App({ x: 70, y: 340, s: 0.84, vw: 1280, vh: 720, kind: 'laptop', r: 18 });
  const tab = new App({ x: 1190, y: 290, s: 0.5, vw: 820, vh: 1180, kind: 'tablet', r: 30 });
  const pho = new App({ x: 1650, y: 330, s: 0.62, vw: 390, vh: 844, kind: 'phone', r: 64 });
  await Promise.all([lap.load(), tab.load(), pho.load()]);
  [[pho, 51.0], [tab, 51.35], [lap, 51.7]].forEach(([a, t]) => { a.in(t, { scale: 0.5, translate: '0 400px', rotate: '8deg' }, 0.6); a.replay(t + 0.1); });
  A(cur, [{ opacity: 1 }, { opacity: 0 }], 50.8, 0.2, { ease: IN });
  words('Phone. Tablet. *That *old *laptop.', 960, 150, { size: 100, t0: 51.1, t1: 54.8, stag: 0.1, w: 1800 });
  [['Laptop', 70 + 1280 * 0.84 / 2, 960], ['Tablet', 1190 + 410, 920], ['Phone', 1650 + 121, 900]].forEach(([n, x, y], k) => {
    const d = E('div', 'devname', n, hud);
    d.style.left = x + 'px'; d.style.top = y + 'px';
    A(d, [{ opacity: 0, translate: '0 20px' }, { opacity: 1, translate: '0 0' }], 52.2 + k * 0.15, 0.35, { ease: BACK });
    A(d, [{ opacity: 1 }, { opacity: 0 }], 54.8, 0.15, { ease: IN });
  });
  burst(51.4, 960, 700, 40, 900);

  /* ======== 55 - 60  OUTRO ======== */
  flash(55.0, 0.6);
  lap.out(54.85); tab.out(54.85); pho.out(54.85);
  burst(55.05, 960, 420, 80, 1000);
  const mk2 = E('div', 'logo', LOGO(170), scene(55, 60));
  mk2.style.cssText += ';left:560px;top:260px;opacity:0';
  A(mk2, [{ opacity: 0, scale: 0.1, rotate: '-200deg' }, { opacity: 1, scale: 1, rotate: '0deg' }], 55.0, 0.6, { ease: BACK });
  words('Kaunter', 1120, 345, { size: 180, letters: true, stag: 0.05, t0: 55.15, dur: 0.45 });
  words('Your business, *in *one *glance.', 960, 590, { size: 118, t0: 56.0, stag: 0.08, w: 1800 });
  words('Built for Malaysian SMEs · Powered by WorkBuddy', 960, 790, { size: 48, t0: 57.0, stag: 0.04, w: 1800 });
  const bl = buddyCanvas(230, 'love');
  bl.style.cssText += ';left:1500px;top:800px';
  A(bl, [{ opacity: 1, translate: '0 340px' }, { opacity: 1, translate: '0 0' }], 56.4, 0.55, { ease: BACK });
  sfx(56.4, 'pop');
  burst(57.0, 1600, 850, 30, 500);
  const fade = E('div', '', '', hud);
  fade.style.cssText = 'position:absolute;inset:0;background:#020b24;opacity:0';
  A(fade, [{ opacity: 0 }, { opacity: 1 }], 59.4, 0.6, { ease: LIN });

  window.APP = app; /* handy for PROBE=... debugging in render.mjs */
  finish();
})();
