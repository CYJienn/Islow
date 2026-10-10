/* CUT C "Skills pulled in": 32 s, 120 bpm (1 beat = 0.5 s), 1920x1080, shows the CURRENT Next.js product (web/).
   0-3 pain | 3-4.5 logo drop | 4.5-6 dashboard | 6-18 WorkBuddy buddy spawns and pulls three skills into the team
   18-22 Manager routes | 22-26 human approves | 26-30 customise | 30-32 outro.
   No violent shake after the pain opener: only a 0.5 % zoom pulse on the beat. */
(async () => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'film-c.css';
  document.head.appendChild(link);
  await new Promise((r) => { link.onload = r; link.onerror = r; });
  await Promise.all(['500 20px Inter', '600 20px Inter', '700 20px Inter', '800 20px Inter', '500 20px "JetBrains Mono"', '700 20px "JetBrains Mono"'].map((f) => document.fonts.load(f)));
  try { localStorage.setItem('kaunter-theme', 'dark'); localStorage.removeItem('kaunter-layout-v3'); } catch (e) { /* ignore */ }

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, u) => a + (b - a) * u;
  const bez = (p0, p1, p2, u) => [(1 - u) * (1 - u) * p0[0] + 2 * (1 - u) * u * p1[0] + u * u * p2[0], (1 - u) * (1 - u) * p0[1] + 2 * (1 - u) * u * p1[1] + u * u * p2[1]];
  const bg = (t0, t1, css) => { const s = scene(t0, t1, '', bgl); E('div', 'bg', '', s).style.background = css; return s; };
  const pop = (el, t, dy = 26, dur = 0.38) => A(el, [{ opacity: 0, translate: `0 ${dy}px`, scale: 0.94 }, { opacity: 1, translate: '0 0', scale: 1 }], t, dur, { ease: BACK });
  const fade = (el, t, dur = 0.2) => A(el, [{ opacity: 1 }, { opacity: 0 }], t, dur, { ease: IN });
  const place = (el, x, y, w) => { el.style.left = x + 'px'; el.style.top = y + 'px'; if (w) el.style.width = w + 'px'; return el; };

  /* ---------- pixel buddies (same sprite + skins as web/components/Buddy.tsx) ---------- */
  const BASE = ['..oo........oo..', '.owwo......owwo.', '.owwoooooooowwo.', '.owwwwwwwwwwwwo.', 'hhowkkkkkkkkwohh', 'hhokkkkkkkkkkohh', 'hhokkkkkkkkkkohh', 'hhokkkkkkkkkkohh', 'hhokkkkkkkkkkohh', '.owwwwwwwwwwwwo.', '..oowwwwwwwwoo..', '..owwwwwwwwwwo..', '..owwwwsswwwwo..', '..oswwwwwwwwso..', '...oooooooooo...', '................'];
  const EYE = [[4, 5], [5, 5], [4, 6], [5, 6], [4, 7], [5, 7]];
  const FEET = { stand: [3, 4, 5, 10, 11, 12], step: [2, 3, 4, 11, 12, 13] };
  const SKINS = {
    wb: { w: '#f4f7ff', s: '#b9c4dd', eye: '#3ee6b0', acc: '#28b894', marks: [[7, 12], [8, 12], [7, 13], [8, 13], [2, 1], [13, 1]] },
    manager: { w: '#f4f7ff', s: '#b9c4dd', eye: '#3ee6b0', acc: '#ff7aa8', marks: [[7, 12], [8, 12], [7, 13], [8, 13]] },
    marketing: { w: '#ffd6e6', s: '#f0a3c3', eye: '#ff4d8d', acc: '#ff3d81', marks: [[2, 1], [3, 1], [2, 2], [3, 2]] },
    finance: { w: '#fff0b8', s: '#d9b95c', eye: '#ffc400', acc: '#e08a00', marks: [[7, 12], [8, 12]] },
    legal: { w: '#e9defc', s: '#b49ae6', eye: '#8a5cff', acc: '#5b2fc9', marks: [[7, 12], [8, 12], [6, 13], [9, 13]] },
    assistant: { w: '#d4e6ff', s: '#8fb0e6', eye: '#4aa8ff', acc: '#3b6fe0', marks: [[1, 9], [1, 10], [2, 10], [12, 9]] }
  };
  function drawBuddy(cv, id, pose = 'stand') {
    const k = SKINS[id], pal = { o: '#10162e', w: k.w, s: k.s, k: '#0a0f24', h: '#8794b4', e: k.eye, a: k.acc };
    const g = BASE.map((r) => r.split(''));
    EYE.forEach(([x, y]) => { g[y][x] = 'e'; g[y][15 - x] = 'e'; });
    [11, 12, 13].forEach((y) => { g[y][1] = 'h'; g[y][14] = 'h'; });
    FEET[pose].forEach((x) => { g[15][x] = 'h'; });
    k.marks.forEach(([x, y]) => { g[y][x] = 'a'; });
    const c = cv.getContext('2d');
    c.clearRect(0, 0, 16, 16);
    g.forEach((r, y) => r.forEach((ch, x) => { if (ch !== '.') { c.fillStyle = pal[ch]; c.fillRect(x, y, 1, 1); } }));
  }
  function mkBuddy(id, size, pose, parent) {
    const cv = E('canvas', 'px', '', parent);
    cv.width = cv.height = 16;
    cv.style.width = cv.style.height = size + 'px';
    drawBuddy(cv, id, pose);
    return cv;
  }
  function crown(parent, x, y, s = 8) {
    const cv = E('canvas', 'px', '', parent), rows = ['y..y..y', 'yyyyyyy', 'gyyryyg'], pal = { y: '#ffd23e', g: '#e08a00', r: '#ff4d6d' };
    cv.width = 7; cv.height = 3; cv.style.width = 7 * s + 'px'; cv.style.height = 3 * s + 'px';
    const c = cv.getContext('2d');
    rows.forEach((r, yy) => [...r].forEach((ch, xx) => { if (ch !== '.') { c.fillStyle = pal[ch]; c.fillRect(xx, yy, 1, 1); } }));
    cv.style.left = x - 3.5 * s + 'px'; cv.style.top = y - 1.5 * s + 'px';
    return cv;
  }
  function pixBurst(t, x, y, cols, n = 18, spread = 150, size = 12) {
    for (let i = 0; i < n; i++) {
      const q = E('div', 'pix', '', hud), a = rnd() * Math.PI * 2, d = rr(0.4, 1) * spread;
      q.style.cssText += `width:${size}px;height:${size}px;background:${cols[i % cols.length]};left:${x}px;top:${y}px`;
      A(q, [{ opacity: 1, translate: '0 0', scale: 1 }, { opacity: 1, translate: `${Math.cos(a) * d * 0.6}px ${Math.sin(a) * d * 0.6 - 20}px`, offset: 0.45 }, { opacity: 0, translate: `${Math.cos(a) * d}px ${Math.sin(a) * d + 36}px`, scale: 0.3 }], t, rr(0.5, 0.85), { ease: OUT });
    }
  }
  function ringAt(t, x, y, color, r = 70, hold = 0.6) {
    const e = E('div', '', '', hud);
    e.style.cssText = `position:absolute;left:${x - r}px;top:${y - r}px;width:${2 * r}px;height:${2 * r}px;border-radius:50%;border:6px solid ${color};opacity:0`;
    A(e, [{ opacity: 0.95, scale: 0.3 }, { opacity: 0, scale: 2 }], t, hold, { ease: OUT });
  }

  /* ---------- captions + section chips ---------- */
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
  function sect(t0, t1, n, label, color) {
    const s = E('div', 'sect', `<i></i>${n} <em>/</em> ${label}`, hud);
    s.style.setProperty('--c', color);
    A(s, [{ opacity: 0, translate: '-40px 0' }, { opacity: 1, translate: '0 0' }], t0, 0.35, { ease: OUT });
    fade(s, t1 - 0.1, 0.12);
  }

  /* ---------- backgrounds ---------- */
  bg(0, 3, 'radial-gradient(900px 620px at 50% 50%, #2b0a14 0%, transparent 70%), #0b0a0b');
  const lit = bg(3, 32, 'radial-gradient(1000px 700px at 8% -10%, rgba(192,24,63,.24) 0%, transparent 60%), radial-gradient(900px 600px at 100% 110%, rgba(40,184,148,.10) 0%, transparent 60%), #0b0a0b');
  E('div', 'dots', '', lit);

  /* ---------- the real dashboard (Next.js app, proxied same-origin by render.mjs) ---------- */
  const AX = 700, AY = 190, S = 0.9;
  const app = new App({ x: AX, y: AY, s: S, vw: 1280, vh: 720, kind: 'kn', r: 22, url: '/' });
  await app.load();
  { const st = app.doc().createElement('style'); st.textContent = 'nextjs-portal{display:none!important}'; app.doc().head.appendChild(st); }
  const L = await scout(async (a) => {
    const rc = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; };
    const btn = (txt) => [...a.doc().querySelectorAll('button')].find((b) => b.textContent.trim() === txt);
    const o = { rail: [...a.doc().querySelectorAll('.rail nav .rail-item')].map(rc), theme: rc(a.q('.theme')), cust: rc(btn('Customise')), wid: {} };
    a.doc().querySelectorAll('.widget').forEach((el) => { o.wid[el.querySelector('h4').textContent] = rc(el); });
    o.grid = rc(a.q('.canvas'));
    o.cell = o.grid.w / 12;
    btn('Customise').click();
    await sleep(500);
    o.done = rc(btn('Done'));
    o.rs = {};
    a.doc().querySelectorAll('.widget').forEach((el) => { const h = el.querySelector('.resize'); if (h) o.rs[el.querySelector('h4').textContent] = rc(h); });
    return o;
  }, { x: AX, y: AY, s: S, vw: 1280, vh: 720, kind: 'kn', r: 22, url: '/' });
  const rb = L.rail.map((r) => app.st(r.cx, r.cy)); /* stage coords of the five rail buddies: manager, marketing, finance, legal, assistant */

  /* ======== 0 - 3  PAIN ======== */
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
    const el = E('div', 'nt ' + n.c, `<i></i><div><b>${n.t}</b><span>${n.s}</span></div>`, pain), t = 0.05 + i * 0.3;
    const tx = n.x - 235, ty = n.y - 45;
    A(el, [{ opacity: 0, translate: `${tx}px ${ty - 70}px`, scale: 1.5, rotate: `${n.r * 3}deg` }, { opacity: 1, translate: `${tx}px ${ty}px`, scale: 1, rotate: `${n.r}deg` }], t, 0.24, { ease: OUT });
    sfx(t, 'ping');
  });
  const b99 = E('div', 'badge99', '3', hud);
  place(b99, 1700, 56);
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

  /* ======== 3 - 4.5  DROP ======== */
  flash(3.0, 0.45, '#c0183f');
  sfx(3.0, 'hit');
  const wm = E('div', 'wm', '<div class="kmark">K</div><b>Kaunter</b>', hud);
  place(wm, 960, 450);
  A(wm, [{ opacity: 0, scale: 2.6, filter: 'blur(24px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)' }], 3.0, 0.4, { ease: OUT });
  A(wm, [{ opacity: 1, scale: 1 }, { opacity: 0, scale: 1.12 }], 4.35, 0.2, { ease: IN });
  words('Your_AI_team. ~One_dashboard.', 960, 700, { t0: 3.5, t1: 4.35, size: 84, stag: 0.14 });
  const mini = E('div', 'mini', '<div class="kmark">K</div><b>Kaunter</b>', hud);
  mini.style.left = '1640px';
  A(mini, [{ opacity: 0, translate: '0 -20px' }, { opacity: 1, translate: '0 0' }], 4.5, 0.4, { ease: OUT });
  beatPulse(3.0, 30.0, 0.5, 0.0055);

  /* ======== 4.5 - 6  DASHBOARD ======== */
  app.in(4.5, { scale: 0.86, translate: '0 70px', rotate: '0deg' }, 0.6);
  at(4.5, () => app.doc().querySelectorAll('.widget').forEach((el, i) => el.animate([{ opacity: 0, transform: 'translateY(34px) scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 120 + i * 70, easing: OUT, fill: 'backwards' })));
  cap(4.6, 6.0, 'Meet_your ~AI_team');
  sect(4.6, 6.0, '00', 'Kaunter', '#c0183f');
  for (let i = 0; i < 5; i++) { /* the five characters in the rail get a ring in their own colour */
    const c = E('div', '', '', hud);
    c.style.cssText = `position:absolute;left:${rb[i][0] - 27}px;top:${rb[i][1] - 27}px;width:54px;height:54px;border-radius:50%;box-shadow:0 0 0 4px ${['#3ee6b0', '#ff4d8d', '#ffc400', '#9a73ff', '#4aa8ff'][i]};opacity:0`;
    A(c, [{ opacity: 0.9, scale: 0.6 }, { opacity: 0, scale: 1.7 }], 5.0 + i * 0.1, 0.5, { ease: OUT });
  }

  /* ======== 6 - 18  WORKBUDDY SPAWNS AND PULLS THREE SKILLS ======== */
  const SK = [
    { k: 'mk', file: 'marketing.skill', sub: 'reviews · rivals · campaigns', c: '#ff4d8d', who: 'Marketing', idx: 1, t0: 7.0, td: 8.0, out: 10.4 },
    { k: 'fin', file: 'finance.skill', sub: 'invoice checks · fraud flags', c: '#ffc400', who: 'Finance', idx: 2, t0: 10.5, td: 11.5, out: 13.9 },
    { k: 'leg', file: 'legal.skill', sub: 'law handbook · contracts', c: '#9a73ff', who: 'Legal', idx: 3, t0: 14.0, td: 15.0, out: 17.9 }
  ];
  const FILE = '<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#04201a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>';
  const shelf = E('div', 'shelf', '<div class="hd"><i></i>WorkBuddy <em>skills</em></div>', hud);
  A(shelf, [{ opacity: 0, translate: '-90px 0' }, { opacity: 1, translate: '0 0' }], 5.3, 0.5, { ease: BACK });
  fade(shelf, 17.9, 0.25);
  sfx(5.3, 'whoosh');
  const slotY = (i) => 230 + i * 112, C0 = (i) => [300, slotY(i) + 48];
  SK.forEach((j, i) => {
    j.slot = E('div', 'slot', '', shelf);
    j.slot.style.top = slotY(i) - 150 + 'px';
    j.slot.style.opacity = 1;
    j.chip = E('div', 'skill', `${FILE}<div><b>${j.file}</b><span>${j.sub}</span></div>`, hud);
    j.T = [rb[j.idx][0], rb[j.idx][1]];
  });

  /* the WorkBuddy buddy: one position/pose function of film time */
  const H = [300, 770], BS = 150;
  const wbPos = E('div', 'fx-abs', '', hud), wbFx = E('div', 'fx-abs', '', wbPos);
  wbPos.style.width = wbPos.style.height = wbFx.style.width = wbFx.style.height = BS + 'px';
  wbPos.style.opacity = 1;
  wbFx.style.opacity = 0;
  const wbA = mkBuddy('wb', BS, 'stand', wbFx), wbB = mkBuddy('wb', BS, 'step', wbFx);
  wbA.style.opacity = wbB.style.opacity = 1;
  wbB.style.visibility = 'hidden';
  const wbName = E('div', 'name', '<b>●</b> WorkBuddy', hud);
  wbName.style.setProperty('--c', '#28b894');
  place(wbName, H[0] - 70, H[1] - 110);
  A(wbFx, [{ opacity: 1, scale: 0.05, rotate: '-25deg' }, { opacity: 1, scale: 1.25, rotate: '6deg', offset: 0.6 }, { opacity: 1, scale: 1, rotate: '0deg' }], 6.0, 0.45, { ease: OUT });
  pixBurst(6.0, H[0], H[1], ['#28b894', '#3ee6b0', '#f4f7ff', '#28b894'], 26, 190, 14);
  ringAt(6.0, H[0], H[1], '#28b894', 90, 0.7);
  sfx(6.0, 'spawn');
  A(wbName, [{ opacity: 0, translate: '0 14px' }, { opacity: 1, translate: '0 0' }], 6.35, 0.3, { ease: BACK });
  fade(wbName, 6.95, 0.2);
  A(wbFx, [{ opacity: 1, scale: 1 }, { opacity: 0, scale: 0.2, translate: '0 40px' }], 17.95, 0.3, { ease: IN });
  pixBurst(18.0, H[0], H[1], ['#28b894', '#3ee6b0', '#f4f7ff'], 16, 140, 12);
  cap(6.0, 7.95, '*WorkBuddy brings_the_skills');
  sect(6.0, 8.0, '', 'WorkBuddy', '#28b894');

  const Aof = (j, i) => [C0(i)[0] + 295, C0(i)[1]];            /* where the buddy takes hold of a chip */
  const Tof = (j) => [j.T[0] - 70, j.T[1]];                     /* where it ends up beside the team member */
  const ctrl = (a, b, lift) => [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - lift];
  const segs = [];
  SK.forEach((j, i) => {
    const a = Aof(j, i), tt = Tof(j);
    segs.push({ t0: j.t0 - 0.5, t1: j.t0, f: (u) => [lerp(H[0], a[0], easeOut(u)), lerp(H[1], a[1], easeOut(u)) - 40 * Math.sin(Math.PI * u)] });
    segs.push({ t0: j.t0, t1: j.td, f: (u) => bez(a, ctrl(a, tt, 150), tt, easeIO(u)) });
    segs.push({ t0: j.td + 0.15, t1: j.td + 0.75, f: (u) => { const e = easeIO(u); return [lerp(tt[0], H[0], e), lerp(tt[1], H[1], e) - 60 * Math.sin(Math.PI * u)]; } });
  });
  const tether = E('div', 'tether', '<svg width="1920" height="1080"><line x1="0" y1="0" x2="0" y2="0" stroke="#28b894" stroke-width="5" stroke-dasharray="3 14" stroke-linecap="round" opacity="0"/></svg>', hud);
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
      let c = c0, sc = 1, rot = 0, op = clamp((t - (5.5 + i * 0.12)) / 0.3);
      if (t >= j.t0 && t < j.td) {
        const u = (t - j.t0) / (j.td - j.t0), uc = clamp((u - 0.15) / 0.85), e = easeIO(uc);
        c = bez(c0, ctrl(c0, j.T, 70), j.T, e);
        sc = 1 - 0.72 * e; rot = -9 * Math.sin(Math.PI * uc);
        carrying = c;
      } else if (t >= j.td) op = 0;
      j.chip.style.opacity = op * (t > 18 ? 0 : 1);
      j.chip.style.translate = `${c[0] - 220}px ${c[1] - 48}px`;
      j.chip.style.scale = sc;
      j.chip.style.rotate = rot + 'deg';
    });
    if (carrying) { tl.setAttribute('x1', p[0]); tl.setAttribute('y1', p[1]); tl.setAttribute('x2', carrying[0]); tl.setAttribute('y2', carrying[1]); tl.setAttribute('opacity', 0.95); }
    else tl.setAttribute('opacity', 0);
  }
  during(5.3, 18.2, (u, t) => frame(t));

  const PL = 860, PT = 230;
  SK.forEach((j, i) => {
    const T = j.T;
    at(j.td, () => { j.slot.innerHTML = `✓&nbsp;in&nbsp;${j.who}`; });
    pixBurst(j.td, T[0], T[1], [j.c, '#ffffff', '#28b894'], 22, 130, 11);
    ringAt(j.td, T[0], T[1], j.c, 40, 0.7);
    sfx(j.t0, 'zap');
    sfx(j.td, 'pop');
    const sc = E('div', 'scrim', '', hud);
    sc.style.left = '780px'; sc.style.top = AY + 'px'; sc.style.width = '1072px'; sc.style.height = 648 * 1 + 'px';
    A(sc, [{ opacity: 0 }, { opacity: 1 }], j.td, 0.3, { ease: OUT });
    fade(sc, j.out, 0.25);
    const pn = E('div', 'fp', '', hud);
    pn.style.setProperty('--c', j.c);
    pn.style.left = PL + 'px'; pn.style.top = PT + 'px';
    A(pn, [{ opacity: 0, scale: 0.6, translate: '-140px 0' }, { opacity: 1, scale: 1, translate: '0 0' }], j.td, 0.5, { ease: BACK });
    A(pn, [{ opacity: 1, scale: 1 }, { opacity: 0, scale: 0.96, translate: '0 -24px' }], j.out, 0.25, { ease: IN });
    j.pn = pn;
    sect(j.td - 0.4, j.out + 0.1, '0' + (i + 1), j.who, j.c);
  });
  cap(10.5, 11.45, 'Pull_in_the_next_skill');
  cap(14.0, 14.95, '*One_more_skill');

  /* --- marketing panel: ML sentiment model --- */
  {
    const j = SK[0], p = j.pn, t = j.td, u = (el, x, y, w) => place(el, x, y, w);
    const hd = E('div', 'hd', '', p); mkBuddy('marketing', 70, 'stand', hd).style.position = 'static';
    hd.insertAdjacentHTML('beforeend', '<div><h3>Marketing lead</h3><p>Trained ML model reads reviews</p></div><span class="tagx">ML MODEL</span>');
    pop(hd, t + 0.2);
    const lab1 = u(E('div', 'lab row', 'Customer reviews → 1–5 stars', p), 36, 134); pop(lab1, t + 0.35, 16);
    const bars = u(E('div', 'bars row', '', p), 36, 168); bars.style.width = '350px';
    [['5', 46], ['4', 31], ['3', 14], ['2', 9], ['1', 12]].forEach(([n, v], i) => {
      const r = E('div', '', `<em>${n}★</em><s></s><span class="mono">${v}</span>`, bars), s = $('s', r);
      s.style.setProperty('--c', i < 2 ? '#ff4d8d' : i === 2 ? '#a8a2a0' : '#6d6668');
      A(s, [{ width: '0px' }, { width: v * 5.2 + 'px' }], t + 0.55 + i * 0.1, 0.5, { ease: OUT });
    });
    u(E('div', 'lab row', 'Average sentiment', p), 430, 134);
    const big = u(E('div', 'big row mono', '0.0<small>★</small>', p), 430, 166); big.style.setProperty('--c', '#ff4d8d');
    counter(big.firstChild, t + 0.6, t + 1.3, 0, 3.8, (v) => v.toFixed(1));
    const c1 = u(E('div', 'chip row', '112 reviews read', p), 430, 282), c2 = u(E('div', 'chip row', 'Rival: 20% off weekend · web search', p), 430, 330);
    c2.style.borderRadius = '999px'; c2.style.color = '#f2a14a';
    pop(c1, t + 0.9, 14); pop(c2, t + 1.1, 14);
    u(E('div', 'lab row', 'Ranked campaigns', p), 36, 372);
    [['Weekend flour + oil bundle', 92], ['WhatsApp reorder reminder', 81]].forEach(([n, s], i) => {
      const r = u(E('div', 'camp row', `<b>${i + 1}</b><span>${n}</span><em>${s}</em>`, p), 36, 402 + i * 60, 748); r.style.setProperty('--c', '#ff4d8d');
      pop(r, t + 1.3 + i * 0.25, 20); sfx(t + 1.3 + i * 0.25, 'tick');
    });
    cap(8.0, 10.5, 'Marketing · ~an_ML_model_reads_your_reviews');
  }
  /* --- finance panel: fraud checks --- */
  {
    const j = SK[1], p = j.pn, t = j.td, u = place;
    const hd = E('div', 'hd', '', p); mkBuddy('finance', 70, 'stand', hd).style.position = 'static';
    hd.insertAdjacentHTML('beforeend', '<div><h3>Finance &amp; Ops lead</h3><p>Checks invoices before you pay</p></div><span class="tagx">FRAUD CHECK</span>');
    pop(hd, t + 0.2);
    const inv = u(E('div', 'invc row', '<div>INV-2291<span>Syarikat Tepung Maju</span></div><div class="mono">RM 4,820.00</div>', p), 36, 132, 748); pop(inv, t + 0.4, 18);
    const rows = [['', '✓', 'Amount matches the purchase order'], ['w', '!', 'Bank account differs from vendor master'], ['w', '!', 'Same reference as INV-2188 (duplicate?)']];
    rows.forEach(([k, ic, tx], i) => {
      const r = u(E('div', 'chk row ' + k, `<span class="ic">${ic}</span><span>${tx}</span>`, p), 36, 236 + i * 76, 748);
      pop(r, t + 0.8 + i * 0.4, 20); sfx(t + 0.8 + i * 0.4, i ? 'stamp' : 'tick');
    });
    const st = u(E('div', 'stamp', 'HELD FOR YOUR REVIEW', p), 190, 468);
    A(st, [{ opacity: 0, scale: 3, rotate: '-12deg' }, { opacity: 1, scale: 1, rotate: '-4deg' }], t + 2.0, 0.22, { ease: OUT });
    sfx(t + 2.0, 'stamp');
    E('div', 'demo', 'Demo data · flagged as suspected, not confirmed', p);
    cap(11.5, 14.0, 'Finance · ~fraud_checks_before_you_pay');
  }
  /* --- legal panel: RAG over Malaysian law --- */
  {
    const j = SK[2], p = j.pn, t = j.td, u = place;
    const hd = E('div', 'hd', '', p); mkBuddy('legal', 70, 'stand', hd).style.position = 'static';
    hd.insertAdjacentHTML('beforeend', '<div><h3>Legal Team lead</h3><p>Answers from Malaysian law, cited</p></div><span class="tagx">RAG</span>');
    pop(hd, t + 0.2);
    const ask = u(E('div', 'ask row', '<span class="q"></span><i></i>', p), 36, 124, 748), q = $('.q', ask); pop(ask, t + 0.35, 14);
    during(t + 0.5, t + 1.5, (pp) => { q.textContent = 'Can I charge a late fee on unpaid invoices?'.slice(0, Math.round(pp * 43)); });
    const ans = u(E('div', 'ans row', 'Yes, if it is a fair estimate of your loss. Courts award reasonable compensation, not a penalty.', p), 36, 224, 748); pop(ans, t + 1.6, 20); sfx(t + 1.6, 'ding');
    const BOOK = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#d6c6ff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/></svg>';
    const c1 = u(E('div', 'cite row', BOOK + 'Contracts Act 1950 · s.74', p), 36, 396), c2 = u(E('div', 'cite row', BOOK + 'Supplier playbook · late payment', p), 36, 456);
    pop(c1, t + 2.0, 14); pop(c2, t + 2.2, 14); sfx(t + 2.0, 'tick'); sfx(t + 2.2, 'tick');
    const am = u(E('div', 'chip row', '<span style="color:#f2a14a">●</span>&nbsp; Amber · you approve before it is sent', p), 380, 462);
    pop(am, t + 2.5, 14);
    cap(15.0, 18.0, 'Legal · ~answers_from_Malaysian_law');
  }

  /* ======== 18 - 22  THE MANAGER ROUTES ======== */
  {
    const G = ['#ff4d8d', '#ffc400', '#9a73ff'], X = [480, 960, 1440], MY = 400, SY = 720;
    app.out(17.95, 0.25);
    sect(18.0, 22.0, '04', 'The Manager', '#3ee6b0');
    cap(18.2, 22.0, 'One ~Manager routes_every_task');
    const ln = E('div', 'tether', `<svg width="1920" height="1080"><g stroke="#2e2a2b" stroke-width="4" stroke-linecap="round"><path d="M960 240 L960 330"/>${X.map((x) => `<path d="M960 480 L${x} 640"/>`).join('')}</g></svg>`, hud);
    ln.style.opacity = 0;
    A(ln, [{ opacity: 0 }, { opacity: 1 }], 18.2, 0.4, { ease: OUT });
    A(ln, [{ opacity: 1 }, { opacity: 0 }], 21.85, 0.15, { ease: IN });
    const mg = E('div', 'fx-abs', '', hud);
    mg.style.cssText += 'width:180px;height:180px;left:870px;top:310px';
    mkBuddy('manager', 180, 'stand', mg); crown(mg, 90, -14, 9);
    A(mg, [{ opacity: 0, scale: 0.3, translate: '0 60px' }, { opacity: 1, scale: 1, translate: '0 0' }], 18.1, 0.45, { ease: BACK });
    A(mg, [{ opacity: 1 }, { opacity: 0 }], 21.85, 0.15, { ease: IN });
    pixBurst(18.1, 960, MY, ['#3ee6b0', '#f4f7ff', '#ffd23e'], 20, 150, 12);
    sfx(18.1, 'pop');
    const mgl = E('div', 'lab2', 'Manager<small>one front door</small>', hud); place(mgl, 960, 500); pop(mgl, 18.5, 14);
    fade(mgl, 21.85, 0.15);
    const owner = E('div', 'bub', 'Can I afford this promo, and is my supplier contract safe?', hud); place(owner, 960, 170);
    A(owner, [{ opacity: 0, scale: 0.6, translate: '0 -40px' }, { opacity: 1, scale: 1, translate: '0 0' }], 18.4, 0.45, { ease: BACK }); sfx(18.4, 'whoosh');
    fade(owner, 21.85, 0.15);
    ['marketing', 'finance', 'legal'].forEach((id, i) => {
      const w = E('div', 'fx-abs', '', hud); w.style.cssText += `width:130px;height:130px;left:${X[i] - 65}px;top:${SY - 65}px`;
      mkBuddy(id, 130, 'stand', w);
      A(w, [{ opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1 }], 18.7 + i * 0.12, 0.4, { ease: BACK });
      fade(w, 21.85, 0.15);
      const lb = E('div', 'lab2', `${['Marketing', 'Finance', 'Legal'][i]}<small>${['ML sentiment', 'fraud checks', 'law RAG'][i]}</small>`, hud); place(lb, X[i], SY + 78); pop(lb, 18.9 + i * 0.12, 14);
      fade(lb, 21.85, 0.15);
      const dn = E('div', 'dot', '', hud), up = E('div', 'dot', '', hud);
      dn.style.setProperty('--c', G[i]); up.style.setProperty('--c', G[i]);
      dn.style.offsetPath = `path('M960 480 L${X[i]} 640')`; up.style.offsetPath = `path('M${X[i]} 640 L960 480')`;
      A(dn, [{ offsetDistance: '0%', opacity: 1 }, { offsetDistance: '100%', opacity: 1 }], 19.3 + i * 0.1, 0.55, { ease: IO });
      A(dn, [{ opacity: 1 }, { opacity: 0 }], 19.85 + i * 0.1, 0.06);
      A(up, [{ offsetDistance: '0%', opacity: 1 }, { offsetDistance: '100%', opacity: 1 }], 20.3 + i * 0.1, 0.55, { ease: IO });
      A(up, [{ opacity: 1 }, { opacity: 0 }], 20.85 + i * 0.1, 0.06);
      sfx(19.3 + i * 0.1, 'zap'); sfx(20.85 + i * 0.1, 'tick');
    });
    const dd = E('div', 'dot', '', hud); dd.style.setProperty('--c', '#c0183f'); dd.style.offsetPath = "path('M960 240 L960 330')";
    A(dd, [{ offsetDistance: '0%', opacity: 1 }, { offsetDistance: '100%', opacity: 1 }], 18.9, 0.4, { ease: IO }); A(dd, [{ opacity: 1 }, { opacity: 0 }], 19.3, 0.06);
    const ans = E('div', 'bub a', 'Promo fits your budget. One contract clause needs a fix.', hud); place(ans, 960, 905);
    A(ans, [{ opacity: 0, scale: 0.7, translate: '0 40px' }, { opacity: 1, scale: 1, translate: '0 0' }], 21.4, 0.4, { ease: BACK }); sfx(21.4, 'ding');
    A(ans, [{ opacity: 1 }, { opacity: 0 }], 21.88, 0.12, { ease: IN });
  }

  /* ======== 22 - 26  YOU DECIDE (human in the loop) ======== */
  {
    sect(22.0, 26.0, '05', 'You decide', '#c0183f');
    cap(22.2, 26.0, 'You_approve. Nothing_goes_out ~without_you');
    const hdn = E('div', 'note', 'Every legal task gets a <b>risk tier</b>', hud); place(hdn, 470, 205); A(hdn, [{ opacity: 0 }, { opacity: 1 }], 22.1, 0.3, { ease: OUT }); fade(hdn, 25.85, 0.15);
    [['Green', 'agent finishes it', '#28b894', 250], ['Amber', 'you approve first', '#f2a14a', 400], ['Red', 'stops · lawyer brief only', '#ff5a63', 550]].forEach(([n, s, c, y], i) => {
      const e = E('div', 'tier', `<i></i>${n}<span>${s}</span>`, hud); e.style.setProperty('--c', c); e.style.top = y + 'px';
      A(e, [{ opacity: 0, translate: '-120px 0', scale: 0.8 }, { opacity: 1, translate: '0 0', scale: 1 }], 22.2 + i * 0.5, 0.4, { ease: BACK }); sfx(22.2 + i * 0.5, 'pop');
      fade(e, 25.85, 0.15);
    });
    const cd = E('div', 'apv', '<h3>Finance report</h3><div class="st"><i></i>Needs your approval</div><p><b>5 invoices</b> checked.<br><b>2</b> flagged for review.</p><div class="btn ho">Hold</div><div class="btn ok">Approve</div><div class="btn done">✓ Approved</div>', hud);
    A(cd, [{ opacity: 0, translate: '160px 0', scale: 0.85 }, { opacity: 1, translate: '0 0', scale: 1 }], 23.2, 0.5, { ease: BACK }); sfx(23.2, 'whoosh');
    fade(cd, 25.85, 0.15);
    const ok = $('.ok', cd), dn = $('.done', cd);
    A(ok, [{ opacity: 1 }, { opacity: 0 }], 24.9, 0.1); A(dn, [{ opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1 }], 24.9, 0.25, { ease: BACK });
    const c2 = E('div', 'cursor', '<svg viewBox="0 0 44 44" width="44" height="44"><path d="M6 4 L6 34 L14 27 L19 39 L25 36.5 L20 25 L31 25 Z" fill="#fff" stroke="#0a0f24" stroke-width="2.5" stroke-linejoin="round"/></svg>', hud);
    c2.style.zIndex = 60; c2.style.opacity = 0;
    A(c2, [{ opacity: 0 }, { opacity: 1 }], 24.0, 0.2, { ease: OUT });
    cursorPath(c2, [[24.0, 1760, 900], [24.85, 1520, 704, IO]]);
    A(c2, [{ opacity: 1, scale: 1 }, { opacity: 1, scale: 0.8 }, { opacity: 1, scale: 1 }], 24.9, 0.22, { ease: OUT });
    A(c2, [{ opacity: 1 }, { opacity: 0 }], 25.85, 0.15);
    ringAt(24.9, 1520, 704, '#e0587a', 50, 0.5); sfx(24.9, 'click');
    pixBurst(24.95, 1500, 704, ['#28b894', '#ffffff', '#c0183f'], 20, 150, 10);
    const ts = E('div', 'toast', '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#28b894" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>Report sent to Telegram + Outlook', hud);
    place(ts, 1370 - 330, 870);
    A(ts, [{ opacity: 0, translate: '0 30px', scale: 0.9 }, { opacity: 1, translate: '0 0', scale: 1 }], 25.1, 0.4, { ease: BACK }); sfx(25.1, 'ding');
    fade(ts, 25.85, 0.15);
    const nt = E('div', 'note', 'Approval sends the report. <b>It never moves money.</b>', hud); place(nt, 1370, 820);
    A(nt, [{ opacity: 0 }, { opacity: 1 }], 24.0, 0.3, { ease: OUT }); fade(nt, 25.85, 0.15);
  }

  /* ======== 26 - 30  MAKE IT YOURS (the real dashboard, driven by scripted pointer events) ======== */
  {
    const cx = AX + 640 * S, cy = AY + 360 * S;
    const w = L.wid, cell = L.cell, G0 = L.grid;
    app.in(25.95, { scale: 0.9, translate: '0 40px', rotate: '0deg' }, 0.5);
    sect(26.0, 30.0, '06', 'Your dashboard', '#e0587a');
    cap(26.2, 30.0, 'Drag, ~resize, make_it_yours');
    zoom(26.0, 0.9, cx, cy, 1.3, IO);
    const cur = mkCursor();
    cur.style.opacity = 0;
    A(cur, [{ opacity: 0 }, { opacity: 1 }], 26.1, 0.2, { ease: OUT });
    A(cur, [{ opacity: 1 }, { opacity: 0 }], 29.8, 0.12, { ease: IN });
    const P = (x, y) => app.st(x, y);
    const cold = w['Cold room'], rsH = L.rs['Spend'];
    const a0 = P(cold.cx, cold.y + 40), a1 = P(cold.cx, cold.y + 40 + 2 * cell);
    const r0 = P(rsH.cx, rsH.cy), r1 = P(G0.x + 12 * cell, G0.y + 2 * cell);
    const cb = P(L.cust.cx, L.cust.cy), db = P(L.done.cx, L.done.cy), th = P(L.theme.cx, L.theme.cy), c0 = P(900, 500);
    cursorPath(cur, [[26.1, c0[0], c0[1]], [26.8, cb[0], cb[1], IO], [27.2, a0[0], a0[1], IO], [28.0, a1[0], a1[1], IO], [28.25, r0[0], r0[1], IO], [28.95, r1[0], r1[1], IO], [29.2, db[0], db[1], IO], [29.55, th[0], th[1], IO]]);
    app.click(27.0, L.cust.cx, L.cust.cy); clickFx(cur, 27.0, cb[0], cb[1]);
    app.drag(27.2, 28.0, [cold.cx, cold.y + 40], [cold.cx, cold.y + 40 + 2 * cell]);
    app.drag(28.25, 28.95, [rsH.cx, rsH.cy], [G0.x + 12 * cell, G0.y + 2 * cell]);
    app.click(29.25, L.done.cx, L.done.cy); clickFx(cur, 29.25, db[0], db[1]);
    app.click(29.6, L.theme.cx, L.theme.cy); clickFx(cur, 29.6, th[0], th[1]);
    for (let i = 0; i < 3; i++) sfx(27.2 + i * 0.3, 'tick');
    sfx(28.95, 'pop'); sfx(27.95, 'pop');
  }

  /* ======== 30 - 32  OUTRO ======== */
  {
    app.out(29.98, 0.15);
    zoom(30.0, 0.05, 960, 540, 1, LIN);
    flash(30.0, 0.5, '#c0183f'); sfx(30.0, 'hit');
    const wm2 = E('div', 'wm', '<div class="kmark">K</div><b>Kaunter</b>', hud);
    place(wm2, 960, 360); wm2.style.scale = 0.78;
    A(wm2, [{ opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1 }], 30.0, 0.45, { ease: BACK });
    words('An_AI_team_for_every_small_business.', 960, 540, { t0: 30.35, size: 52, stag: 0 });
    words('Built_with *WorkBuddy', 960, 650, { t0: 30.55, size: 76, stag: 0.14 });
    ['manager', 'marketing', 'finance', 'legal', 'assistant'].forEach((id, i) => {
      const w = E('div', 'fx-abs', '', hud), x = 560 + i * 200;
      w.style.cssText += `width:120px;height:120px;left:${x - 60}px;top:760px`;
      mkBuddy(id, 120, 'stand', w);
      A(w, [{ opacity: 0, translate: '0 80px', scale: 0.4 }, { opacity: 1, translate: '0 0', scale: 1 }], 30.5 + i * 0.1, 0.4, { ease: BACK });
    });
    const w2 = E('div', 'fx-abs', '', hud); w2.style.cssText += 'width:150px;height:150px;left:1625px;top:735px';
    mkBuddy('wb', 150, 'stand', w2);
    A(w2, [{ opacity: 0, scale: 0.05, rotate: '-20deg' }, { opacity: 1, scale: 1, rotate: '0deg' }], 30.6, 0.4, { ease: BACK });
    pixBurst(30.6, 1700, 810, ['#28b894', '#3ee6b0', '#f4f7ff'], 20, 160, 12); sfx(30.6, 'spawn');
    cap(30.4, 32.0, '~Kaunter · *WorkBuddy_skills');
  }

  await document.fonts.ready;
  finish();
})();
