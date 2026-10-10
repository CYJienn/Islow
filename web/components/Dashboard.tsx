"use client";
import { useEffect, useRef, useState } from "react";
import { owner, reminders, upcoming, widgets } from "@/lib/data";
import ProfileDialog, { KEY as PROFILE_KEY, emptyProfile, loadProfile, chatBody, type Profile } from "./ProfileDialog";

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="card">
      <h3>{title}</h3>
      <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </section>
  );
}

// Counts the first number in a value up once, after the card scrolls into view (DocuVerify CountUp).
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

function CountUp({ text }: { text: string }) {
  const [ref, seen] = useInView<HTMLSpanElement>();
  const m = text.includes(":") ? null : text.match(/\d[\d,]*\.?\d*/);
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
    }, 1000);
    setOut(text.replace(m[0], fmt(0)));
    return () => { clearTimeout(t); cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen, text]);
  return <span ref={ref}>{out}</span>;
}

// Bars start empty and grow bottom-up, staggered, the first time they are seen.
function Bars({ values }: { values: number[] }) {
  const [ref, seen] = useInView<HTMLDivElement>();
  return (
    <div className="bars" ref={ref}>
      {values.map((v, i) => <i key={i} style={{ height: seen ? `${v}%` : "0%", transitionDelay: `${i * 80}ms`, background: `var(--b-${i === values.length - 1 ? 700 : i > 3 ? 300 : 100})` }} />)}
    </div>
  );
}

type Rect = { x: number; y: number; w: number; h: number };
type Box = Rect & { id: string };
type Drag = { kind: "move" | "resize" | "add"; id: string; px: number; py: number; off: { x: number; y: number }; target: Box | null };

const KEY = "kaunter-layout-v3";
const COLS = 12, DEF = { w: 3, h: 2 }, MIN = { w: 2, h: 1 };
const byId = Object.fromEntries(widgets.map((w) => [w.title, w]));
// Default layout (12 columns): x, y, w, h in grid cells.
const START: Record<string, [number, number, number, number]> = {
  "Sales this week": [0, 0, 3, 2], "To-do": [3, 0, 3, 2], "Spend": [6, 0, 3, 2], "Cold room": [9, 0, 3, 2],
  "Stock alert": [0, 2, 5, 2], "Next event": [5, 2, 3, 4], "Invoices": [0, 4, 3, 2], "Customers": [8, 4, 3, 2],
};
const initial: Box[] = widgets.map((w) => { const [x, y, ww, h] = START[w.title]; return { id: w.title, x, y, w: ww, h }; });

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const GAP = 6; // half the space between cards: each card is inset by this on every side
const px = (b: Rect, c: number) => ({ left: b.x * c + GAP, top: b.y * c + GAP, width: b.w * c - 2 * GAP, height: b.h * c - 2 * GAP });

// Nearest free spot to the wanted box, so drops snap to the grid and never overlap.
function freeSpot(others: Box[], box: Box): Box {
  const maxY = others.reduce((m, o) => Math.max(m, o.y + o.h), 0) + box.h;
  let best: Box | null = null, bd = Infinity;
  for (let y = 0; y <= maxY; y++)
    for (let x = 0; x <= COLS - box.w; x++) {
      const c = { ...box, x, y };
      if (others.some((o) => overlap(c, o))) continue;
      const d = (x - box.x) ** 2 + (y - box.y) ** 2;
      if (d < bd) { bd = d; best = c; }
    }
  return best ?? { ...box, x: 0, y: maxY };
}

// Pointer-proximity edge glow (BorderGlow): the card tracks the pointer in CSS vars.
const glow = (e: React.PointerEvent<HTMLElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
};

type Msg = { from: "me" | "bot"; text: string };

export default function Dashboard({ onCouncil }: { onCouncil: (question: string, answer: string, turns: { agent: string; text: string }[]) => void }) {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [profileOpen, setProfileOpen] = useState(false);
  useEffect(() => setProfile(loadProfile()), []);
  const saveProfile = (p: Profile) => {
    setProfile(p); setProfileOpen(false);
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch {}
  };
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const msgsEnd = useRef<HTMLDivElement>(null);
  useEffect(() => { msgsEnd.current?.scrollIntoView({ block: "end" }); }, [msgs, busy]);

  // Chat answers directly; if the manager had to pull in several specialists, open the round table instead.
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    const say = (from: Msg["from"], t: string) => setMsgs((m) => [...m, { from, text: t }]);
    setDraft(""); say("me", text); setBusy(true);
    try {
      const r = await fetch("/api/v1/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(chatBody(profile, text)) });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d) say("bot", `The assistant returned an error (${r.status}).`);
      else if (d.type === "text" && d.council) { say("bot", "This needs the whole team. Calling the round table…"); onCouncil(text, d.message, d.turns ?? []); }
      else say("bot", d.message || "No answer.");
    } catch {
      say("bot", "I can't reach the assistant. Start the backend: cd backend, then uv run python run.py.");
    } finally { setBusy(false); }
  };


  const [layout, setLayout] = useState<Box[]>(initial);
  const [edit, setEdit] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [cell, setCell] = useState(80);
  const [ready, setReady] = useState(false);
  const grid = useRef<HTMLDivElement>(null);
  const live = useRef({ layout, drag, cell });
  live.current = { layout, drag, cell };

  useEffect(() => {
    try {
      const saved: Box[] | null = JSON.parse(localStorage.getItem(KEY) || "null");
      if (saved) setLayout(saved.filter((b) => byId[b.id]));
    } catch {}
    setReady(true);
    const el = grid.current!;
    const ro = new ResizeObserver(() => setCell(el.clientWidth / COLS));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (ready) try { localStorage.setItem(KEY, JSON.stringify(layout)); } catch {}
  }, [layout, ready]);

  // One window-level pointer loop drives move, resize and drag-in from the tray.
  const active = drag !== null;
  useEffect(() => {
    if (!active) return;
    const onMove = (e: PointerEvent) => {
      const { layout: l, drag: d, cell: c } = live.current;
      if (!d) return;
      const gr = grid.current!.getBoundingClientRect();
      const x = e.clientX - gr.left, y = e.clientY - gr.top;
      const others = l.filter((o) => o.id !== d.id);
      const cur = l.find((o) => o.id === d.id);
      if (d.kind === "move" && cur) {
        const left = x - d.off.x, top = y - d.off.y;
        const target = freeSpot(others, { ...cur, x: clamp(Math.round(left / c), 0, COLS - cur.w), y: Math.max(0, Math.round(top / c)) });
        setDrag({ ...d, px: left, py: top, target });
      } else if (d.kind === "resize" && cur) {
        const w = clamp(Math.round(x / c) - cur.x, MIN.w, COLS - cur.x), h = Math.max(MIN.h, Math.round(y / c) - cur.y);
        const cand = { ...cur, w, h };
        setDrag({ ...d, target: others.some((o) => overlap(cand, o)) ? d.target : cand });
      } else if (d.kind === "add") {
        const inside = e.clientX > gr.left - 20 && e.clientX < gr.right + 20 && e.clientY > gr.top - 20 && e.clientY < gr.bottom + 60;
        const target = inside
          ? freeSpot(l, { id: d.id, ...DEF, x: clamp(Math.round((x - DEF.w * c / 2) / c), 0, COLS - DEF.w), y: Math.max(0, Math.round((y - DEF.h * c / 2) / c)) })
          : null;
        setDrag({ ...d, px: e.clientX, py: e.clientY, target });
      }
    };
    const onUp = () => {
      const { layout: l, drag: d } = live.current;
      setDrag(null);
      if (!d?.target) return;
      setLayout(d.kind === "add" ? [...l, d.target] : l.map((o) => (o.id === d.id ? d.target! : o)));
    };
    addEventListener("pointermove", onMove);
    addEventListener("pointerup", onUp);
    addEventListener("pointercancel", onUp);
    return () => {
      removeEventListener("pointermove", onMove);
      removeEventListener("pointerup", onUp);
      removeEventListener("pointercancel", onUp);
    };
  }, [active]);

  const begin = (e: React.PointerEvent, kind: Drag["kind"], b: Box) => {
    if (!edit || e.button > 0) return;
    e.preventDefault();
    const gr = grid.current!.getBoundingClientRect();
    setDrag({ kind, id: b.id, px: b.x * cell, py: b.y * cell, off: { x: e.clientX - gr.left - b.x * cell, y: e.clientY - gr.top - b.y * cell }, target: null });
  };
  const add = (id: string) => setLayout([...layout, freeSpot(layout, { id, x: 0, y: 0, ...DEF })]);
  const remove = (id: string) => setLayout(layout.filter((o) => o.id !== id));
  // Arrow keys move a focused card, Shift+arrows resize it, Delete removes it.
  const key = (e: React.KeyboardEvent, b: Box) => {
    if (!edit || e.target !== e.currentTarget) return;
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); return remove(b.id); }
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const c = e.shiftKey
      ? { ...b, w: clamp(b.w + d[0], MIN.w, COLS - b.x), h: Math.max(MIN.h, b.h + d[1]) }
      : { ...b, x: clamp(b.x + d[0], 0, COLS - b.w), y: Math.max(0, b.y + d[1]) };
    if (!layout.some((o) => o.id !== b.id && overlap(c, o))) setLayout(layout.map((o) => (o.id === b.id ? c : o)));
  };

  const hidden = widgets.filter((w) => !layout.some((b) => b.id === w.title));
  const rows = Math.max(...layout.map((b) => b.y + b.h), 1) + (edit ? 3 : 0);

  return (
    <>
      <div className="col">
      <div className="bar">
        {edit && <button className="btn" onClick={() => setLayout(initial)}>Reset</button>}
        <button className="btn" onClick={() => setProfileOpen(true)}>Edit profile</button>
        <button className={`btn ${edit ? "on" : ""}`} onClick={() => setEdit(!edit)}>{edit ? "Done" : "Customise"}</button>
      </div>
      <main className="stage">
        <div ref={grid} className={`canvas ${edit ? "editing" : ""}`} style={{ "--cell": `${cell}px`, height: rows * cell } as React.CSSProperties}>
          {drag?.target && <div className="ghost" style={px(drag.target, cell)} />}
          {layout.map((b) => {
            const w = byId[b.id];
            const moving = drag?.id === b.id && drag.kind === "move";
            const size = drag?.id === b.id && drag.kind === "resize" && drag.target ? drag.target : b;
            const style = moving ? { ...px(b, cell), left: drag!.px + GAP, top: drag!.py + GAP } : px(size, cell);
            return (
              <article
                key={b.id}
                className={`widget glow ${edit ? "editing" : ""} ${moving ? "dragging" : ""}`}
                onPointerMove={glow}
                style={style}
                tabIndex={edit ? 0 : -1}
                onPointerDown={(e) => { if (!(e.target as HTMLElement).closest("button,.resize")) begin(e, "move", b); }}
                onKeyDown={(e) => key(e, b)}
              >
                {edit && <button className="x" aria-label={`Remove ${b.id}`} onClick={() => remove(b.id)}>×</button>}
                <div className="whead">
                  <h4 className="label">{w.title}</h4>
                  {w.tone && !edit && <span className={`status ${w.tone}`}>{w.tone === "review" ? "Needs you" : "OK"}</span>}
                </div>
                <p className="big num"><CountUp text={w.big} /></p>
                <p className="sub">{w.sub}</p>
                {w.bars && <Bars values={w.bars} />}
                {edit && <span className="resize" onPointerDown={(e) => { e.stopPropagation(); begin(e, "resize", b); }} />}
              </article>
            );
          })}
        </div>
        {edit && (
          <div className="tray">
            <span>{hidden.length ? "Drag onto the canvas, or tap:" : "Every widget is on the canvas."}</span>
            {hidden.map((w) => (
              <button key={w.title} className="btn chipbtn" onPointerDown={(e) => begin(e, "add", { id: w.title, x: 0, y: 0, ...DEF })} onClick={() => add(w.title)}>+ {w.title}</button>
            ))}
          </div>
        )}
        {drag?.kind === "add" && <div className="chip-drag" style={{ left: drag.px, top: drag.py }}>{drag.id}</div>}
      </main>
      </div>
      <aside className="side">
        <List title="Reminder" items={reminders} />
        <List title="Upcoming" items={upcoming} />
        <div className="chat">
          {msgs.length > 0 && (
            <div className="msgs" aria-live="polite">
              {msgs.map((m, i) => <p key={i} className={m.from}>{m.text}</p>)}
              {busy && <p className="bot thinking">Thinking…</p>}
              <div ref={msgsEnd} />
            </div>
          )}
          <h2>Hi {profile.owner || owner}, how can we help you?</h2>
          <form className="pill glow" onPointerMove={glow} onSubmit={send}>
            <input placeholder="Ask your team anything" aria-label="Message" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <button aria-label="Send" disabled={busy}>↑</button>
          </form>
        </div>
      </aside>
      <ProfileDialog open={profileOpen} profile={profile} onSave={saveProfile} onClose={() => setProfileOpen(false)} />
    </>
  );
}
