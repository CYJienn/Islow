"use client";
import { useEffect, useRef, useState } from "react";
import { owner, reminders, upcoming } from "@/lib/data";
import { LIST, START, WIDGETS, Widget, useStore } from "./Widgets";
import FinanceReport from "./FinanceReport";
import ProfileDialog, { KEY as PROFILE_KEY, emptyProfile, loadProfile, chatBody, type Profile } from "./ProfileDialog";

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="card">
      <h3>{title}</h3>
      <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </section>
  );
}

type Rect = { x: number; y: number; w: number; h: number };
type Box = Rect & { id: string };
type Cell = { x: number; y: number };
type Drag = { kind: "move" | "resize" | "add"; id: string; px: number; py: number; off: { x: number; y: number }; target: Box | null };

const KEY = "kaunter-layout-v4";
// 8 columns; row height is fitted so the 6-row default fills the screen. Any widget can shrink to 1x1.
const COLS = 8, ROWS = 6, DEF = { w: 2, h: 2 }, MIN = { w: 1, h: 1 };
// Default layout (see START in Widgets.tsx): x, y, w, h in grid cells.
const initial: Box[] = LIST.map((w) => { const [x, y, ww, h] = START[w.id]; return { id: w.id, x, y, w: ww, h }; });

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const GAP = 6; // half the space between cards: each card is inset by this on every side
const px = (b: Rect, c: Cell) => ({ left: b.x * c.x + GAP, top: b.y * c.y + GAP, width: b.w * c.x - 2 * GAP, height: b.h * c.y - 2 * GAP });

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

  const store = useStore();
  const [layout, setLayout] = useState<Box[]>(initial);
  const [edit, setEdit] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [cell, setCell] = useState<Cell>({ x: 80, y: 100 });
  const [ready, setReady] = useState(false);
  const grid = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLElement>(null);
  const live = useRef({ layout, drag, cell });
  live.current = { layout, drag, cell };

  useEffect(() => {
    try {
      const saved: Box[] | null = JSON.parse(localStorage.getItem(KEY) || "null");
      if (saved) setLayout(saved.filter((b) => WIDGETS[b.id]));
    } catch {}
    setReady(true);
    const g = grid.current!, s = stage.current!;
    // Column width from the canvas width; row height from the stage height, so the default layout needs no scrolling.
    const measure = () => {
      const x = g.clientWidth / COLS, y = clamp((s.clientHeight - 40) / ROWS, 96, x * 1.35);
      setCell((c) => (c.x === x && c.y === y ? c : { x, y }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(g); ro.observe(s);
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
        const target = freeSpot(others, { ...cur, x: clamp(Math.round(left / c.x), 0, COLS - cur.w), y: Math.max(0, Math.round(top / c.y)) });
        setDrag({ ...d, px: left, py: top, target });
      } else if (d.kind === "resize" && cur) {
        const w = clamp(Math.round(x / c.x) - cur.x, MIN.w, COLS - cur.x), h = Math.max(MIN.h, Math.round(y / c.y) - cur.y);
        const cand = { ...cur, w, h };
        setDrag({ ...d, target: others.some((o) => overlap(cand, o)) ? d.target : cand });
      } else if (d.kind === "add") {
        const inside = e.clientX > gr.left - 20 && e.clientX < gr.right + 20 && e.clientY > gr.top - 20 && e.clientY < gr.bottom + 60;
        const target = inside
          ? freeSpot(l, { id: d.id, ...DEF, x: clamp(Math.round((x - DEF.w * c.x / 2) / c.x), 0, COLS - DEF.w), y: Math.max(0, Math.round((y - DEF.h * c.y / 2) / c.y)) })
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
    setDrag({ kind, id: b.id, px: b.x * cell.x, py: b.y * cell.y, off: { x: e.clientX - gr.left - b.x * cell.x, y: e.clientY - gr.top - b.y * cell.y }, target: null });
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

  const hidden = LIST.filter((w) => !layout.some((b) => b.id === w.id));
  const rows = Math.max(...layout.map((b) => b.y + b.h), 1) + (edit ? 3 : 0);

  return (
    <>
      <div className="col">
      <div className="bar">
        {edit && <span className="edit-hint">Drag a widget to move it, pull its corner to resize it</span>}
        {edit && <button className="btn" onClick={() => setLayout(initial)}>Reset</button>}
        <button className="btn" onClick={() => setProfileOpen(true)}>Edit profile</button>
        <button className={`btn ${edit ? "on" : ""}`} onClick={() => setEdit(!edit)}>{edit ? "Done" : "Customise"}</button>
      </div>
      <main className="stage" ref={stage}>
        <div ref={grid} className={`canvas ${edit ? "editing" : ""}`} style={{ "--cx": `${cell.x}px`, "--cy": `${cell.y}px`, height: rows * cell.y } as React.CSSProperties}>
          {drag?.target && <div className="ghost" style={px(drag.target, cell)} />}
          {layout.map((b) => {
            const w = WIDGETS[b.id];
            const moving = drag?.id === b.id && drag.kind === "move";
            const size = drag?.id === b.id && drag.kind === "resize" && drag.target ? drag.target : b;
            const box = px(size, cell);
            const style = moving ? { ...px(b, cell), left: drag!.px + GAP, top: drag!.py + GAP } : box;
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
                {edit && <button className="x" aria-label={`Remove ${w.title}`} onClick={() => remove(b.id)}>×</button>}
                <Widget def={w} W={box.width} H={box.height} edit={edit} ctx={store} />
                {edit && <span className="resize" onPointerDown={(e) => { e.stopPropagation(); begin(e, "resize", b); }} />}
              </article>
            );
          })}
        </div>
        {edit && (
          <div className="tray">
            <span>{hidden.length ? "Drag onto the canvas, or tap:" : "Every widget is on the canvas."}</span>
            {hidden.map((w) => (
              <button key={w.id} className="btn chipbtn" onPointerDown={(e) => begin(e, "add", { id: w.id, x: 0, y: 0, ...DEF })} onClick={() => add(w.id)}>+ {w.title}</button>
            ))}
          </div>
        )}
        {drag?.kind === "add" && <div className="chip-drag" style={{ left: drag.px, top: drag.py }}>{WIDGETS[drag.id]?.title}</div>}
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
          <FinanceReport />
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
