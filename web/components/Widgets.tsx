"use client";
import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import Buddy from "./Buddy";
import { TODAY, agents, campaignEvidence, campaigns, contract, events as seedEvents, invoiceCheck, reviewThemes, rivals, sales, stars, todos as seedTodos, type Ev, type Todo } from "@/lib/data";

// Every widget is one bot's output: title, bot badge (top right), a words+number headline, then a chart.
// The frame (`plan`) measures the widget in pixels and decides what fits, so any size from 1x1 to the
// whole canvas shows the most it can: tiny = title + number, bigger = + words, + chart, + detail, + action.

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const pad2 = (n: number) => String(n).padStart(2, "0");
const rm = (n: number) => `RM ${n.toLocaleString("en-US")}`;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const who = Object.fromEntries(agents.map((a) => [a.id, a]));
const colorOf = (id: string) => ({ "--c": who[id]?.color ?? "var(--ink-3)" }) as CSSProperties;
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ---- time helpers (the demo date is fixed; only the time of day is live) ----
const dayOf = (d: string) => new Date(`${d}T00:00:00`);
const isoOf = (y: number, m: number, d: number) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
const clock = (now: Date | null) => (now ? `${pad2(now.getHours())}:${pad2(now.getMinutes())}` : "00:00");
const evKey = (e: Ev) => `${e.date} ${e.time}`;
const byKey = (a: Ev, b: Ev) => (evKey(a) < evKey(b) ? -1 : 1);
const dayLabel = (d: string) => {
  const n = Math.round((+dayOf(d) - +dayOf(TODAY)) / 864e5), x = dayOf(d);
  return n === 0 ? "Today" : n === 1 ? "Tomorrow" : n === -1 ? "Yesterday" : `${WD[x.getDay()]} ${x.getDate()} ${MO[x.getMonth()]}`;
};
const until = (e: Ev, now: Date | null) => {
  if (!now) return dayLabel(e.date);
  const [h, m] = clock(now).split(":").map(Number), [eh, em] = e.time.split(":").map(Number);
  const mins = Math.round((+dayOf(e.date) - +dayOf(TODAY)) / 6e4) + eh * 60 + em - (h * 60 + m);
  if (mins <= 0) return "now";
  if (mins < 60) return `in ${mins} min`;
  if (mins < 1440) return `in ${Math.floor(mins / 60)} h${mins % 60 ? ` ${mins % 60} min` : ""}`;
  return dayLabel(e.date);
};

// ---- shared state for the manager widgets (calendar, schedule, to-do) ----
export type Ctx = { events: Ev[]; todos: Todo[]; now: Date | null; addEvent: (e: Omit<Ev, "id">) => void; toggleTodo: (id: string) => void; addTodo: (text: string) => void };
const STORE = "kaunter-data-v1";

export function useStore(): Ctx {
  const [events, setEvents] = useState<Ev[]>(seedEvents);
  const [todos, setTodos] = useState<Todo[]>(seedTodos);
  const [now, setNow] = useState<Date | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORE) || "null");
      if (s?.events) setEvents(s.events);
      if (s?.todos) setTodos(s.todos);
    } catch {}
    setReady(true);
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (ready) try { localStorage.setItem(STORE, JSON.stringify({ events, todos })); } catch {}
  }, [events, todos, ready]);
  return useMemo(() => ({
    events, todos, now,
    addEvent: (e) => setEvents((l) => [...l, { ...e, id: `e${Date.now()}` }]),
    toggleTodo: (id) => setTodos((l) => l.map((t) => (t.id === id ? { ...t, done: !t.done } : t))),
    addTodo: (text) => setTodos((l) => [...l, { id: `t${Date.now()}`, text, due: TODAY, agent: "manager", done: false }]),
  }), [events, todos, now]);
}

// ---- tooltip: one shared node, text set with textContent, also shown on keyboard focus ----
let tipEl: HTMLDivElement | null = null;
const tip = {
  show(x: number, y: number, title: string, value: string) {
    if (!tipEl) { tipEl = document.createElement("div"); tipEl.className = "tip"; tipEl.setAttribute("role", "tooltip"); document.body.appendChild(tipEl); }
    const v = document.createElement("b"), t = document.createElement("span");
    v.textContent = value; t.textContent = title;
    tipEl.replaceChildren(v, t);
    tipEl.style.left = `${x}px`; tipEl.style.top = `${y}px`; tipEl.dataset.on = "1";
  },
  hide() { if (tipEl) delete tipEl.dataset.on; },
};
const mark = (title: string, value: string) => ({
  tabIndex: 0,
  "aria-label": `${title}: ${value}`,
  onPointerMove: (e: React.PointerEvent) => tip.show(e.clientX, e.clientY, title, value),
  onPointerLeave: tip.hide,
  onFocus: (e: React.FocusEvent) => { const r = e.currentTarget.getBoundingClientRect(); tip.show(r.left + r.width / 2, r.top, title, value); },
  onBlur: tip.hide,
});

// ---- count-up: the first number in a headline counts up once, after the card scrolls into view ----
function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return [ref, seen] as const;
}

function CountUp({ text, plain }: { text: string; plain?: boolean }) {
  const [ref, seen] = useInView<HTMLSpanElement>();
  const m = plain || text.includes(":") ? null : text.match(/\d[\d,]*\.?\d*/);
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (!m || !seen || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const to = parseFloat(m[0].replace(/,/g, "")), dec = (m[0].split(".")[1] || "").length;
    const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: m[0].includes(",") });
    let raf = 0;
    const t = setTimeout(() => {
      const t0 = performance.now();
      const tick = (now: number) => {
        const k = Math.min(1, (now - t0) / 900);
        setOut(text.replace(m[0], fmt(to * (1 - (1 - k) ** 3))));
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, 600);
    setOut(text.replace(m[0], fmt(0)));
    return () => { clearTimeout(t); cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen, text]);
  return <span ref={ref}>{plain ? text : out}</span>;
}

// Fills the space left over and tells its child the exact pixel size, so charts stretch to use it.
function Fill({ children }: { children: (w: number, h: number) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [s, setS] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setS({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) }));
    ro.observe(ref.current!);
    return () => ro.disconnect();
  }, []);
  return <div className="fill" ref={ref}>{s.w > 8 && s.h > 8 && children(s.w, s.h)}</div>;
}

// ---- charts ----
type Col = { k: string; v: number; hi?: boolean };

// Columns: <=24px thick, rounded tops, one baseline. One bar can be emphasised; only it and the peak get a value label.
function Columns({ data, w, h, fmt }: { data: Col[]; w: number; h: number; fmt: (v: number) => string }) {
  const top = 16, bot = 16, ph = h - top - bot, max = Math.max(...data.map((d) => d.v), 1);
  const slot = w / data.length, bw = Math.min(24, slot * 0.6), every = slot < 28 ? 2 : 1;
  const peak = data.reduce((m, d, i) => (d.v > data[m].v ? i : m), 0);
  return (
    <svg width={w} height={h} role="img" aria-label={data.map((d) => `${d.k} ${fmt(d.v)}`).join(", ")}>
      <line className="gl" x1={0} x2={w} y1={top + ph + 0.5} y2={top + ph + 0.5} />
      {data.map((d, i) => {
        const bh = Math.max(2, (d.v / max) * ph), x = slot * i + (slot - bw) / 2, y = top + ph - bh, r = Math.min(4, bw / 2, bh);
        return (
          <g key={d.k}>
            <path className={`bar ${d.hi ? "hi" : ""}`} style={{ animationDelay: `${i * 60}ms` }} d={`M${x} ${y + bh}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + bw - r}Q${x + bw} ${y} ${x + bw} ${y + r}V${y + bh}Z`} />
            {(i === peak || d.hi) && <text className="ax val" x={x + bw / 2} y={y - 5} textAnchor="middle">{fmt(d.v)}</text>}
            {i % every === 0 && <text className="ax" x={x + bw / 2} y={h - 3} textAnchor="middle">{d.k}</text>}
            <rect className="hit" x={slot * i} y={0} width={slot} height={h} {...mark(d.k, fmt(d.v))} />
          </g>
        );
      })}
    </svg>
  );
}

// Area line for wide, short boxes: 2px line, 10% wash, end dot with a surface ring, crosshair on hover.
function AreaLine({ data, w, h, fmt }: { data: Col[]; w: number; h: number; fmt: (v: number) => string }) {
  const [hov, setHov] = useState<number | null>(null);
  const L = 10, R = 12, T = 18, B = 16, pw = w - L - R, ph = h - T - B, last = data.length - 1;
  const max = Math.max(...data.map((d) => d.v), 1), px = (i: number) => L + (pw * i) / last, py = (v: number) => T + ph - (v / max) * ph;
  const line = data.map((d, i) => `${i ? "L" : "M"}${px(i)} ${py(d.v)}`).join("");
  const cur = hov ?? last, every = pw / last < 34 ? 2 : 1;
  return (
    <svg width={w} height={h} role="img" aria-label={data.map((d) => `${d.k} ${fmt(d.v)}`).join(", ")} onPointerLeave={() => { setHov(null); tip.hide(); }}>
      <line className="gl" x1={0} x2={w} y1={T + ph + 0.5} y2={T + ph + 0.5} />
      <path className="area" d={`${line}L${px(last)} ${T + ph}L${px(0)} ${T + ph}Z`} />
      <path className="ln" d={line} />
      {hov !== null && <line className="gl" x1={px(hov)} x2={px(hov)} y1={T} y2={T + ph} />}
      <circle className="pt" cx={px(cur)} cy={py(data[cur].v)} r={5} />
      <text className="ax val" x={px(cur)} y={py(data[cur].v) - 10} textAnchor={px(cur) > w - 34 ? "end" : "middle"}>{fmt(data[cur].v)}</text>
      {data.map((d, i) => i % every === 0 && <text key={d.k} className="ax" x={px(i)} y={h - 3} textAnchor="middle">{d.k}</text>)}
      <rect className="hit" x={0} y={0} width={w} height={h} onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect(), i = clamp(Math.round(((e.clientX - r.left - L) / pw) * last), 0, last);
        setHov(i); tip.show(e.clientX, r.top + py(data[i].v), data[i].k, fmt(data[i].v));
      }} />
    </svg>
  );
}

// Ranked horizontal bars (HTML so long labels ellipsise). Rows spread to fill the height; as many as fit are shown.
type Row = { k: string; v: number; hi?: boolean; tone?: string };
function HBars({ rows, w, h, fmt, solid, total }: { rows: Row[]; w: number; h: number; fmt: (v: number) => string; solid?: boolean; total?: number }) {
  const n = clamp(Math.floor(h / 26), 1, rows.length), pitch = h / n, bt = clamp(pitch * 0.5, 6, 20), max = total ?? Math.max(...rows.map((r) => r.v), 1);
  return (
    <div className="hb" style={{ gridTemplateRows: `repeat(${n}, ${pitch}px)` }} role="img" aria-label={rows.map((r) => `${r.k} ${fmt(r.v)}`).join(", ")}>
      {rows.slice(0, n).map((r, i) => (
        <div className="hrow" key={r.k} style={{ gridTemplateColumns: `${clamp(w * 0.38, 56, 170)}px 1fr auto` }} {...mark(r.k, fmt(r.v))}>
          <span className="hk">{r.k}</span>
          <span className="htrack"><i className={`${r.hi ? "hi" : ""} ${solid ? "solid" : ""} ${r.tone ?? ""}`} style={{ width: `${(r.v / max) * 100}%`, height: bt, animationDelay: `${i * 70}ms` }} /></span>
          <b className="hv num">{fmt(r.v)}</b>
        </div>
      ))}
    </div>
  );
}

// Invoice checks as one stacked bar. Colour + icon + label, never colour alone.
function FraudBar({ w, h }: { w: number; h: number }) {
  const c = invoiceCheck, flagged = c.checked - c.verified - c.needsEvidence;
  const segs = [{ k: "Verified", v: c.verified, cls: "ok", ic: "✓" }, { k: "Needs evidence", v: c.needsEvidence, cls: "unk", ic: "?" }, { k: "Flagged", v: flagged, cls: "flag", ic: "!" }];
  // Tall box: one coloured row per outcome, so the height is used instead of a lone bar floating in space.
  if (h >= 130) return <HBars rows={segs.map((s) => ({ k: `${s.ic} ${s.k}`, v: s.v, tone: s.cls }))} w={w} h={h} fmt={(v) => `${v}`} total={c.checked} />;
  return (
    <div className="fraud">
      <div className="stack" style={{ height: clamp(h * 0.3, 14, 36) }} role="img" aria-label={segs.map((s) => `${s.k} ${s.v}`).join(", ")}>
        {segs.map((s) => <i key={s.k} className={s.cls} style={{ flexGrow: s.v }} {...mark(s.k, `${s.v} of ${c.checked}`)} />)}
      </div>
      <ul className="legend">{segs.map((s) => <li key={s.k}><i className={s.cls} />{s.ic} {s.k} <b className="num">{s.v}</b></li>)}</ul>
    </div>
  );
}

// Dot plot: each product on its own price range, rivals as hollow dots, ours as the solid burgundy dot.
function Rivals({ h }: { w: number; h: number }) {
  const n = clamp(Math.floor((h - 20) / 32), 1, rivals.length), pitch = (h - 20) / n;
  return (
    <div className="rivals">
      {rivals.slice(0, n).map((r) => {
        const all = [r.ours, ...r.others], lo = Math.min(...all), hi = Math.max(...all), at = (v: number) => 6 + ((v - lo) / (hi - lo || 1)) * 88;
        return (
          <div className="drow" key={r.item} style={{ height: pitch }} {...mark(r.item, `ours RM ${r.ours.toFixed(2)}, rivals ${r.others.map((o) => o.toFixed(2)).join(" / ")}`)}>
            <span className="hk">{r.item}</span>
            <span className="dtrack">
              <u style={{ left: `${at(lo)}%`, width: `${at(hi) - at(lo)}%` }} />
              {r.others.map((o, i) => <i key={i} className="o" style={{ left: `${at(o)}%` }} />)}
              <i className="us" style={{ left: `${at(r.ours)}%` }} />
            </span>
            <b className="hv num">RM {r.ours.toFixed(2)}</b>
          </div>
        );
      })}
      <p className="key"><i className="us" /> Ours <i className="o" /> Rivals</p>
    </div>
  );
}

// Playbook zones for one clause, with a pin where the contract actually lands.
function ContractStrip({ w, h }: { w: number; h: number }) {
  const c = contract, max = 120, long = w > 330;
  return (
    <div className="strip">
      <div className="zwrap" style={{ height: clamp(h * 0.22, 12, 28) }}>
        <div className="zones">
          <i className="ok" style={{ flexGrow: c.preferred }} {...mark("Preferred", `up to ${c.preferred} days`)} />
          <i className="review" style={{ flexGrow: c.fallback - c.preferred }} {...mark("Fallback", `${c.preferred}-${c.fallback} days`)} />
          <i className="stop" style={{ flexGrow: max - c.fallback }} {...mark("Walk-away", `over ${c.fallback} days`)} />
        </div>
        <div className="pin" style={{ left: `${(c.days / max) * 100}%` }}><b className="num">{c.days} days</b></div>
      </div>
      <div className="zl">
        <span style={{ flexGrow: c.preferred }}>{long ? `Preferred ≤${c.preferred}d` : `≤${c.preferred}d`}</span>
        <span style={{ flexGrow: c.fallback - c.preferred }}>{long ? `Fallback ≤${c.fallback}d` : `≤${c.fallback}d`}</span>
        <span style={{ flexGrow: max - c.fallback }}>{long ? `Walk-away >${c.fallback}d` : `>${c.fallback}d`}</span>
      </div>
    </div>
  );
}

// Month grid that falls back to one week when the box is too short. Click a day to select it.
function MonthView({ w, h, sel, setSel, off, setOff, events }: { w: number; h: number; sel: string; setSel: (s: string) => void; off: number; setOff: (n: number) => void; events: Ev[] }) {
  const t = dayOf(TODAY), first = new Date(t.getFullYear(), t.getMonth() + off, 1), y = first.getFullYear(), m = first.getMonth();
  const lead = (first.getDay() + 6) % 7, dim = new Date(y, m + 1, 0).getDate(), mrows = Math.ceil((lead + dim) / 7);
  const head = h >= 120, gh = h - (head ? 28 : 0) - 14, week = gh / mrows < 24;
  let cells: (string | null)[];
  if (week) {
    const s = dayOf(sel), mon = new Date(s.getFullYear(), s.getMonth(), s.getDate() - ((s.getDay() + 6) % 7));
    cells = Array.from({ length: 7 }, (_, i) => { const d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i); return isoOf(d.getFullYear(), d.getMonth(), d.getDate()); });
  } else cells = Array.from({ length: mrows * 7 }, (_, i) => { const d = i - lead + 1; return d >= 1 && d <= dim ? isoOf(y, m, d) : null; });
  const rows = week ? 1 : mrows, ch = gh / rows, ds = clamp(Math.min((w / 7) * 0.8, ch * (ch >= 38 ? 0.6 : 0.9)), 14, 34);
  return (
    <div className="cal">
      {head && <div className="calh"><span>{MO[m]} {y}</span><span><button aria-label="Previous month" onClick={() => setOff(off - 1)}>‹</button><button aria-label="Next month" onClick={() => setOff(off + 1)}>›</button></span></div>}
      <div className="calg" style={{ gridTemplateRows: `14px repeat(${rows}, 1fr)` }}>
        {"MTWTFSS".split("").map((c, i) => <span key={i} className="wd">{c}</span>)}
        {cells.map((c, i) => {
          if (!c) return <span key={i} />;
          const ev = events.filter((e) => e.date === c), on = Array.from(new Set(ev.map((e) => e.agent))).slice(0, 3);
          return (
            <button key={c} className={`d ${c === TODAY ? "today" : ""} ${c === sel ? "sel" : ""} ${ev.length ? "has" : ""}`} style={{ "--ds": `${ds}px` } as CSSProperties}
              aria-label={`${Number(c.slice(8))} ${MO[Number(c.slice(5, 7)) - 1]}, ${plural(ev.length, "event")}`} aria-pressed={c === sel} onClick={() => setSel(c)}>
              <b>{Number(c.slice(8))}</b>
              {ch >= 38 && <span className="dots">{on.map((a) => <i key={a} style={colorOf(a)} />)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Time + title rows. Keeps one row free for "+k more" when the list is cut.
function Agenda({ items, n, showDay, first }: { items: Ev[]; n: number; showDay?: boolean; first?: boolean }) {
  if (!items.length) return <p className="none">Nothing scheduled</p>;
  const cut = items.length > n ? Math.max(1, n - 1) : n;
  return (
    <ul className="dl">
      {items.slice(0, cut).map((e, i) => (
        <li key={e.id} className={first && i === 0 ? "nx" : ""} style={colorOf(e.agent)} title={`${who[e.agent]?.tag}: ${e.title}`}>
          <i className="cd" />
          <time className="num">{showDay && e.date !== TODAY ? `${WD[dayOf(e.date).getDay()]} ${e.time}` : e.time}</time>
          <span className="t">{e.title}</span>
        </li>
      ))}
      {items.length > cut && <li className="more">+{items.length - cut} more</li>}
    </ul>
  );
}

// Today on an 08:00-22:00 line, with the clock as a marker. For wide, short boxes.
function DayStrip({ items, now }: { items: Ev[]; now: Date | null }) {
  const at = (t: string) => ((Number(t.slice(0, 2)) + Number(t.slice(3, 5)) / 60 - 8) / 14) * 100;
  const nowAt = now ? at(clock(now)) : -1;
  return (
    <div className="day" role="img" aria-label={`Today: ${items.map((e) => `${e.time} ${e.title}`).join(", ")}`}>
      <span className="axis" />
      {[8, 12, 16, 20].map((hr) => <span key={hr} className="tick num" style={{ left: `${at(`${pad2(hr)}:00`)}%` }}>{pad2(hr)}</span>)}
      {nowAt >= 0 && nowAt <= 100 && <span className="now" style={{ left: `${nowAt}%` }} />}
      {items.map((e) => (
        <span key={e.id} style={{ ...colorOf(e.agent), left: `${clamp(at(e.time), 2, 98)}%` }} className="evw" {...mark(e.title, e.time)}>
          <i className="evt num">{e.time}</i><i className="ev" />
        </span>
      ))}
    </div>
  );
}

function Checklist({ todos, toggle, w, h }: { todos: Todo[]; toggle: (id: string) => void; w: number; h: number }) {
  const done = todos.filter((t) => t.done).length, n = Math.max(1, Math.floor((h - 16) / 30));
  const list = [...todos].sort((a, b) => Number(a.done) - Number(b.done) || (a.due < b.due ? -1 : 1));
  const cut = list.length > n ? Math.max(1, n - 1) : n;
  const pitch = clamp((h - 16) / (Math.min(cut, list.length) + (list.length > cut ? 1 : 0)), 30, 46);   // spread the rows over the height
  return (
    <div className="todo">
      <div className="prog" role="img" aria-label={`${done} of ${todos.length} done`}><i style={{ transform: `scaleX(${done / Math.max(todos.length, 1)})` }} /></div>
      <ul className="tl">
        {list.slice(0, cut).map((t) => {
          const late = !t.done && t.due < TODAY;
          return (
            <li key={t.id} style={{ height: pitch }}>
              <button className={`tdi ${t.done ? "done" : ""}`} aria-pressed={t.done} onClick={() => toggle(t.id)}>
                <i className="ck">{t.done ? "✓" : ""}</i>
                <span className="t">{t.text}</span>
                {w >= 240 && <span className={`due ${late ? "late" : ""}`}>{late ? "Overdue" : dayLabel(t.due)}</span>}
              </button>
            </li>
          );
        })}
        {list.length > cut && <li className="more">+{list.length - cut} more</li>}
      </ul>
    </div>
  );
}

// Small inline forms used as a widget's "action" row.
function AddEvent({ onAdd }: { onAdd: Ctx["addEvent"] }) {
  const [title, setTitle] = useState(""), [time, setTime] = useState("10:00");
  const submit = (e: FormEvent) => { e.preventDefault(); if (title.trim()) { onAdd({ date: TODAY, time, title: title.trim(), agent: "manager" }); setTitle(""); } };
  return (
    <form className="addrow" onSubmit={submit}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Schedule a meeting" aria-label="Meeting title" />
      <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time" />
      <button disabled={!title.trim()}>Add</button>
    </form>
  );
}
function AddTodo({ onAdd }: { onAdd: Ctx["addTodo"] }) {
  const [text, setText] = useState("");
  const submit = (e: FormEvent) => { e.preventDefault(); if (text.trim()) { onAdd(text.trim()); setText(""); } };
  return (
    <form className="addrow" onSubmit={submit}>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a to-do" aria-label="New to-do" />
      <button disabled={!text.trim()}>Add</button>
    </form>
  );
}

// ---- the 9 widgets: each returns its headline, optional chart, optional detail lines and optional action ----
type Model = { big: string; words: string; tone?: "review" | "ok"; plain?: boolean; compact?: boolean; good?: boolean; chart?: (w: number, h: number) => ReactNode; detail?: (rows: number) => ReactNode; action?: ReactNode };
export type Def = { id: string; title: string; agent: string; use: (c: Ctx) => Model };
const dl = (rows: number, items: ReactNode[]) => <ul className="dl">{items.slice(0, rows)}</ul>;

function useSales(): Model {
  const total = sales.days.reduce((s, [, v]) => s + v, 0), pct = Math.round(((total - sales.lastWeek) / sales.lastWeek) * 100);
  const best = sales.days.reduce((m, d) => (d[1] > m[1] ? d : m));
  const data: Col[] = sales.days.map(([k, v], i) => ({ k, v, hi: i === sales.days.length - 1 }));
  const fmt = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}K` : `${v}`);
  return {
    big: rm(total), words: `${pct >= 0 ? "+" : ""}${pct}% vs last week · best day ${best[0]}, ${rm(best[1])}`,
    chart: (w, h) => (w / h > 2.2 ? <AreaLine data={data} w={w} h={h} fmt={fmt} /> : <Columns data={data} w={w} h={h} fmt={fmt} />),
    detail: (rows) => dl(rows, [
      <li key="a"><span className="t">Average per day</span><span className="v num">{rm(Math.round(total / sales.days.length))}</span></li>,
      <li key="b"><span className="t">Last week</span><span className="v num">{rm(sales.lastWeek)}</span></li>,
    ]),
  };
}

function useFraud(): Model {
  const c = invoiceCheck, flagged = c.checked - c.verified - c.needsEvidence;
  return {
    big: `${flagged} flagged`, tone: "review", words: `of ${c.checked} invoices checked · ${rm(c.exposure)} suspected, not confirmed fraud`,
    chart: (w, h) => <FraudBar w={w} h={h} />,
    detail: (rows) => dl(rows, c.flagged.map((f) => <li key={f.ref} title={f.why}><span className="t"><b>{f.ref}</b> {f.vendor}</span><span className="v num">{rm(f.rm)}</span></li>)),
  };
}

function useCampaigns(): Model {
  const top = campaigns[0], data: Row[] = campaigns.map((c, i) => ({ k: c.name, v: c.score, hi: i === 0 }));
  return {
    big: rm(top.gain), good: true, words: `${top.name} ranks first of ${campaigns.length} · score ${top.score}/100, est. extra sales this month`,
    chart: (w, h) => <HBars rows={data} w={w} h={h} fmt={(v) => `${v}`} />,
    detail: (rows) => dl(rows, campaignEvidence.map((e) => <li key={e} title={e}><span className="t">{e}</span></li>)),
  };
}

function useSentiment(): Model {
  const total = stars.reduce((s, [, v]) => s + v, 0), avg = stars.reduce((s, [, v], i) => s + (i + 1) * v, 0) / total;
  const high = Math.round(((stars[3][1] + stars[4][1]) / total) * 100);
  return {
    big: `${avg.toFixed(1)} ★`, words: `${total} reviews · ${high}% rated 4★ or 5★`,
    chart: (w, h) => (w / h > 1.6
      ? <Columns data={stars.map(([k, v]) => ({ k, v }))} w={w} h={h} fmt={(v) => `${v}`} />
      : <HBars rows={[...stars].reverse().map(([k, v]) => ({ k, v }))} w={w} h={h} fmt={(v) => `${v}`} solid />),
    detail: (rows) => dl(rows, reviewThemes.map((t) => <li key={t}><span className="t">{t}</span></li>)),
  };
}

function useRivals(): Model {
  const wins = rivals.filter((r) => r.ours <= Math.min(...r.others)).length;
  const dear = rivals.find((r) => r.ours > Math.min(...r.others));
  return {
    big: `${wins} of ${rivals.length}`,
    words: `products priced below every rival${dear ? ` · ${dear.item.toLowerCase()} is RM ${(dear.ours - Math.min(...dear.others)).toFixed(2)} above the cheapest` : ""}`,
    chart: (w, h) => <Rivals w={w} h={h} />,
    detail: (rows) => dl(rows, rivals.map((r) => <li key={r.item}><span className="t">{r.item}</span><span className="v">#{1 + r.others.filter((o) => o < r.ours).length} of {r.others.length + 1}</span></li>)),
  };
}

function useContract(): Model {
  const n = contract.clauses.filter((c) => c.level === "stop").length, icon = { ok: "✓", review: "!", stop: "✕" };
  return {
    big: plural(n, "clause"), tone: "review", words: `${contract.term} are ${contract.days} days, past the ${contract.fallback}-day fallback · redline needed before signing`,
    chart: (w, h) => <ContractStrip w={w} h={h} />,
    detail: (rows) => dl(rows, contract.clauses.map((c) => <li key={c.name}><i className={`ic ${c.level}`}>{icon[c.level]}</i><span className="t">{c.name}</span><span className="v">{c.value}</span></li>)),
  };
}

function useCalendar(c: Ctx): Model {
  const [sel, setSel] = useState(TODAY), [off, setOff] = useState(0);
  const d = dayOf(sel), items = c.events.filter((e) => e.date === sel).sort(byKey), when = sel === TODAY ? "today" : `on ${d.getDate()} ${MO[d.getMonth()]}`;
  return {
    big: `${WD[d.getDay()]} ${d.getDate()}`, plain: true, words: items.length ? `${plural(items.length, "event")} ${when}` : `Nothing ${when}`,
    chart: (w, h) => <MonthView w={w} h={h} sel={sel} setSel={setSel} off={off} setOff={setOff} events={c.events} />,
    detail: (rows) => <Agenda items={items} n={rows} />,
  };
}

function useSchedule(c: Ctx): Model {
  const all = [...c.events].sort(byKey), nk = `${TODAY} ${clock(c.now)}`;
  const up = all.filter((e) => evKey(e) >= nk), next = up[0] ?? all[all.length - 1], today = all.filter((e) => e.date === TODAY);
  return {
    big: next ? next.time : "–", plain: true, compact: true, words: next ? `${next.title} · ${until(next, c.now)}` : "Nothing scheduled",
    // Only the top three upcoming items; a timeline of today takes the space that frees up.
    chart: (w, h) => (w / h > 2.4 && h < 130 ? <DayStrip items={today} now={c.now} /> : (
      <div className="sched">
        {h >= 120 && <div className="sd"><DayStrip items={today} now={c.now} /></div>}
        <Agenda items={(up.length ? up : all.slice(-3)).slice(0, 3)} n={3} showDay first />
      </div>
    )),
    action: <AddEvent onAdd={c.addEvent} />,
  };
}

function useTodos(c: Ctx): Model {
  const open = c.todos.filter((t) => !t.done), late = open.filter((t) => t.due < TODAY);
  return {
    big: `${open.length} open`, plain: true, tone: late.length ? "review" : "ok",
    words: late.length ? `${late.length} overdue: ${late[0].text}` : open.length ? `Next: ${open[0].text}` : "All done, nice work",
    chart: (w, h) => <Checklist todos={c.todos} toggle={c.toggleTodo} w={w} h={h} />,
    action: <AddTodo onAdd={c.addTodo} />,
  };
}

export const WIDGETS: Record<string, Def> = Object.fromEntries([
  { id: "campaign", title: "Top campaign", agent: "marketing", use: useCampaigns },
  { id: "sales", title: "Sales this week", agent: "finance", use: useSales },
  { id: "fraud", title: "Fraud check", agent: "finance", use: useFraud },
  { id: "sentiment", title: "Review sentiment", agent: "marketing", use: useSentiment },
  { id: "calendar", title: "Calendar", agent: "manager", use: useCalendar },
  { id: "schedule", title: "Meetings", agent: "manager", use: useSchedule },
  { id: "todo", title: "To-do", agent: "manager", use: useTodos },
  { id: "rivals", title: "Rival prices", agent: "marketing", use: useRivals },
  { id: "contract", title: "Contract risk", agent: "legal", use: useContract },
].map((d) => [d.id, d]));
export const LIST = Object.values(WIDGETS);

// Default layout on the 8-column grid [x, y, w, h]. Marketing leads (top left), money on the right,
// the manager's day along the bottom. Sizes are deliberately mixed: hero, wide strip, tall column, 2x1 tile.
export const START: Record<string, [number, number, number, number]> = {
  campaign: [0, 0, 4, 3], sales: [4, 0, 2, 2], fraud: [6, 0, 2, 3], sentiment: [4, 2, 2, 1],
  calendar: [0, 3, 2, 3], schedule: [2, 3, 2, 3], todo: [4, 3, 2, 3], rivals: [6, 3, 2, 2], contract: [6, 5, 2, 1],
};

// ---- the frame: decide from pixels what this size can show ----
type Plan = { kind: "row" | "num" | "stack" | "split"; pad: number; size: number; lines: number; rows: number; lw: number; act: boolean };

function plan(W: number, H: number, chart: boolean, detail: boolean, hasAct: boolean, len: number): Plan {
  const pad = H < 120 ? 12 : 16, iw = W - 2 * pad, ih = H - 2 * pad, base = { pad, size: 20, lines: 0, rows: 0, lw: 0, act: false };
  if (ih < 74) return { ...base, kind: "row", size: clamp(ih * 0.55, 15, 26) };
  const body = ih - 30, fit = (avail: number) => avail / (Math.max(len, 2) * 0.62);   // widest font size that fits the number
  if (chart && iw >= 300 && iw > body * 1.9 && body >= 56) {
    const lw = clamp(iw * 0.38, 150, 300), size = clamp(Math.min(fit(lw), body * 0.42, 48), 15, 48);
    const avail = body - size * 1.15 - 6, lines = clamp(Math.floor(avail / 18), 1, 3), left = avail - lines * 18 - 8;
    const act = hasAct && left >= 40 && lw >= 200;
    return { ...base, kind: "split", size, lw, lines, act, rows: detail ? Math.max(0, Math.floor((left - (act ? 38 : 0)) / 26)) : 0 };
  }
  const size = clamp(Math.min(fit(iw), body * 0.3, 48), 15, 48), avail = body - size * 1.15 - 8;
  const lines = clamp(Math.min(body < 130 ? 1 : body < 260 ? 2 : 3, Math.floor(avail / 18)), 0, 3);
  let chartH = avail - lines * 18 - 8;
  const act = hasAct && chartH >= 140;
  if (act) chartH -= 38;
  if (chart && chartH >= 50) return { ...base, kind: "stack", size, lines, act, rows: detail && chartH >= 230 ? Math.min(4, Math.floor((chartH - 150) / 26)) : 0 };
  const sz = clamp(Math.min(fit(iw), (body - 8) * 0.55, 48), 15, 48);
  return { ...base, kind: "num", size: sz, lines: clamp(Math.floor((body - 8 - sz * 1.15) / 18), 0, 3) };
}

export const Widget = memo(function Widget({ def, W, H, edit, ctx }: { def: Def; W: number; H: number; edit: boolean; ctx: Ctx }) {
  const m = def.use(ctx), a = who[def.agent], p = plan(W, H, !!m.chart, !!m.detail, !!m.action, m.big.length);
  const badge = (tag: boolean) => (
    <span className="agent" style={colorOf(def.agent)} title={`${a.name}: ${a.role}`}>
      {tag && W >= 250 && <b>{a.tag}</b>}
      <span className="lg"><Buddy id={def.agent} size={H >= 190 && p.kind !== "row" ? 32 : 24} /><i /></span>
    </span>
  );
  // `compact` widgets halve the headline number and use smaller words, leaving the room to the chart.
  const big = <p className={`big num ${m.good ? "good" : ""}`} style={{ fontSize: m.compact ? Math.max(15, p.size / 2) : p.size }}><CountUp text={m.big} plain={m.plain} /></p>;
  const words = p.lines > 0 && <p className={`words ${m.compact ? "sm" : ""}`} style={{ "--ln": p.lines } as CSSProperties}>{m.words}</p>;
  const chip = m.tone && !edit && W >= 300 ? <span className={`status ${m.tone}`}>{m.tone === "review" ? "Needs you" : "OK"}</span> : null;

  if (p.kind === "row") {
    return (
      <div className="wf" style={{ padding: p.pad }}>
        <div className="wrow"><h4 className="label">{def.title}</h4>{big}{badge(false)}</div>
      </div>
    );
  }
  return (
    <div className="wf" style={{ padding: p.pad }}>
      <header className="whead"><h4 className="label">{def.title}</h4><div className="hr">{chip}{badge(true)}</div></header>
      {p.kind === "split" ? (
        <div className="wbody split">
          <div className="left" style={{ width: p.lw }}>
            {big}{words}
            {p.rows > 0 && m.detail && <div className="detail">{m.detail(p.rows)}</div>}
            {p.act && m.action}
          </div>
          {m.chart && <Fill>{m.chart}</Fill>}
        </div>
      ) : (
        <div className="wbody">
          {big}{words}
          {p.kind === "stack" && m.chart && <Fill>{m.chart}</Fill>}
          {p.rows > 0 && m.detail && <div className="detail">{m.detail(p.rows)}</div>}
          {p.act && m.action}
        </div>
      )}
    </div>
  );
});
