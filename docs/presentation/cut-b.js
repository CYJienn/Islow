/* CUT B "Nine things, one screen": feature-tour ad in the spirit of a phone launch film. 60 s, 120 bpm (beat = 0.5 s).
   0-3.5 numbers, 3.5-6 logo, 6-28.5 nine spotlights, 28.5-36.5 customise, 36.5-44.5 ask AI, 44.5-48.5 Bahasa, 48.5-53.5 devices, 53.5-60 outro */
(async () => {
  resetStorage('en');
  const WIDE = [['time', 0, 0, 4, 2], ['rem', 4, 0, 4, 3], ['owe', 8, 0, 4, 4], ['todo', 0, 2, 4, 5], ['sales', 4, 3, 4, 4], ['cal', 8, 4, 4, 5], ['meet', 0, 7, 4, 4], ['spend', 4, 7, 4, 4], ['pack', 8, 9, 4, 3]].map((a) => ({ id: a[0], x: a[1], y: a[2], w: a[3], h: a[4] }));
  const CH = { time: 2, rem: 4, owe: 5, todo: 5, sales: 4, cal: 7, meet: 6, spend: 5, pack: 4 };
  let yy = 0;
  const COMPACT = WIDE.map((w) => { const o = { id: w.id, x: 0, y: yy, w: 4, h: CH[w.id] }; yy += CH[w.id]; return o; });
  try { localStorage.setItem('kaunter.layout.v1', JSON.stringify({ wide: WIDE, compact: COMPACT })); } catch (e) { /* ignore */ }

  const bg = (t0, t1, css) => { const s = scene(t0, t1, '', bgl); E('div', 'bg', '', s).style.background = css; E('div', 'dots', '', s); return s; };
  bg(0, 3.5, 'radial-gradient(1000px 800px at 85% 15%, #0c6b57 0%, transparent 62%), radial-gradient(900px 700px at 5% 100%, #0b3196 0%, transparent 60%), #061744');
  bg(3.5, 6, 'radial-gradient(900px 700px at 50% 55%, #0c6b57 0%, transparent 65%), #061744');
  bg(6, 53.5, 'radial-gradient(1200px 800px at 85% 20%, #0b3196 0%, transparent 62%), radial-gradient(900px 700px at 0% 100%, #08305e 0%, transparent 60%), #061744');
  bg(53.5, 60, 'radial-gradient(1000px 800px at 50% 50%, #0c6b57 0%, transparent 65%), #061744');

  /* ---------- the real dashboard (tall viewport so all nine widgets are on screen at once) ---------- */
  const OPT = { x: 420, y: -20, s: 0.75, vw: 1440, vh: 1500, r: 28 };
  const app = new App(OPT);
  await app.load();
  const L = await scout(async (a) => {
    const R = (s) => a.rect(s), o = { r: {}, dock: { edit: R('.dock-item[data-id=edit]'), set: R('.dock-item[data-id=settings]') }, fab: R('#askBtn') };
    ['time', 'rem', 'owe', 'todo', 'sales', 'cal', 'meet', 'spend', 'pack'].forEach((id) => { o.r[id] = R(`.w[data-id=${id}]`); });
    o.chk = R('.chk[data-todo=t1]'); o.late = R('.w[data-id=owe] .pill.late'); o.warn = R('.w[data-id=spend] .pill.warn');
    a.q('#modeChip').click(); a.settle();
    o.grid = R('#grid'); o.cell = o.grid.w / 12;
    o.tile = { meet: R('.tile[data-id=meet]') };
    o.x = R('.w[data-id=meet] .w-x'); o.rs = { cal: R('.w[data-id=cal] .w-resize') };
    return o;
  }, OPT);
  const L2 = await scout(async (a) => { a.q('.dock-item[data-id=settings]').click(); a.settle(); return { ms: a.rect('[data-lang=ms]'), en: a.rect('[data-lang=en]') }; }, OPT);
  const L3 = await scout(async (a) => { a.q('#askBtn').click(); a.settle(); return { input: a.rect('#chatIn') }; }, OPT);
  const sp = (r) => app.st(r.cx, r.cy);
  const cur = mkCursor();
  const cell = L.cell, gx = (c) => L.grid.x + c * cell, gy = (r) => L.grid.y + r * cell;
  const hl = (r, t0, t1) => {
    const [x0, y0] = app.view(r.x, r.y), [x1, y1] = app.view(r.x + r.w, r.y + r.h);
    const e = E('div', 'hl', '', hud);
    e.style.cssText += `;left:${x0 - 10}px;top:${y0 - 8}px;width:${x1 - x0 + 20}px;height:${y1 - y0 + 16}px`;
    A(e, [{ opacity: 0, scale: 1.5 }, { opacity: 1, scale: 1 }], t0, 0.35, { ease: BACK });
    A(e, [{ opacity: 1 }, { opacity: 0 }], t1, 0.15, { ease: IN });
  };

  /* ======== 0 - 3.5  NUMBERS ======== */
  [['9 *widgets.', 0.0, 0.9], ['2 *languages.', 0.9, 1.8], ['1 *screen.', 1.8, 2.65], ['0 !spreadsheets.', 2.65, 3.45]].forEach(([txt, a, b], k) => {
    words(txt, 960, 540, { size: 250, slam: true, t0: a + 0.02, t1: b, stag: 0.1, dur: 0.3, w: 1800 });
    sfx(a, 'whoosh2');
    flash(a, 0.25, k % 2 ? '#0052d9' : '#28b894');
  });
  shake(0.0, 3.5, 4, 16);

  /* ======== 3.5 - 6  LOGO ======== */
  const logoS = scene(3.5, 6);
  flash(3.5, 0.5);
  burst(3.55, 960, 520, 70, 950);
  shake(3.5, 3.9, 24, 0);
  const mark = E('div', 'logo', LOGO(200), logoS);
  mark.style.cssText += ';left:470px;top:300px;opacity:0';
  A(mark, [{ opacity: 0, scale: 0.1, rotate: '-200deg' }, { opacity: 1, scale: 1, rotate: '0deg' }], 3.5, 0.6, { ease: BACK });
  A(mark, [{ opacity: 1, scale: 1 }, { opacity: 0, scale: 1.3 }], 5.85, 0.15, { ease: IN });
  words('Kaunter', 1110, 400, { size: 210, letters: true, stag: 0.05, t0: 3.65, t1: 5.85, dur: 0.45 });
  words('Everything. *At *a *glance.', 960, 620, { size: 90, t0: 4.3, t1: 5.85, stag: 0.08, w: 1700 });
  beatPulse(3.5, 53.5);

  /* ======== 6 - 28.5  NINE SPOTLIGHTS ======== */
  zoom(5.7, 0.3, 960, 542, 0.9);
  app.in(5.7, { scale: 0.7, translate: '0 120px', rotate: '4deg' }, 0.6);
  app.replay(5.8);
  const scrim = E('div', '', '', hud);
  scrim.style.cssText = 'position:absolute;left:0;top:0;width:1150px;height:100%;background:linear-gradient(90deg,#061744 0%,#061744 52%,rgba(6,23,68,0) 100%);opacity:0';
  A(scrim, [{ opacity: 0 }, { opacity: 1 }], 6.0, 0.3, { ease: OUT });
  A(scrim, [{ opacity: 1 }, { opacity: 0 }], 28.4, 0.25, { ease: IN });
  const STOPS = [['time', 'Time', 'Always know what’s next.'], ['rem', 'Reminders', 'Say it once. It remembers.'], ['owe', 'Money owed', 'Who owes you. Who you owe.'], ['todo', 'To-do', 'Meetings turn into tasks.'], ['sales', 'Sales', 'Your week in seven bars.'], ['cal', 'Calendar', 'Your month. Your events.'], ['meet', 'Meetings', 'Decisions and actions, summarised.'], ['spend', 'Spending', 'Receipts parsed. Doubts flagged.'], ['pack', 'Accountant pack', 'Month-end, ready to hand over.']];
  const COL = ['#28b894', '#0052d9', '#8fbaff'];
  STOPS.forEach(([id, title, line], k) => {
    const t = 6.0 + k * 2.5, r = L.r[id], [sx, sy] = sp(r);
    wipe(t - 0.1, COL[k % 3], 0.5);
    zoom(t + 0.15, 0.1, sx, sy, 2.0, LIN, 1380, 540);
    zoom(t + 0.3, 2.2, sx, sy, 2.12, LIN, 1380, 540);
    words('*0' + (k + 1), 110, 300, { left: true, size: 300, slam: true, t0: t + 0.3, t1: t + 2.35, stag: 0.1, dur: 0.35, w: 900 });
    words(title, 110, 540, { left: true, size: id === 'pack' ? 100 : 128, t0: t + 0.45, t1: t + 2.35, stag: 0.08, w: 900 });
    words(line, 110, 720, { left: true, size: 54, t0: t + 0.75, t1: t + 2.35, stag: 0.04, w: 800, color: '#b4c6f1' });
    sfx(t + 0.3, 'pop');
    if (id === 'owe') hl(L.late, t + 0.9, t + 2.3);
    if (id === 'spend') hl(L.warn, t + 0.9, t + 2.3);
    if (id === 'todo') {
      const c = sp(L.chk), [cx2, cy2] = app.view(c[0], c[1]);
      cursorPath(cur, [[t + 0.4, c[0] + 250, c[1] + 300], [t + 1.3, c[0], c[1]]]);
      app.click(t + 1.4, L.chk.cx, L.chk.cy);
      clickFx(cur, t + 1.4, c[0], c[1]);
      A(cur, [{ opacity: 1 }, { opacity: 0 }], t + 2.1, 0.2, { ease: IN });
    }
  });

  /* ======== 28.5 - 36.5  CUSTOMISE ======== */
  const T0 = 28.5;
  const edit = sp(L.dock.edit), xs = sp(L.x), tl = sp(L.tile.meet);
  zoom(T0 - 0.1, 0.1, 960, 542, 1.25);
  A(cur, [{ opacity: 0 }, { opacity: 1 }], T0, 0.01, { ease: LIN });
  words('Make it *yours.', 960, 110, { size: 120, t0: T0 + 0.1, t1: T0 + 2.1, stag: 0.1, w: 1500 });
  cursorPath(cur, [[T0, 1400, 900], [T0 + 0.7, edit[0], edit[1]]]);
  app.click(T0 + 0.8, L.dock.edit.cx, L.dock.edit.cy);
  clickFx(cur, T0 + 0.8, edit[0], edit[1]);
  flash(T0 + 0.85, 0.3, '#28b894');
  /* remove Meetings, put it back somewhere else */
  cursorPath(cur, [[T0 + 0.8, edit[0], edit[1]], [T0 + 1.6, xs[0], xs[1]]]);
  app.click(T0 + 1.75, L.x.cx, L.x.cy);
  clickFx(cur, T0 + 1.75, xs[0], xs[1]);
  pill('Remove.', 960, 1000, T0 + 1.75, T0 + 2.6, { size: 52 });
  const drop = [gx(0) + 2 * cell, gy(7) + 2 * cell]; /* the hole Meetings left behind */
  const dropS = app.st(drop[0], drop[1]);
  cursorPath(cur, [[T0 + 1.75, xs[0], xs[1]], [T0 + 2.7, tl[0], tl[1]], [T0 + 4.0, dropS[0], dropS[1]]]);
  app.drag(T0 + 2.8, T0 + 4.0, [L.tile.meet.cx, L.tile.meet.cy], drop);
  pill('Drag.', 960, 1000, T0 + 2.8, T0 + 3.9, { size: 56, g: true });
  pill('Drop.', 960, 1000, T0 + 4.0, T0 + 4.8, { size: 56, g: true });
  burst(T0 + 4.05, dropS[0], dropS[1], 30, 500);
  const rc = sp(L.rs.cal), rt = [gx(11), gy(7)], rtS = app.st(rt[0], rt[1]);
  cursorPath(cur, [[T0 + 4.0, dropS[0], dropS[1]], [T0 + 4.9, rc[0], rc[1]], [T0 + 6.0, rtS[0], rtS[1]]]);
  app.drag(T0 + 5.0, T0 + 6.0, [L.rs.cal.cx, L.rs.cal.cy], rt);
  pill('Resize.', 960, 1000, T0 + 5.0, T0 + 6.1, { size: 56, g: true });
  zoom(T0 + 6.2, 0.6, 960, 542, 1.0);
  app.click(T0 + 6.8, L.dock.edit.cx, L.dock.edit.cy);
  cursorPath(cur, [[T0 + 6.0, rtS[0], rtS[1]], [T0 + 6.7, edit[0], edit[1]]]);
  clickFx(cur, T0 + 6.8, edit[0], edit[1]);
  A(cur, [{ opacity: 1 }, { opacity: 0 }], T0 + 7.2, 0.2, { ease: IN });
  words('Your layout. *Your *rules.', 960, 540, { size: 150, slam: true, t0: T0 + 6.9, t1: T0 + 7.9, stag: 0.12, w: 1800, dur: 0.3 });
  sfx(T0 + 6.9, 'hit');

  /* ======== 36.5 - 44.5  ASK AI ======== */
  const A0 = 36.5;
  const fab = sp(L.fab), inp = sp(L3.input);
  app.fakeReply('RM 312.40 on Stock this week. That is 47% of your spending.');
  A(cur, [{ opacity: 0 }, { opacity: 1 }], A0, 0.01, { ease: LIN });
  zoom(A0, 0.7, fab[0] - 150, fab[1] - 150, 2.3);
  cursorPath(cur, [[A0, fab[0] - 400, fab[1] - 300], [A0 + 0.9, fab[0], fab[1]]]);
  app.click(A0 + 1.0, L.fab.cx, L.fab.cy);
  clickFx(cur, A0 + 1.0, fab[0], fab[1]);
  words('Just *ask.', 960, 150, { size: 130, t0: A0 + 1.0, t1: A0 + 5.0, stag: 0.12, w: 1400 });
  app.type(A0 + 1.8, A0 + 3.6, '#chatIn', 'how much did I spend on stock?');
  app.submit(A0 + 3.9, '#chatForm');
  app.release(A0 + 5.0);
  app.call(A0 + 5.2, (a) => a.w.Kaunter.refresh('spend'));
  const sr = L.r.spend, [spx, spy] = sp(sr);
  zoom(A0 + 5.1, 0.8, spx, spy, 1.7, IO, 1100, 540);
  hl({ x: sr.x, y: sr.y, w: sr.w, h: sr.h }, A0 + 5.6, A0 + 7.7);
  burst(A0 + 5.2, 1100, 400, 40, 800);
  sfx(A0 + 5.0, 'ding');
  pill('Answers from your own data.', 960, 1000, A0 + 5.6, A0 + 7.8, { size: 52 });
  A(cur, [{ opacity: 1 }, { opacity: 0 }], A0 + 5.0, 0.2, { ease: IN });
  app.call(A0 + 7.8, (a) => a.q('#askBtn').click());

  /* ======== 44.5 - 48.5  BAHASA ======== */
  const B0 = 44.5;
  const gear = sp(L.dock.set), ms = sp(L2.ms), en = sp(L2.en);
  zoom(B0, 0.5, gear[0] + 200, gear[1], 1.9);
  A(cur, [{ opacity: 0 }, { opacity: 1 }], B0, 0.01, { ease: LIN });
  cursorPath(cur, [[B0, gear[0] + 300, gear[1] + 200], [B0 + 0.5, gear[0], gear[1]], [B0 + 1.4, ms[0], ms[1]], [B0 + 2.6, en[0], en[1]]]);
  app.click(B0 + 0.6, L.dock.set.cx, L.dock.set.cy);
  clickFx(cur, B0 + 0.6, gear[0], gear[1]);
  app.click(B0 + 1.5, L2.ms.cx, L2.ms.cy);
  clickFx(cur, B0 + 1.5, ms[0], ms[1]);
  words('Cakap *Melayu? *Boleh!', 960, 150, { size: 100, t0: B0 + 1.5, t1: B0 + 2.7, stag: 0.1, w: 1600 });
  zoom(B0 + 1.7, 0.6, 960, 542, 1.0);
  app.click(B0 + 2.8, L2.en.cx, L2.en.cy);
  clickFx(cur, B0 + 2.8, en[0], en[1]);
  words('English? *Also *boleh.', 960, 150, { size: 100, t0: B0 + 2.8, t1: B0 + 3.9, stag: 0.1, w: 1600 });
  app.click(B0 + 3.3, L.dock.set.cx, L.dock.set.cy);
  A(cur, [{ opacity: 1 }, { opacity: 0 }], B0 + 3.4, 0.2, { ease: IN });
  sfx(B0 + 1.5, 'pop'); sfx(B0 + 2.8, 'pop');

  /* ======== 48.5 - 53.5  ANY DEVICE ======== */
  const D0 = 48.5;
  app.out(D0 - 0.1);
  zoom(D0 - 0.1, 0.05, 960, 540, 1);
  const lap = new App({ x: 450, y: 250, s: 0.95, vw: 1280, vh: 720, kind: 'laptop', r: 18 });
  const tab = new App({ x: 150, y: 430, s: 0.5, vw: 820, vh: 1180, kind: 'tablet', r: 30 });
  const pho = new App({ x: 1400, y: 380, s: 0.66, vw: 390, vh: 844, kind: 'phone', r: 66 });
  await Promise.all([lap.load(), tab.load(), pho.load()]);
  [[lap, D0 + 0.1], [tab, D0 + 0.5], [pho, D0 + 0.9]].forEach(([a, t]) => { a.in(t, { scale: 0.4, translate: '0 500px', rotate: '-10deg' }, 0.6); a.replay(t + 0.1); });
  words('One dashboard. *Every *screen.', 960, 140, { size: 110, t0: D0 + 0.2, t1: D0 + 4.8, stag: 0.1, w: 1800 });
  burst(D0 + 0.6, 960, 700, 40, 900);
  A(shakeEl, [{ translate: '0 0' }, { translate: '0 -6px' }, { translate: '0 0' }], D0 + 1.0, 0.5, { ease: IO });

  /* ======== 53.5 - 60  OUTRO ======== */
  const O0 = 53.5;
  lap.out(O0 - 0.15); tab.out(O0 - 0.15); pho.out(O0 - 0.15);
  flash(O0, 0.6);
  burst(O0 + 0.05, 960, 540, 90, 1100);
  [['9', 'widgets'], ['2', 'languages'], ['1', 'screen'], ['0', 'spreadsheets']].forEach(([n, lab], k) => {
    const s = E('div', 'stat', `<span class="${k === 3 ? 'orange' : 'green'}" style="font-size:240px">${n}</span><small>${lab}</small>`, hud);
    s.style.left = 330 + k * 420 + 'px';
    s.style.top = '420px';
    A(s, [{ opacity: 0, scale: 0.3, translate: '0 80px' }, { opacity: 1, scale: 1, translate: '0 0' }], O0 + 0.25 + k * 0.3, 0.45, { ease: BACK });
    A(s, [{ opacity: 1, scale: 1 }, { opacity: 0, scale: 1.3 }], O0 + 2.5, 0.2, { ease: IN });
    sfx(O0 + 0.25 + k * 0.3, 'pop');
  });
  const mk2 = E('div', 'logo', LOGO(170), scene(O0 + 2.7, 60));
  mk2.style.cssText += ';left:560px;top:250px;opacity:0';
  A(mk2, [{ opacity: 0, scale: 0.1, rotate: '-200deg' }, { opacity: 1, scale: 1, rotate: '0deg' }], O0 + 2.7, 0.55, { ease: BACK });
  words('Kaunter', 1120, 335, { size: 180, letters: true, stag: 0.05, t0: O0 + 2.8, dur: 0.45 });
  words('Your business, *in *one *glance.', 960, 580, { size: 112, t0: O0 + 3.4, stag: 0.08, w: 1800 });
  words('Built for Malaysian SMEs · Powered by WorkBuddy', 960, 780, { size: 46, t0: O0 + 4.2, stag: 0.04, w: 1800 });
  const bl = buddyCanvas(230, 'love');
  bl.style.cssText += ';left:1500px;top:800px';
  A(bl, [{ opacity: 1, translate: '0 340px' }, { opacity: 1, translate: '0 0' }], O0 + 3.6, 0.55, { ease: BACK });
  sfx(O0 + 3.6, 'pop');
  burst(O0 + 4.2, 1600, 850, 30, 500);
  const fade = E('div', '', '', hud);
  fade.style.cssText = 'position:absolute;inset:0;background:#020b24;opacity:0';
  A(fade, [{ opacity: 0 }, { opacity: 1 }], 59.4, 0.6, { ease: LIN });

  window.APP = app;
  finish();
})();
