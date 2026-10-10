/* CUT D "Make it yours": 40 s, 120 bpm (1 beat = 0.5 s), 1920x1080, white / teal / gray, few words, real UI doing the talking.
   0-3 hook | 3-4.5 logo | 4.5-8 dashboard | 8-14 WorkBuddy buddy pulls skills into the team | 14-26 dorm room: drag the team in, ask, they discuss
   26-35 "Don't like your current dashboard? Customise it!" + shorten To-do, pull Contract risk left, pull Rival prices down | 35-40 outro.
   The app is the live Next.js dashboard (web/) in an iframe; drag/resize/click are scripted pointer + drag events. */
(async () => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'film-d.css';
  document.head.appendChild(link);
  await new Promise((r) => { link.onload = r; link.onerror = r; });
  await Promise.all(['500 20px Inter', '600 20px Inter', '700 20px Inter', '800 20px Inter', '500 20px "JetBrains Mono"'].map((f) => document.fonts.load(f)));
  try { localStorage.setItem('kaunter-theme', 'light'); localStorage.removeItem('kaunter-layout-v4'); } catch (e) { /* ignore */ }

  /* The product is burgundy; the film is teal. Flip RECOLOR to false to show the app in its own colours. */
  const RECOLOR = true;
  const TEAL = ':root{--burgundy:#0f766e;--burgundy-hover:#0b5f58;--burgundy-tint:#e2f3f1;--focus:#0f766e;--b-900:#073b37;--b-700:#0f766e;--b-500:#2a948c;--b-300:#7cc4bd;--b-100:#c9e8e5;--b-050:#eef8f7;--paper:#f3f5f5;--surface-2:#eef1f1;--search-bg:#e4e9e9;--line:#e0e5e5;--line-strong:#cfd6d6;--review:#6b7a7a;--review-ink:#3f4d4d;--review-tint:#e9eeee;}';
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, u) => a + (b - a) * u;
  const bez = (p0, p1, p2, u) => [(1 - u) * (1 - u) * p0[0] + 2 * (1 - u) * u * p1[0] + u * u * p2[0], (1 - u) * (1 - u) * p0[1] + 2 * (1 - u) * u * p1[1] + u * u * p2[1]];
  const bg = (t0, t1, css) => { const s = scene(t0, t1, '', bgl); E('div', 'bg', '', s).style.background = css; return s; };
  const pop = (el, t, dy = 26, dur = 0.38) => A(el, [{ opacity: 0, translate: `0 ${dy}px`, scale: 0.94 }, { opacity: 1, translate: '0 0', scale: 1 }], t, dur, { ease: BACK });
  const fade = (el, t, dur = 0.2) => A(el, [{ opacity: 1 }, { opacity: 0 }], t, dur, { ease: IN });
  const place = (el, x, y, w) => { el.style.left = x + 'px'; el.style.top = y + 'px'; if (w) el.style.width = w + 'px'; return el; };
  const TEALS = ['#0d9488', '#5eead4', '#ffffff', '#9aa7a7'];

  /* ---------- pixel buddies (same sprite + skins as web/components/Buddy.tsx) ---------- */
  const BASE = ['..oo........oo..', '.owwo......owwo.', '.owwoooooooowwo.', '.owwwwwwwwwwwwo.', 'hhowkkkkkkkkwohh', 'hhokkkkkkkkkkohh', 'hhokkkkkkkkkkohh', 'hhokkkkkkkkkkohh', 'hhokkkkkkkkkkohh', '.owwwwwwwwwwwwo.', '..oowwwwwwwwoo..', '..owwwwwwwwwwo..', '..owwwwsswwwwo..', '..oswwwwwwwwso..', '...oooooooooo...', '................'];
  const EYE = [[4, 5], [5, 5], [4, 6], [5, 6], [4, 7], [5, 7]];
  const FEET = { stand: [3, 4, 5, 10, 11, 12], step: [2, 3, 4, 11, 12, 13] };
  const SKINS = {
    wb: { w: '#f4f7ff', s: '#b9c4dd', eye: '#3ee6b0', acc: '#0d9488', marks: [[7, 12], [8, 12], [7, 13], [8, 13], [2, 1], [13, 1]] },
    manager: { w: '#f4f7ff', s: '#b9c4dd', eye: '#3ee6b0', acc: '#ff7aa8', marks: [[7, 12], [8, 12], [7, 13], [8, 13]] },
    marketing: { w: '#ffd6e6', s: '#f0a3c3', eye: '#ff4d8d', acc: '#ff3d81', marks: [[2, 1], [3, 1], [2, 2], [3, 2]] },
    finance: { w: '#fff0b8', s: '#d9b95c', eye: '#ffc400', acc: '#e08a00', marks: [[7, 12], [8, 12]] },
    legal: { w: '#e9defc', s: '#b49ae6', eye: '#8a5cff', acc: '#5b2fc9', marks: [[7, 12], [8, 12], [6, 13], [9, 13]] },
    assistant: { w: '#d4e6ff', s: '#8fb0e6', eye: '#4aa8ff', acc: '#3b6fe0', marks: [[1, 9], [1, 10], [2, 10], [12, 9]] }
  };
  function mkBuddy(id, size, pose, parent) {
    const cv = E('canvas', 'px', '', parent), k = SKINS[id], pal = { o: '#10162e', w: k.w, s: k.s, k: '#0a0f24', h: '#8794b4', e: k.eye, a: k.acc };
    cv.width = cv.height = 16;
    cv.style.width = cv.style.height = size + 'px';
    const g = BASE.map((r) => r.split(''));
    EYE.forEach(([x, y]) => { g[y][x] = 'e'; g[y][15 - x] = 'e'; });
    [11, 12, 13].forEach((y) => { g[y][1] = 'h'; g[y][14] = 'h'; });
    FEET[pose].forEach((x) => { g[15][x] = 'h'; });
    k.marks.forEach(([x, y]) => { g[y][x] = 'a'; });
    const c = cv.getContext('2d');
    g.forEach((r, y) => r.forEach((ch, x) => { if (ch !== '.') { c.fillStyle = pal[ch]; c.fillRect(x, y, 1, 1); } }));
    return cv;
  }
  function pixBurst(t, x, y, cols, n = 18, spread = 150, size = 12, parent = hud) {
    for (let i = 0; i < n; i++) {
      const q = E('div', 'pix', '', parent), a = rnd() * Math.PI * 2, d = rr(0.4, 1) * spread;
      q.style.cssText += `width:${size}px;height:${size}px;background:${cols[i % cols.length]};left:${x}px;top:${y}px`;
      A(q, [{ opacity: 1, translate: '0 0', scale: 1 }, { opacity: 1, translate: `${Math.cos(a) * d * 0.6}px ${Math.sin(a) * d * 0.6 - 20}px`, offset: 0.45 }, { opacity: 0, translate: `${Math.cos(a) * d}px ${Math.sin(a) * d + 36}px`, scale: 0.3 }], t, rr(0.5, 0.85), { ease: OUT });
    }
  }
  function ringAt(t, x, y, color, r = 70, hold = 0.6, parent = hud) {
    const e = E('div', '', '', parent);
    e.style.cssText = `position:absolute;left:${x - r}px;top:${y - r}px;width:${2 * r}px;height:${2 * r}px;border-radius:50%;border:6px solid ${color};opacity:0`;
    A(e, [{ opacity: 0.95, scale: 0.3 }, { opacity: 0, scale: 2 }], t, hold, { ease: OUT });
  }
  function cap(t0, t1, text) {
    const c = E('div', 'cap', '', hud);
    text.split(' ').forEach((tok, i) => {
      let k = '';
      if (tok[0] === '*') { k = 'g'; tok = tok.slice(1); } else if (tok[0] === '~') { k = 'b'; tok = tok.slice(1); }
      const s = E('span', k, tok.replace(/_/g, '&nbsp;'), c);
      A(s, [{ opacity: 0, translate: '0 18px' }, { opacity: 1, translate: '0 0' }], t0 + 0.05 + i * 0.06, 0.28, { ease: OUT });
    });
    A(c, [{ opacity: 0, translate: '0 24px' }, { opacity: 1, translate: '0 0' }], t0, 0.25, { ease: OUT });
    A(c, [{ opacity: 1 }, { opacity: 0 }], t1 - 0.1, 0.12, { ease: IN });
  }

  /* ---------- backgrounds ---------- */
  bg(0, 3, 'radial-gradient(900px 620px at 50% 50%, #ffffff 0%, transparent 70%), #e3e9e9');
  const lit = bg(3, 40, 'radial-gradient(1100px 700px at 8% -10%, rgba(13,148,136,.16) 0%, transparent 60%), radial-gradient(900px 600px at 100% 110%, rgba(15,42,41,.07) 0%, transparent 60%), #f1f4f4');
  E('div', 'dots', '', lit);

  /* ---------- the real app ---------- */
  const AX = 520, AY = 170, SC = { x: AX, y: AY, s: 1, vw: 1280, vh: 720, kind: 'kn', r: 22, url: '/' };
  const prep = (a) => {
    const d = a.doc(), st = d.createElement('style');
    st.textContent = (RECOLOR ? TEAL : '') + 'nextjs-portal{display:none!important}';
    d.head.appendChild(st);
    /* no live backend in the film: the dorm room plays its built-in discussion, deterministically */
    a.w.fetch = () => Promise.resolve(new a.w.Response(JSON.stringify({ type: 'text', message: '', turns: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  };
  const app = new App({ ...SC });
  await app.load();
  prep(app);
  const L = await scout(async (a) => {
    prep(a);
    await sleep(400);
    const d = a.doc();
    const rc = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; };
    const btn = (t) => [...d.querySelectorAll('button')].find((b) => b.textContent.trim() === t);
    const wd = (title) => [...d.querySelectorAll('.widget')].find((el) => el.querySelector('.label')?.textContent.trim() === title);
    const o = { wid: {}, rs: {} };
    o.rail = [...d.querySelectorAll('.rail nav .rail-item')].map(rc);
    o.home = rc(d.querySelector('.rail .logo'));
    o.table = rc(d.querySelector('.rail button[title="Round table"]'));
    d.querySelectorAll('.widget').forEach((el) => { o.wid[el.querySelector('.label').textContent.trim()] = rc(el); });
    o.checks = [...wd('To-do').querySelectorAll('.tdi')].map(rc);
    o.cust = rc(btn('Customise'));
    btn('Customise').click();
    await sleep(500);
    o.grid = rc(d.querySelector('.canvas'));
    o.cx = d.querySelector('.canvas').clientWidth / 8;
    o.cy = (o.wid['To-do'].h + 12) / 3;
    o.done = rc(btn('Done'));
    d.querySelectorAll('.widget').forEach((el) => { const h = el.querySelector('.resize'); if (h) o.rs[el.querySelector('.label').textContent.trim()] = rc(h); });
    btn('Done').click();
    await sleep(300);
    d.querySelector('.rail button[title="Round table"]').click();
    await sleep(700);
    o.members = [...d.querySelectorAll('.member')].map(rc);
    o.seats = [...d.querySelectorAll('.seat')].map(rc);
    o.bank = [...d.querySelectorAll('.bank button')].map(rc);
    o.go = rc(d.querySelector('.controls .btn'));
    return o;
  }, SC);
  const P = (x, y) => app.st(x, y);
  const rb = L.rail.map((r) => P(r.cx, r.cy)); /* the five characters in the rail: manager, marketing, finance, legal, assistant */

  /* ======== 0 - 3  HOOK ======== */
  const pain = scene(0, 3.0);
  const NT = [
    { x: 330, y: 270, r: -4, t: '★☆☆☆☆ “Worst service ever”', s: 'Google review · 2 min ago', c: '' },
    { x: 1610, y: 240, r: 3, t: 'Invoice #4471 due today', s: 'RM 4,820 · Syarikat Tepung Maju', c: 'am' },
    { x: 290, y: 800, r: 2, t: 'Did we pay this invoice twice?', s: 'Finance · check the bank', c: '' },
    { x: 1630, y: 810, r: -3, t: 'Contract auto-renews in 3 days', s: 'Supplier agreement · clause 9', c: 'am' },
    { x: 960, y: 130, r: -2, t: '“We changed our bank account”', s: 'WhatsApp · unknown number', c: '' },
    { x: 1180, y: 940, r: 2, t: 'Rival: 20% off this weekend', s: 'Instagram · 41 new likes', c: 'am' },
    { x: 640, y: 950, r: -2, t: 'SSM renewal overdue', s: 'Reminder · 2 days late', c: '' },
    { x: 1500, y: 520, r: 4, t: 'Customer: “Where is my order?”', s: 'WhatsApp · 14 unread', c: '' },
    { x: 400, y: 520, r: -3, t: 'Late fee? Is that even legal?', s: 'Search history', c: 'am' }
  ];
  NT.forEach((n, i) => {
    const el = E('div', 'nt ' + n.c, `<i></i><div><b>${n.t}</b><span>${n.s}</span></div>`, pain), t = 0.05 + i * 0.3, tx = n.x - 235, ty = n.y - 45;
    A(el, [{ opacity: 0, translate: `${tx}px ${ty - 70}px`, scale: 1.5, rotate: `${n.r * 3}deg` }, { opacity: 1, translate: `${tx}px ${ty}px`, scale: 1, rotate: `${n.r}deg` }], t, 0.24, { ease: OUT });
    sfx(t, 'ping');
  });
  const b99 = place(E('div', 'badge99', '3', hud), 1700, 56);
  pop(b99, 0.05, 20, 0.3);
  fade(b99, 2.9, 0.1);
  counter(b99, 0.1, 2.7, 3, 99, (v) => (Math.round(v) >= 99 ? '99+' : Math.round(v)));
  words('You_are_the', 960, 395, { t0: 0.05, t1: 2.95, size: 62, stag: 0 });
  words('marketer.', 960, 570, { t0: 0.1, t1: 0.8, slam: true, size: 215, out: 1 });
  words('accountant.', 960, 570, { t0: 0.8, t1: 1.5, slam: true, size: 205, out: 1 });
  words('lawyer.', 960, 570, { t0: 1.5, t1: 2.2, slam: true, size: 215, out: 1 });
  words('!alone.', 960, 570, { t0: 2.2, t1: 2.95, slam: true, size: 230, out: 1 });
  shake(0.0, 2.95, 1.5, 7);
  [0.8, 1.5, 2.2].forEach((t) => sfx(t, 'tick'));

  /* ======== 3 - 4.5  LOGO ======== */
  flash(3.0, 0.4, '#0d9488');
  sfx(3.0, 'hit');
  const wm = place(E('div', 'wm', '<div class="kmark">K</div><b>Kaunter</b>', hud), 960, 450);
  A(wm, [{ opacity: 0, scale: 2.6, filter: 'blur(24px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)' }], 3.0, 0.4, { ease: OUT });
  A(wm, [{ opacity: 1, scale: 1 }, { opacity: 0, scale: 1.12 }], 4.35, 0.2, { ease: IN });
  words('Your ~AI_team.', 960, 690, { t0: 3.5, t1: 4.35, size: 90, stag: 0.14 });
  const mini = E('div', 'mini', '<div class="kmark">K</div><b>Kaunter</b>', hud);
  A(mini, [{ opacity: 0, translate: '0 -20px' }, { opacity: 1, translate: '0 0' }], 4.5, 0.4, { ease: OUT });
  fade(mini, 34.9, 0.15);
  beatPulse(3.0, 35.0, 0.5, 0.005);

  /* ======== 4.5 - 8  THE DASHBOARD, USED ======== */
  const CTR = [AX + 640, AY + 360];
  zoom(4.4, 0.05, CTR[0], CTR[1], 1.15, LIN);
  zoom(7.7, 0.7, 960, 540, 1, IO);
  app.in(4.5, { scale: 0.88, translate: '0 60px', rotate: '0deg' }, 0.6);
  at(4.5, () => app.doc().querySelectorAll('.widget').forEach((el, i) => el.animate([{ opacity: 0, transform: 'translateY(34px) scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 160 + i * 70, easing: OUT, fill: 'backwards' })));
  cap(4.7, 7.9, 'Your_business, ~one_screen');
  {
    const cur = mkCursor(), tdo = L.checks[1], c0 = P(1000, 200), c1 = P(tdo.cx - 60, tdo.cy), c2 = P(tdo.cx + 120, tdo.cy + 140);
    cur.style.opacity = 0;
    A(cur, [{ opacity: 0 }, { opacity: 1 }], 5.4, 0.2, { ease: OUT });
    A(cur, [{ opacity: 1 }, { opacity: 0 }], 7.6, 0.15, { ease: IN });
    cursorPath(cur, [[5.4, c0[0], c0[1]], [6.4, c1[0], c1[1], IO], [7.0, c1[0], c1[1], LIN], [7.6, c2[0], c2[1], IO]]);
    app.click(6.5, tdo.cx - 60, tdo.cy); clickFx(cur, 6.5, c1[0], c1[1]);
  }

  /* ======== 8 - 14  WORKBUDDY PULLS THE SKILLS ======== */
  const SK = [
    { file: 'marketing.skill', sub: 'reviews · rivals · campaigns', c: '#ff4d8d', who: 'Marketing', idx: 1, t0: 8.7, td: 9.5, wid: ['Top campaign', 'Review sentiment', 'Rival prices'] },
    { file: 'finance.skill', sub: 'invoice checks · fraud flags', c: '#ffc400', who: 'Finance', idx: 2, t0: 10.5, td: 11.3, wid: ['Sales this week', 'Fraud check'] },
    { file: 'legal.skill', sub: 'law handbook · contracts', c: '#9a73ff', who: 'Legal', idx: 3, t0: 12.3, td: 13.1, wid: ['Contract risk'] }
  ];
  const shelf = E('div', 'shelf', '<div class="hd"><i></i>WorkBuddy <em>skills</em></div>', hud);
  A(shelf, [{ opacity: 0, translate: '-90px 0' }, { opacity: 1, translate: '0 0' }], 7.9, 0.5, { ease: BACK });
  fade(shelf, 13.7, 0.25);
  sfx(7.9, 'whoosh');
  const slotY = (i) => 290 + i * 110, C0 = (i) => [260, slotY(i) + 46];
  SK.forEach((j, i) => {
    j.slot = E('div', 'slot', '', shelf);
    j.slot.style.top = slotY(i) - 210 + 'px';
    j.chip = E('div', 'skill', `<div><b>${j.file}</b><span>${j.sub}</span></div>`, hud);
    j.T = rb[j.idx];
  });
  const H = [250, 790], BS = 150;
  const wbPos = E('div', 'fx-abs', '', hud), wbFx = E('div', 'fx-abs', '', wbPos);
  wbPos.style.width = wbPos.style.height = wbFx.style.width = wbFx.style.height = BS + 'px';
  wbPos.style.opacity = 1;
  const wbA = mkBuddy('wb', BS, 'stand', wbFx), wbB = mkBuddy('wb', BS, 'step', wbFx);
  wbB.style.visibility = 'hidden';
  const wbName = place(E('div', 'name', '<b>●</b> WorkBuddy', hud), H[0] - 70, H[1] - 112);
  A(wbFx, [{ opacity: 1, scale: 0.05, rotate: '-25deg' }, { opacity: 1, scale: 1.25, rotate: '6deg', offset: 0.6 }, { opacity: 1, scale: 1, rotate: '0deg' }], 8.0, 0.45, { ease: OUT });
  A(wbFx, [{ opacity: 1, scale: 1 }, { opacity: 0, scale: 0.2, translate: '0 40px' }], 13.75, 0.3, { ease: IN });
  pixBurst(8.0, H[0], H[1], TEALS, 26, 190, 14);
  ringAt(8.0, H[0], H[1], '#0d9488', 90, 0.7);
  sfx(8.0, 'spawn');
  A(wbName, [{ opacity: 0, translate: '0 14px' }, { opacity: 1, translate: '0 0' }], 8.3, 0.3, { ease: BACK });
  fade(wbName, 8.65, 0.2);
  cap(8.0, 14.0, 'Powered_by *WorkBuddy_skills');
  const Aof = (i) => [C0(i)[0] + 270, C0(i)[1]], Tof = (j) => [j.T[0] - 70, j.T[1]];
  const ctrl = (a, b, lift) => [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - lift];
  const segs = [];
  SK.forEach((j, i) => {
    const a = Aof(i), tt = Tof(j);
    segs.push({ t0: j.t0 - 0.4, t1: j.t0, f: (u) => [lerp(H[0], a[0], easeOut(u)), lerp(H[1], a[1], easeOut(u)) - 40 * Math.sin(Math.PI * u)] });
    segs.push({ t0: j.t0, t1: j.td, f: (u) => bez(a, ctrl(a, tt, 130), tt, easeIO(u)) });
    segs.push({ t0: j.td + 0.1, t1: j.td + 0.55, f: (u) => { const e = easeIO(u); return [lerp(tt[0], H[0], e), lerp(tt[1], H[1], e) - 60 * Math.sin(Math.PI * u)]; } });
  });
  const tether = E('div', 'tether', '<svg width="1920" height="1080"><line x1="0" y1="0" x2="0" y2="0" stroke="#0d9488" stroke-width="5" stroke-dasharray="3 14" stroke-linecap="round" opacity="0"/></svg>', hud);
  const tl = $('line', tether);
  function frame(t) {
    let p = H.slice(), moving = false;
    for (const s of segs) if (t >= s.t0 && t < s.t1) { p = s.f((t - s.t0) / (s.t1 - s.t0)); moving = true; }
    if (!moving) p[1] += Math.sin(t * 9) * 6;
    const step = moving && Math.floor(t * 9) % 2 === 1;
    wbA.style.visibility = step ? 'hidden' : 'visible';
    wbB.style.visibility = step ? 'visible' : 'hidden';
    wbPos.style.translate = `${p[0] - BS / 2}px ${p[1] - BS / 2}px`;
    let carrying = null;
    SK.forEach((j, i) => {
      const c0 = C0(i);
      let c = c0, sc = 1, rot = 0, op = clamp((t - (8.1 + i * 0.12)) / 0.3);
      if (t >= j.t0 && t < j.td) {
        const u = (t - j.t0) / (j.td - j.t0), uc = clamp((u - 0.15) / 0.85), e = easeIO(uc);
        c = bez(c0, ctrl(c0, j.T, 70), j.T, e);
        sc = 1 - 0.72 * e; rot = -9 * Math.sin(Math.PI * uc);
        carrying = c;
      } else if (t >= j.td) op = 0;
      j.chip.style.opacity = op * (t > 13.7 ? 0 : 1);
      j.chip.style.translate = `${c[0] - 200}px ${c[1] - 46}px`;
      j.chip.style.scale = sc;
      j.chip.style.rotate = rot + 'deg';
    });
    if (carrying) { tl.setAttribute('x1', p[0]); tl.setAttribute('y1', p[1]); tl.setAttribute('x2', carrying[0]); tl.setAttribute('y2', carrying[1]); tl.setAttribute('opacity', 0.95); } else tl.setAttribute('opacity', 0);
  }
  during(7.9, 14.0, (u, t) => frame(t));
  SK.forEach((j) => {
    const T = j.T;
    sfx(j.t0, 'zap'); sfx(j.td, 'pop');
    at(j.td, () => { j.slot.innerHTML = `✓&nbsp;${j.who}`; });
    pixBurst(j.td, T[0], T[1], [j.c, '#ffffff', '#0d9488'], 20, 120, 11);
    ringAt(j.td, T[0], T[1], j.c, 40, 0.7);
    const tag = place(E('div', 'name', `${j.who} <b>✓</b>`, hud), T[0] + 42, T[1]);
    A(tag, [{ opacity: 0, translate: '-14px 0' }, { opacity: 1, translate: '0 0' }], j.td + 0.05, 0.3, { ease: BACK });
    fade(tag, j.td + 1.2, 0.2);
    /* the widgets that agent runs light up, inside the real dashboard */
    at(j.td + 0.1, () => app.doc().querySelectorAll('.widget').forEach((el) => {
      const title = el.querySelector('.label')?.textContent.trim();
      const k = j.wid.indexOf(title);
      if (k < 0) return;
      el.animate([{ boxShadow: '0 0 0 0 rgba(13,148,136,0)', transform: 'scale(1)' }, { boxShadow: '0 0 0 7px rgba(13,148,136,.55)', transform: 'scale(1.035)', offset: 0.3 }, { boxShadow: '0 0 0 0 rgba(13,148,136,0)', transform: 'scale(1)' }], { duration: 1100, delay: k * 120, easing: 'ease-out', fill: 'backwards' });
    }));
  });

  /* ======== 14 - 26  THE DORM ROOM: drag them in, ask, they discuss ======== */
  zoom(13.9, 0.6, CTR[0], CTR[1], 1.2, IO);
  cap(14.4, 17.9, 'Drag_your ~team_in');
  cap(17.9, 26.0, 'Ask. *They_discuss.');
  const cur2 = mkCursor();
  cur2.style.opacity = 0;
  A(cur2, [{ opacity: 0 }, { opacity: 1 }], 14.0, 0.15, { ease: OUT });
  A(cur2, [{ opacity: 1 }, { opacity: 0 }], 25.4, 0.15, { ease: IN });
  const dnd = (t0, t1, mi, si, id) => {
    let dt = null;
    const q = (sel, i) => app.doc().querySelectorAll(sel)[i];
    const ev = (type, el) => el.dispatchEvent(new app.w.DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
    at(t0, () => { dt = new app.w.DataTransfer(); ev('dragstart', q('.member', mi)); });
    let entered = false;
    during(t0 + (t1 - t0) * 0.45, t1, () => { if (!entered) { entered = true; ev('dragenter', q('.seat', si)); } ev('dragover', q('.seat', si)); });
    at(t1, () => { ev('drop', q('.seat', si)); ev('dragend', q('.member', mi)); });
    const m = L.members[mi], s = L.seats[si], a = P(m.cx, m.cy), b = P(s.cx, s.cy);
    const gh = mkBuddy(id, 64, 'stand', cam);
    gh.style.opacity = 0;
    A(gh, [{ opacity: 1, translate: `${a[0] - 32}px ${a[1] - 32}px`, scale: 1.1, rotate: '-6deg' }, { opacity: 1, translate: `${b[0] - 32}px ${b[1] - 32}px`, scale: 1.25, rotate: '5deg' }], t0, t1 - t0, { ease: IO, fill: 'none' });
    pixBurst(t1, b[0], b[1], TEALS, 12, 70, 8, cam);
    sfx(t1, 'pop');
    return [a, b];
  };
  {
    const tb = P(L.table.cx, L.table.cy), start = P(1100, 600);
    const pts = [[14.0, start[0], start[1]], [14.25, tb[0], tb[1], IO]];
    app.click(14.35, L.table.cx, L.table.cy); clickFx(cur2, 14.35, tb[0], tb[1]);
    [['manager', 0, 0], ['finance', 2, 1], ['marketing', 1, 4], ['legal', 3, 3], ['assistant', 4, 2]].forEach(([id, mi, si], i) => {
      const t0 = 14.8 + i * 0.56, t1 = t0 + 0.46, [a, b] = dnd(t0, t1, mi, si, id);
      pts.push([t0 - 0.12, a[0], a[1], IO], [t0, a[0], a[1], LIN], [t1, b[0], b[1], IO]);
    });
    const bk = P(L.bank[0].cx, L.bank[0].cy), go = P(L.go.cx, L.go.cy);
    pts.push([17.85, bk[0], bk[1], IO], [18.3, go[0], go[1], IO]);
    cursorPath(cur2, pts);
    app.click(17.9, L.bank[0].cx, L.bank[0].cy); clickFx(cur2, 17.9, bk[0], bk[1]);
    app.click(18.35, L.go.cx, L.go.cy); clickFx(cur2, 18.35, go[0], go[1]);
    sfx(18.35, 'ding');
  }

  /* ======== 26 - 35  "DON'T LIKE YOUR CURRENT DASHBOARD? CUSTOMISE IT!" ======== */
  {
    const hm = P(L.home.cx, L.home.cy), cb = P(L.cust.cx, L.cust.cy), db = P(L.done.cx, L.done.cy), gp = P(L.go.cx, L.go.cy);
    const cx = L.cx, cy = L.cy, g = L.grid;
    const cur3 = mkCursor();
    cur3.style.opacity = 0;
    cursorPath(cur3, [[25.45, gp[0], gp[1]], [25.95, hm[0], hm[1], IO]]);
    A(cur3, [{ opacity: 0 }, { opacity: 1 }], 25.4, 0.1);
    A(cur3, [{ opacity: 1 }, { opacity: 0 }], 26.15, 0.15);
    app.click(26.0, L.home.cx, L.home.cy); clickFx(cur3, 26.0, hm[0], hm[1]);
    const veil = E('div', 'veil', '', hud);
    A(veil, [{ opacity: 0 }, { opacity: 1 }], 26.2, 0.3, { ease: OUT });
    A(veil, [{ opacity: 1 }, { opacity: 0 }], 28.0, 0.3, { ease: IN });
    words('Don’t like your current dashboard?', 960, 400, { t0: 26.3, t1: 27.95, size: 104, w: 1500, stag: 0.08 });
    words('*Customise it!', 960, 700, { t0: 27.0, t1: 27.95, slam: true, size: 170, stag: 0.1 });
    sfx(26.3, 'whoosh'); sfx(27.0, 'hit');
    cap(28.3, 35.0, 'Drag. Resize. ~Done.');

    const cur = mkCursor();
    cur.style.opacity = 0;
    A(cur, [{ opacity: 0 }, { opacity: 1 }], 28.2, 0.15, { ease: OUT });
    A(cur, [{ opacity: 1 }, { opacity: 0 }], 34.0, 0.2, { ease: IN });
    const S = (p) => P(p[0], p[1]);
    /* 1) shorten To-do (the red one): pull its corner up one row */
    const th = L.rs['To-do'], sh0 = [th.cx, th.cy], sh1 = [th.cx, th.cy - cy];
    /* 2) pull Contract risk (the orange one) left, under the shortened To-do */
    const ct = L.wid['Contract risk'], cg0 = [ct.x + ct.w * 0.45, ct.cy], cg1 = [cg0[0] - 2 * cx, cg0[1]];
    /* 3) pull Rival prices (2 of 3) down to fill the spot Contract risk left behind */
    const rv = L.rs['Rival prices'], rl0 = [rv.cx, rv.cy], rl1 = [rv.cx, rv.cy + cy];
    const start = P(1100, 220);
    cursorPath(cur, [[28.2, start[0], start[1]], [28.75, cb[0], cb[1], IO], [29.0, cb[0], cb[1], LIN], [29.55, ...S(sh0), IO], [30.2, ...S(sh1), IO], [30.45, ...S(cg0), IO], [31.25, ...S(cg1), IO], [31.5, ...S(rl0), IO], [32.2, ...S(rl1), IO], [32.9, db[0], db[1], IO]]);
    app.click(28.85, L.cust.cx, L.cust.cy); clickFx(cur, 28.85, cb[0], cb[1]);
    app.drag(29.6, 30.2, sh0, sh1);
    app.drag(30.5, 31.25, cg0, cg1);
    app.drag(31.55, 32.2, rl0, rl1);
    app.click(33.0, L.done.cx, L.done.cy); clickFx(cur, 33.0, db[0], db[1]);
    sfx(28.85, 'click'); sfx(30.2, 'pop'); sfx(31.25, 'pop'); sfx(32.2, 'pop'); sfx(33.0, 'ding');
    at(33.1, () => app.doc().querySelectorAll('.widget').forEach((el, i) => el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.03)', offset: 0.4 }, { transform: 'scale(1)' }], { duration: 700, delay: i * 50, easing: 'ease-out' })));
  }

  /* ======== 35 - 40  OUTRO ======== */
  {
    app.out(34.95, 0.2);
    zoom(35.0, 0.05, 960, 540, 1, LIN);
    flash(35.0, 0.4, '#0d9488'); sfx(35.0, 'hit');
    const wm2 = place(E('div', 'wm', '<div class="kmark">K</div><b>Kaunter</b>', hud), 960, 360);
    wm2.style.scale = 0.78;
    A(wm2, [{ opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1 }], 35.0, 0.45, { ease: BACK });
    words('Built_with *WorkBuddy', 960, 600, { t0: 35.6, size: 84, stag: 0.14 });
    ['manager', 'marketing', 'finance', 'legal', 'assistant'].forEach((id, i) => {
      const w = E('div', 'fx-abs', '', hud);
      w.style.cssText += `width:120px;height:120px;left:${560 + i * 200 - 60}px;top:740px`;
      mkBuddy(id, 120, 'stand', w);
      A(w, [{ opacity: 0, translate: '0 80px', scale: 0.4 }, { opacity: 1, translate: '0 0', scale: 1 }], 35.9 + i * 0.1, 0.4, { ease: BACK });
    });
    const w2 = E('div', 'fx-abs', '', hud);
    w2.style.cssText += 'width:150px;height:150px;left:1625px;top:715px';
    mkBuddy('wb', 150, 'stand', w2);
    A(w2, [{ opacity: 0, scale: 0.05, rotate: '-20deg' }, { opacity: 1, scale: 1, rotate: '0deg' }], 36.2, 0.4, { ease: BACK });
    pixBurst(36.2, 1700, 790, TEALS, 20, 160, 12); sfx(36.2, 'spawn');
    const end = E('div', '', '', hud);
    end.style.cssText = 'position:absolute;inset:0;background:#f1f4f4;opacity:0';
    A(end, [{ opacity: 0 }, { opacity: 1 }], 39.55, 0.45, { ease: LIN });
  }

  await document.fonts.ready;
  finish();
})();
