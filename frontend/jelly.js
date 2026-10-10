/* JellyRadio, vanilla port of the React Bits component (no React, no motion, no Tailwind).
   Jelly.mount(group, { onChange(value, index) }) turns a container of <button data-id> chips into a radio group:
   the chosen chip swells, neighbours get shoved aside, everything springs. State lives in aria-checked.
   Re-calling mount on the same group (after you rebuild its chips) just refreshes it. Group.sync() jumps to whatever aria-checked says. */
(function () {
  'use strict';

  var DEF = { swell: 0.2, barge: 6, shrink: 0.05, jelly: 1, bounce: 0.25, stagger: 22, stiffness: 580 };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* a damped spring we step ourselves: { p: position, v: velocity, to, k, m, c, at: start time (ms) } */
  function Spring(p) { this.p = p; this.v = 0; this.to = p; this.k = 0; this.m = 1; this.c = 0; this.at = 0; this.on = false; }
  Spring.prototype.go = function (to, k, m, bounce, delay) {
    this.to = to; this.k = k; this.m = m; this.c = 2 * Math.sqrt(k * m) * (1 - bounce); this.at = performance.now() + delay; this.on = true;
  };
  Spring.prototype.jump = function (to) { this.p = this.to = to; this.v = 0; this.on = false; };
  Spring.prototype.step = function (now, dt) {
    if (!this.on || now < this.at) return;
    for (var n = 0, h = dt / 4; n < 4; n++) { /* 4 substeps keep stiff springs stable */
      var a = (-this.k * (this.p - this.to) - this.c * this.v) / this.m;
      this.v += a * h;
      this.p += this.v * h;
    }
    if (Math.abs(this.p - this.to) < 0.0005 && Math.abs(this.v) < 0.005) this.jump(this.to);
  };

  function mount(group, opts) {
    if (group._jelly) { group._jelly.refresh(); return group._jelly; }
    var C = Object.assign({}, DEF, opts || {});
    var chips = [], fx = [], applied = -1, raf = 0, last = 0;
    var rtl = function () { return getComputedStyle(group).direction === 'rtl'; };
    var enabled = function (b) { return !b.disabled; };
    var selected = function () { for (var i = 0; i < chips.length; i++) if (chips[i].getAttribute('aria-checked') === 'true') return i; return 0; };

    function paint() {
      chips.forEach(function (b, i) { b.style.transform = 'translateX(' + fx[i].x.p + 'px) scale(' + fx[i].sx.p + ',' + fx[i].sy.p + ')'; });
    }
    function loop(now) {
      var dt = Math.min(0.032, (now - last) / 1000 || 0.016), live = false;
      last = now;
      fx.forEach(function (f) { f.x.step(now, dt); f.sx.step(now, dt); f.sy.step(now, dt); live = live || f.x.on || f.sx.on || f.sy.on; });
      paint();
      raf = live ? requestAnimationFrame(loop) : 0;
    }
    function apply(sel, instant) {
      var w = chips[sel] ? chips[sel].offsetWidth : 0;
      var push = w * C.swell / 2 + C.barge, dirFlip = rtl() ? -1 : 1;
      chips.forEach(function (b, i) {
        var f = fx[i], on = i === sel, far = Math.abs(i - sel);
        var x = Math.sign(i - sel) * dirFlip * push, s = on ? 1 + C.swell : 1 - C.shrink;
        if (instant || reduce) { f.x.jump(x); f.sx.jump(s); f.sy.jump(s); return; }
        var k = C.stiffness * (1 - 0.12 * Math.min(far, 3)), j = C.jelly;
        var delay = (f.x.on || f.sx.on || f.sy.on) ? 0 : far * C.stagger;
        f.x.go(x, k, 0.9, C.bounce, delay);
        f.sx.go(s, k * (1 + 0.24 * j), 0.9 - 0.1 * j, Math.min(0.85, C.bounce + 0.3 * j), delay);
        f.sy.go(s, k * (1 - 0.14 * j), 0.9 + 0.05 * j, C.bounce, delay + 50 * j);
      });
      applied = sel;
      if (instant || reduce) paint(); else if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
    }
    /* room around the group so the swollen chip and shoved neighbours are not clipped */
    function measure() {
      var maxW = 0, h = 0;
      chips.forEach(function (b) { maxW = Math.max(maxW, b.offsetWidth); h = Math.max(h, b.offsetHeight); });
      group.style.paddingInline = Math.ceil(maxW * C.swell * 1.3 / 2 + C.barge) + 2 + 'px';
      group.style.paddingBlock = Math.ceil(h * C.swell / 2) + 2 + 'px';
    }
    function refresh() {
      chips = Array.prototype.slice.call(group.querySelectorAll('button'));
      fx = chips.map(function () { return { x: new Spring(0), sx: new Spring(1), sy: new Spring(1) }; });
      var at = selected();
      chips.forEach(function (b, i) { b.setAttribute('role', 'radio'); b.tabIndex = i === at ? 0 : -1; });
      measure();
      apply(at, true);
    }
    function commit(i, instant) {
      var b = chips[i];
      if (!b || !enabled(b) || i === applied) return;
      chips.forEach(function (c, n) { c.setAttribute('aria-checked', n === i); c.tabIndex = n === i ? 0 : -1; });
      apply(i, instant);
      if (C.onChange) C.onChange(b.dataset.id, i);
    }
    function sync() { var at = selected(); chips.forEach(function (c, n) { c.tabIndex = n === at ? 0 : -1; }); if (at !== applied) apply(at, true); }
    function step(from, dir) {
      for (var n = 0, j = from; n < chips.length; n++) { j = (j + dir + chips.length) % chips.length; if (enabled(chips[j])) return j; }
      return from;
    }

    group.setAttribute('role', 'radiogroup');
    group.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) commit(chips.indexOf(b), e.detail === 0); /* keyboard-triggered clicks jump, pointer clicks spring */
    });
    group.addEventListener('keydown', function (e) {
      var i = chips.indexOf(e.target.closest('button')), next = null;
      if (i < 0) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = step(i, 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = step(i, -1);
      else if (e.key === 'Home') next = step(-1, 1);
      else if (e.key === 'End') next = step(chips.length, -1);
      if (next === null) return;
      e.preventDefault();
      commit(next, true);
      chips[next].focus();
    });
    if (window.ResizeObserver) new ResizeObserver(function () { measure(); apply(applied < 0 ? selected() : applied, true); }).observe(group);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measure(); apply(applied < 0 ? selected() : applied, true); });

    group._jelly = { refresh: refresh, sync: sync };
    refresh();
    return group._jelly;
  }

  window.Jelly = { mount: mount };
})();
