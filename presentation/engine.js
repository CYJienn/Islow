/* Showcase film engine. Everything is a pure function of the film time t:
   - film-level animations are paused Web Animations whose currentTime is set to t,
   - the real dashboard runs in iframes; scripted pointer events fire at exact film times and its CSS
     animations/transitions are adopted (paused) and stepped to t too,
   - Playwright's fake clock steps the dashboard's own timers/rAF one frame at a time (see render.mjs).
   Nothing here depends on wall-clock time, so the render is deterministic and never stutters. */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const shakeEl = $('#shake'), cam = $('#cam'), hud = $('#fx'), bgl = $('#bgl');
const OUT = 'cubic-bezier(.22,1,.36,1)', BACK = 'cubic-bezier(.34,1.56,.64,1)', IO = 'cubic-bezier(.65,0,.35,1)', IN = 'cubic-bezier(.55,0,1,.45)', LIN = 'linear';
const st = { anims: [], events: [], sfx: [], apps: [], adopt: new Map() };
let seed = 20261010;
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const rr = (a, b) => a + (b - a) * rnd();
const easeIO = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
const easeOut = (p) => 1 - Math.pow(1 - p, 3);
const sfx = (t, name) => st.sfx.push([t, name]);

function E(tag, cls, html, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  (parent === undefined ? cam : parent) && (parent === undefined ? cam : parent).appendChild(e);
  return e;
}
/* paused Web Animation, active from t0 for dur seconds, holds its end state afterwards */
function A(node, kf, t0, dur, o = {}) {
  const a = node.animate(kf, { duration: Math.max(1, dur * 1000), delay: t0 * 1000, fill: o.fill || 'forwards', easing: o.ease || OUT });
  a.pause();
  a.currentTime = 0;
  st.anims.push(a);
  return a;
}
function scene(t0, t1, cls = '', parent = cam) {
  const s = E('div', 'scene ' + cls, '', parent);
  A(s, [{ visibility: 'visible' }, { visibility: 'visible' }], t0, t1 - t0, { fill: 'none', ease: LIN });
  return s;
}
const at = (t, fn) => st.events.push({ t, fn, done: false });
const during = (t0, t1, fn) => st.events.push({ t0, t1, fn, during: true });

function seek(t) {
  for (const e of st.events) {
    if (e.during) {
      if (t >= e.t0 && t <= e.t1) { e.fn(Math.min(1, (t - e.t0) / Math.max(1e-6, e.t1 - e.t0)), t); if (t >= e.t1) e.fin = true; }
      else if (t > e.t1 && !e.fin) { e.fin = true; e.fn(1, t); }
    } else if (!e.done && t >= e.t - 1e-6) { e.done = true; e.fn(t); }
  }
  /* adopt animations the dashboard created in response to our events: pause them and step them with the film */
  for (const app of st.apps) {
    const d = app.doc();
    if (!d) continue;
    for (const a of d.getAnimations()) {
      if (!st.adopt.has(a)) { st.adopt.set(a, t); a.pause(); }
      a.currentTime = (t - st.adopt.get(a)) * 1000;
    }
  }
  for (const a of st.anims) a.currentTime = t * 1000;
}
function finish() {
  st.events.sort((a, b) => (a.t ?? a.t0) - (b.t ?? b.t0));
  window.SFX = st.sfx;
  window.seek = seek;
  window.READY = true;
}

/* ---------- camera ---------- */
let camS = { tx: 0, ty: 0, z: 1 };
function zoom(t0, dur, px, py, z, ease = IO, cx = 960, cy = 540) { /* put stage point (px,py) at screen point (cx,cy), magnified z times */
  const tx = cx - z * px, ty = cy - z * py;
  A(cam, [{ transform: `translate(${camS.tx}px,${camS.ty}px) scale(${camS.z})` }, { transform: `translate(${tx}px,${ty}px) scale(${z})` }], t0, dur, { ease });
  camS = { tx, ty, z };
}
function shake(t0, t1, a0, a1) {
  const n = Math.round((t1 - t0) * 30), kf = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); kf.push({ translate: `${rr(-a, a)}px ${rr(-a, a)}px`, rotate: `${rr(-a, a) / 30}deg` }); }
  kf.push({ translate: '0 0', rotate: '0deg' });
  A(shakeEl, kf, t0, t1 - t0, { ease: LIN });
}
function beatPulse(t0, t1, beat = 0.5, amp = 0.014) {
  const D = t1 - t0, kf = [{ scale: 1, offset: 0 }];
  for (let tb = t0; tb < t1 - 0.3; tb += beat) {
    const o = (tb - t0) / D;
    kf.push({ scale: 1, offset: Math.max(o, kf[kf.length - 1].offset + 1e-4) }, { scale: 1 + amp, offset: o + 0.02 / D }, { scale: 1, offset: o + 0.22 / D, easing: 'ease-out' });
  }
  kf.push({ scale: 1, offset: 1 });
  A(shakeEl, kf, t0, D, { ease: LIN });
}
function flash(t, dur = 0.35, color) {
  const f = E('div', 'flash', '', hud);
  if (color) f.style.background = color;
  A(f, [{ opacity: 0.85 }, { opacity: 0 }], t, dur, { ease: OUT });
}
function wipe(t, color = '#28b894', dur = 0.5) {
  const w = E('div', '', '', hud);
  w.style.cssText = `position:absolute;inset:0;background:${color};clip-path:inset(0 100% 0 0)`;
  A(w, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }], t, dur / 2, { ease: IO });
  A(w, [{ clipPath: 'inset(0 0% 0 0)' }, { clipPath: 'inset(0 0% 0 100%)' }], t + dur / 2, dur / 2, { ease: IO });
  sfx(t, 'whoosh');
}

/* ---------- type, labels, particles ---------- */
function words(txt, x, y, o = {}) {
  const box = E('div', 'words' + (o.left ? ' left' : ''), '', hud);
  box.style.left = x + 'px';
  box.style.top = y + 'px';
  box.style.fontSize = (o.size || 160) + 'px';
  if (o.w) box.style.width = o.w + 'px';
  const t0 = o.t0, stag = o.stag ?? 0.07;
  if (o.letters) box.style.gap = '0';
  (o.letters ? txt.split('') : txt.split(' ')).forEach((tok, i) => {
    let c = '';
    if (tok[0] === '*') { c = 'green'; tok = tok.slice(1); } else if (tok[0] === '~') { c = 'sky'; tok = tok.slice(1); } else if (tok[0] === '!') { c = 'orange'; tok = tok.slice(1); }
    const s = E('span', 'w1 ' + c, tok.replace(/_/g, '&nbsp;'), box);
    const from = o.slam
      ? { opacity: 0, scale: 3.2, filter: 'blur(18px)' }
      : { opacity: 0, translate: '0 90px', scale: 0.4, rotate: (i % 2 ? 7 : -7) + 'deg', filter: 'blur(14px)' };
    A(s, [from, { opacity: 1, translate: '0 0', scale: 1, rotate: '0deg', filter: 'blur(0px)' }], t0 + i * stag, o.dur ?? 0.5, { ease: o.slam ? OUT : BACK });
  });
  if (o.t1) A(box, [{ opacity: 1, scale: 1 }, { opacity: 0, scale: o.out ?? 1.2 }], o.t1, 0.18, { ease: IN });
  return box;
}
function pill(txt, x, y, t0, t1, o = {}) {
  const p = E('div', 'pill' + (o.g ? ' g' : ''), txt.replace(/\*(\S+)/g, '<span class="green">$1</span>'), hud);
  p.style.left = x + 'px';
  p.style.top = y + 'px';
  if (o.size) p.style.fontSize = o.size + 'px';
  A(p, [{ opacity: 0, scale: 0.5, translate: '0 40px' }, { opacity: 1, scale: 1, translate: '0 0' }], t0, 0.4, { ease: BACK });
  if (t1) A(p, [{ opacity: 1, scale: 1 }, { opacity: 0, scale: 0.9, translate: '0 -24px' }], t1, 0.2, { ease: IN });
  return p;
}
function tag(txt, x, y, t0, t1, rot = 0) {
  const p = E('div', 'tag', txt, hud);
  p.style.left = x + 'px';
  p.style.top = y + 'px';
  p.style.rotate = rot + 'deg';
  A(p, [{ opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1 }], t0, 0.35, { ease: BACK });
  if (t1) A(p, [{ opacity: 1 }, { opacity: 0 }], t1, 0.15, { ease: IN });
  return p;
}
function counter(node, t0, t1, from, to, fmt = (v) => Math.round(v)) {
  during(t0, t1, (p) => { node.textContent = fmt(from + (to - from) * easeOut(p)); });
}
function burst(t, x, y, n = 36, spread = 700, parent = hud) {
  const cols = ['#28b894', '#4f8bff', '#8fbaff', '#eaf1ff', '#f2994a'];
  for (let i = 0; i < n; i++) {
    const q = E('div', 'sq', '', parent);
    q.style.background = cols[i % cols.length];
    q.style.left = x + 'px';
    q.style.top = y + 'px';
    const a = rnd() * Math.PI * 2, d = rr(0.3, 1) * spread, dx = Math.cos(a) * d, dy = Math.sin(a) * d - 140;
    A(q, [{ opacity: 1, translate: '0 0', rotate: '0deg', scale: rr(0.6, 1.7) }, { opacity: 1, translate: `${dx * 0.7}px ${dy * 0.8}px`, offset: 0.45 }, { opacity: 0, translate: `${dx}px ${dy + 420}px`, rotate: rr(-540, 540) + 'deg' }], t, rr(0.9, 1.4), { ease: OUT });
  }
  sfx(t, 'confetti');
}
const LOGO = (s) => `<svg class="logo-mark" width="${s}" height="${s}" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#28b894"/><path d="M10 10.5l6 5.5-6 5.5" fill="none" stroke="#04163c" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 22.5h5" stroke="#04163c" stroke-width="2.6" stroke-linecap="round"/></svg>`;

/* pixel buddy sprite, kept in sync with frontend/buddy.js */
const BUDDY = ['..oo........oo..', '.owwo......owwo.', '.owwoooooooowwo.', '.owwwwwwwwwwwwo.', 'hhowkkkkkkkkwohh', 'hhokkkkkkkkkkohh', 'hhokkkkkkkkkkohh', 'hhokkkkkkkkkkohh', 'hhokkkkkkkkkkohh', '.owwwwwwwwwwwwo.', '..oowwwwwwwwoo..', '.howwwwwwwwwwoh.', '.howwwwsswwwwoh.', '.hoswwwwwwwwsoh.', '...oooooooooo...', '..hhh......hhh..'];
const PAL = { o: '#10162e', w: '#f4f7ff', s: '#b9c4dd', k: '#0a0f24', h: '#8794b4', e: '#3ee6b0', p: '#ff7aa8' };
function buddyCanvas(size, mode = 'open', parent = hud) {
  const cv = E('canvas', 'px', '', parent);
  cv.width = cv.height = 16;
  cv.style.width = cv.style.height = size + 'px';
  cv.style.opacity = 0; /* callers fade it in with an animation that also sets opacity: 1 */
  const g = BUDDY.map((r) => r.split(''));
  const eyes = { open: [[4, 5], [5, 5], [4, 6], [5, 6], [4, 7], [5, 7]], happy: [[3, 7], [4, 6], [5, 6], [6, 7]], love: [[4, 5], [6, 5], [4, 6], [5, 6], [6, 6], [5, 7]] }[mode];
  eyes.forEach((q) => { g[q[1]][q[0]] = mode === 'love' ? 'p' : 'e'; g[q[1]][15 - q[0]] = mode === 'love' ? 'p' : 'e'; });
  const c = cv.getContext('2d');
  g.forEach((r, y) => r.forEach((ch, x) => { if (ch !== '.') { c.fillStyle = PAL[ch]; c.fillRect(x, y, 1, 1); } }));
  return cv;
}

/* ---------- cursor ---------- */
function mkCursor() {
  return E('div', 'cursor', '<svg viewBox="0 0 44 44" width="44" height="44"><path d="M6 4 L6 34 L14 27 L19 39 L25 36.5 L20 25 L31 25 Z" fill="#fff" stroke="#0a0f24" stroke-width="2.5" stroke-linejoin="round"/></svg>', cam);
}
function cursorPath(c, pts) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [t0, x0, y0] = pts[i], [t1, x1, y1, e] = pts[i + 1];
    A(c, [{ translate: `${x0}px ${y0}px` }, { translate: `${x1}px ${y1}px` }], t0, t1 - t0, { ease: e || IO });
  }
}
function clickFx(c, t, x, y) {
  A(c, [{ scale: 1 }, { scale: 0.8 }, { scale: 1 }], t, 0.22, { ease: OUT });
  const r = E('div', 'ring', '', cam);
  r.style.left = x + 'px';
  r.style.top = y + 'px';
  A(r, [{ opacity: 0.95, scale: 0.3 }, { opacity: 0, scale: 1.7 }], t, 0.45, { ease: OUT });
  sfx(t, 'click');
}

/* ---------- the real dashboard in an iframe ---------- */
class App {
  constructor(o) {
    Object.assign(this, { x: 96, y: 54, s: 1.2, vw: 1440, vh: 810, kind: '', r: 24, parent: cam }, o);
    this.win = E('div', 'win ' + this.kind, '<div class="vp"><iframe></iframe></div>', this.parent);
    this.win.style.cssText = `left:${this.x}px;top:${this.y}px;width:${this.vw * this.s}px;height:${this.vh * this.s}px;border-radius:${this.r}px`;
    const vp = $('.vp', this.win);
    vp.style.cssText = `width:${this.vw}px;height:${this.vh}px;transform:scale(${this.s})`;
    this.f = $('iframe', this.win);
    this.f.width = this.vw;
    this.f.height = this.vh;
    st.apps.push(this);
  }
  load() {
    return new Promise((res) => {
      this.f.onload = () => {
        /* the dashboard scrolls to pulsed widgets; the film keeps a fixed frame, so switch that off */
        this.w.Element.prototype.scrollIntoView = () => {};
        this.w.scrollBy = () => {};
        this.f.contentDocument.fonts.ready.then(() => setTimeout(res, 250));
      };
      this.f.src = '../frontend/index.html';
    });
  }
  doc() { try { return this.f.contentDocument; } catch (e) { return null; } }
  get w() { return this.f.contentWindow; }
  q(sel) { return this.doc().querySelector(sel); }
  rect(sel) { const r = this.q(sel).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; }
  st(x, y) { return [this.x + x * this.s, this.y + y * this.s]; }
  view(x, y) { const [sx, sy] = this.st(x, y); return [camS.tx + camS.z * sx, camS.ty + camS.z * sy]; } /* where a local point lands on screen after the camera */
  settle() { this.doc().getAnimations().forEach((a) => a.finish()); }
  pe(type, x, y, buttons = 0, onWindow = false) {
    const d = this.doc(), tg = onWindow ? this.w : d.elementFromPoint(x, y) || d.body;
    tg.dispatchEvent(new this.w.PointerEvent(type, { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons }));
  }
  /* entrance / exit of the whole window */
  in(t0, from = { scale: 0.8, translate: '0 80px', rotate: '-3deg' }, dur = 0.7) {
    A(this.win, [{ opacity: 0, ...from }, { opacity: 1, scale: 1, translate: '0 0', rotate: '0deg' }], t0, dur, { ease: BACK });
    sfx(t0, 'whoosh');
  }
  out(t0, dur = 0.3) { A(this.win, [{ opacity: 1, scale: 1 }, { opacity: 0, scale: 1.08 }], t0, dur, { ease: IN }); }
  click(t, x, y) {
    at(t, () => {
      const d = this.doc(), tg = d.elementFromPoint(x, y) || d.body;
      this.pe('pointerdown', x, y, 1);
      this.pe('pointerup', x, y, 0);
      tg.dispatchEvent(new this.w.MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
    });
  }
  hover(t0, t1, from, to) {
    during(t0, t1, (p) => { const e = easeIO(p); this.pe('pointermove', from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e, 0); });
  }
  drag(t0, t1, from, to, ease = easeIO) {
    let started = false;
    during(t0, t1, (p) => {
      const e = ease(p), x = from[0] + (to[0] - from[0]) * e, y = from[1] + (to[1] - from[1]) * e;
      if (!started) { started = true; this.pe('pointerdown', from[0], from[1], 1); }
      this.pe('pointermove', x, y, 1, true);
      if (p >= 1) this.pe('pointerup', x, y, 0, true);
    });
  }
  type(t0, t1, sel, text) {
    during(t0, t1, (p) => { const el = this.q(sel); if (el) el.value = text.slice(0, Math.round(p * text.length)); });
    for (let i = 0; i < text.length; i += 2) sfx(t0 + (t1 - t0) * (i / text.length), 'tick');
  }
  submit(t, formSel) { at(t, () => this.q(formSel).requestSubmit()); }
  replay(t) { /* restart the rise-in animation of every widget at film time t */
    at(t, () => this.doc().querySelectorAll('.w').forEach((el) => { el.classList.remove('fresh'); void el.offsetWidth; el.classList.add('fresh'); }));
  }
  fakeReply(text) { this.w.KAUNTER_CHAT_DEMO = () => new Promise((res) => { this._release = () => res(text); }); }
  release(t) { at(t, () => this._release && this._release()); }
  data(fn, pulseId, t) { at(t, () => { fn(this.w.KAUNTER_DATA); this.w.Kaunter.refresh(pulseId); }); }
  call(t, fn) { at(t, () => fn(this)); }
}
/* load a throwaway copy, run fn(app) against settled layout, return its result */
async function scout(fn, o = {}) {
  const a = new App({ ...o });
  await a.load();
  const r = await fn(a);
  st.apps = st.apps.filter((x) => x !== a);
  a.win.remove();
  return r;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function resetStorage(lang = 'en') {
  try { localStorage.removeItem('kaunter.layout.v1'); localStorage.removeItem('kaunter.done'); localStorage.setItem('kaunter.lang', lang); } catch (e) { /* ignore */ }
}
