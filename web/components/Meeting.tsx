"use client";
import { useEffect, useRef, useState } from "react";
import Buddy, { Crown } from "./Buddy";
import { agents, questions, script, type Turn } from "@/lib/data";
import { chatBody, loadProfile } from "./ProfileDialog";

// Seat centres as % of the room (top, right, bottom, left of the table).
const SEATS = [{ x: 50, y: 16 }, { x: 84, y: 50 }, { x: 64, y: 84 }, { x: 36, y: 84 }, { x: 16, y: 50 }];
// Which edge each sofa has its back against. Every sofa faces the table.
const SIDE = ["top", "right", "bottom", "bottom", "left"] as const;
const byId = (id: string) => agents.find((a) => a.id === id)!;

const WALK_MS = 2200;
export type ApiTurn = { agent: string; text: string };
const SPEECH_MS = 2000;
const plainSpeech = (text: string) => text
  .replace(/\*\*|__/g, "")
  .replace(/`/g, "")
  .replace(/^#{1,6}\s+/gm, "");
function speechChunks(text: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let chunk = "";
  for (const word of words) {
    if (chunk && (chunk.length + word.length + 1 > 180 || (chunk.length >= 100 && /[.!?]$/.test(chunk)))) {
      chunks.push(chunk);
      chunk = "";
    }
    chunk = chunk ? `${chunk} ${word}` : word;
  }
  if (chunk) chunks.push(chunk);
  return chunks.length ? chunks : [""];
}

// Manager opens, each specialist reports back, manager closes. These are the backend's real answers.
function toPlan(q: string, turns: ApiTurn[]): Turn[] {
  const first = turns.find((t) => t.agent !== "manager")?.agent ?? "manager";
  const plan: Turn[] = [{ from: "manager", to: first, act: "point", text: `Team, the question is: ${q}` }];
  turns.forEach((t, index) => {
    if (t.agent === "manager") {
      const next = turns.slice(index + 1).find(next => next.agent !== "manager")?.agent ?? first;
      plan.push({ from: "manager", to: next, act: "stand", text: t.text });
    } else {
      if (index === 0 || turns[index - 1].agent !== "manager")
        plan.push({ from: "manager", to: t.agent, act: "point", text: `${byId(t.agent).name}, you are next.` });
      plan.push({ from: t.agent, to: "manager", act: "throw", text: t.text });
    }
  });
  return plan;
}

// Top-down 2D sofa: backrest, two arms, two cushions. Drawn once facing down, then rotated per side.
function Sofa({ side }: { side: (typeof SIDE)[number] }) {
  const flat = side === "top" || side === "bottom";
  const [w, h] = flat ? [220, 120] : [120, 220];
  const t = { top: "", bottom: "translate(220 120) rotate(180)", left: "translate(0 220) rotate(-90)", right: "translate(120 0) rotate(90)" }[side];
  return (
    <svg className="sofa" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <g transform={t}>
        <rect className="part" x="0" y="0" width="220" height="26" rx="12" />
        <rect className="part" x="0" y="10" width="26" height="110" rx="12" />
        <rect className="part" x="194" y="10" width="26" height="110" rx="12" />
        <rect className="part" x="30" y="30" width="75" height="86" rx="10" />
        <rect className="part" x="115" y="30" width="75" height="86" rx="10" />
      </g>
    </svg>
  );
}

// Walks in from the nearest side of the room on 16 pixel-steps, then sits down.
function Walker({ id, dx }: { id: string; dx: number }) {
  const [phase, setPhase] = useState<"start" | "walk" | "sit">("start");
  const [step, setStep] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setPhase("walk")));
    const t = setTimeout(() => setPhase("sit"), WALK_MS);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, []);
  useEffect(() => {
    if (phase !== "walk") return;
    const i = setInterval(() => setStep((v) => !v), 140);
    return () => clearInterval(i);
  }, [phase]);
  return (
    <span
      className={`walker ${phase}`}
      style={{ transform: phase === "start" ? `translateX(${dx}px)` : "none", transitionDuration: phase === "walk" ? `${WALK_MS}ms` : "0ms" }}
    >
      {id === "manager" && <Crown />}
      <span style={{ display: "block", transform: dx > 0 && phase !== "sit" ? "scaleX(-1)" : "none" }}>
        <Buddy id={id} size={72} pose={phase === "sit" ? "sit" : phase === "walk" && step ? "step" : "stand"} />
      </span>
    </span>
  );
}

// Replace each complete speech chunk while the same character keeps speaking.
function Bubble({ text, side, listen }: { text: string; side: "l" | "r"; listen?: boolean }) {
  const [visibleChars, setVisibleChars] = useState(0);
  useEffect(() => {
    setVisibleChars(0);
    if (listen) return;
    const started = performance.now();
    // Reveal the whole chunk within the existing two-second speech interval.
    const typingMs = 1200;
    let frame: number;
    const reveal = () => {
      const progress = Math.min(1, (performance.now() - started) / typingMs);
      setVisibleChars(Math.ceil(progress * text.length));
      if (progress < 1) frame = requestAnimationFrame(reveal);
    };
    frame = requestAnimationFrame(reveal);
    return () => cancelAnimationFrame(frame);
  }, [text, listen]);
  return listen
    ? <div className={`pbox think ${side}`}><i /><i /><i /></div>
    : <div className={`pbox say ${side}`}>{text.slice(0, visibleChars)}</div>;
}

export default function Meeting({ council }: { council?: { question: string; answer: string; turns?: ApiTurn[] } | null }) {
  const [seats, setSeats] = useState<(string | null)[]>(council ? agents.map((a) => a.id) : SEATS.map(() => null));
  const [turn, setTurn] = useState(-1);
  const [speechPart, setSpeechPart] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [topic, setTopic] = useState("");
  const [custom, setCustom] = useState("");
  const [live, setLive] = useState<Turn[] | null>(null); // the manager's real turns; null = play the demo script
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false); // a character is being dragged: light up the free sofas
  const [over, setOver] = useState<number | null>(null);
  // Character column: collapsed to icons, opens on hover, closes as soon as the pointer leaves (never mid-drag).
  const [teamOpen, setTeamOpen] = useState(false);
  const dragRef = useRef(false);
  dragRef.current = dragging;
  const openTeam = () => setTeamOpen(true);
  const closeTeam = () => { if (!dragRef.current) setTeamOpen(false); }; // stays open while a character is being dragged
  const [now, setNow] = useState(() => new Date());
  const [started, setStarted] = useState<Date | null>(null);
  const [ended, setEnded] = useState<Date | null>(null);
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (!playing && started) setEnded((e) => e ?? new Date()); }, [playing, started]);
  const hhmm = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  const secs = started ? Math.max(0, Math.round(((ended ?? now).getTime() - started.getTime()) / 1000)) : 0;
  const elapsed = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;

  const seated = seats.filter(Boolean) as string[];
  const plan = (live ?? script)
    .filter((t) => seated.includes(t.from) && seated.includes(t.to))
    .map(t => ({ ...t, text: plainSpeech(t.text) }));
  const seatOf = (id: string) => SEATS[seats.indexOf(id)];
  const cur = playing && turn >= 0 ? plan[turn] : undefined;
  const chunks = speechChunks(cur?.text ?? "");

  // any change at the table restarts the conversation
  useEffect(() => { setPlaying(false); setTurn(-1); }, [seats]);

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      if (speechPart + 1 < chunks.length) {
        setSpeechPart(n => n + 1);
      } else {
        setSpeechPart(0);
        setTurn(n => {
          if (n + 1 >= plan.length) { setPlaying(false); return n; }
          return n + 1;
        });
      }
    }, SPEECH_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, turn, speechPart, chunks.length, plan.length]);

  useEffect(() => { setSpeechPart(0); }, [turn, seats]);

  useEffect(() => { logRef.current?.scrollTo({ top: 1e6, behavior: "smooth" }); }, [turn]);

  // Called from chat: everyone walks in, then the question is put to the table.
  useEffect(() => {
    if (!council) return;
    const t = setTimeout(() => start(council.question), WALK_MS + 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const on = () => setDragging(true), off = () => { setDragging(false); setOver(null); };
    addEventListener("dragstart", on); addEventListener("dragend", off); addEventListener("drop", off);
    return () => { removeEventListener("dragstart", on); removeEventListener("dragend", off); removeEventListener("drop", off); };
  }, []);

  const seat = (i: number, id: string) =>
    setSeats((s) => s.map((x, j) => (j === i ? id : x === id ? null : x)));

  // Download the finished session as a Markdown report: topic, times, who was there, the discussion, the manager's answer.
  const report = () => {
    if (!started) return;
    const lines = [
      "# Session report", "",
      `- **Topic:** ${topic}`,
      `- **Date:** ${started.toLocaleDateString()}`,
      `- **Started:** ${hhmm(started)}`,
      `- **Duration:** ${elapsed}`,
      `- **At the table:** ${seated.map((id) => byId(id).name).join(", ")}`,
      "", "## Discussion", "",
      ...plan.slice(0, turn + 1).map((t) => `- **${byId(t.from).name} → ${byId(t.to).name}:** ${t.text}`),
      ...(council && !live ? ["", "## Manager's answer", "", plainSpeech(council.answer)] : []),
      "",
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `session-report-${started.toISOString().slice(0, 10)}-${hhmm(started).replace(":", "")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Put the topic to the manager (POST /api/v1/chat). If the backend is down, play the demo script instead.
  const start = async (q: string) => {
    setTopic(q); setCustom(""); setTurn(-1); setStarted(new Date()); setEnded(null); setNote(""); setBusy(true);
    let turns: ApiTurn[] | undefined = council && council.question === q ? council.turns : undefined;
    if (!turns?.length) {
      try {
        const r = await fetch("/api/v1/chat", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(chatBody(loadProfile(), q, { seated })),
        });
        const d = await r.json();
        if (d.type === "error") setNote(d.message);
        turns = d.turns;
      } catch { setNote("The backend is not reachable, so this is the demo script."); }
    }
    setLive(turns?.length ? toPlan(q, turns) : null);
    setBusy(false); setTurn(0); setPlaying(true);
  };

  return (
    <>
    <aside className="session">
      <div className="session-head">
        <span className="label">Session</span>
        {playing && <span className="chip live"><i className="dot" aria-hidden="true" />Live</span>}
      </div>
      <h1 className="topic-big">{topic || "No topic yet"}</h1>
      {!playing && (
        <div className="chooser">
          <span className="label">Choose a topic</span>
          <form onSubmit={(e) => { e.preventDefault(); if (custom.trim()) { setTopic(custom.trim()); setCustom(""); } }}>
            <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Type your own topic" aria-label="Your topic" />
            <button disabled={!custom.trim()}>Set</button>
          </form>
          <div className="bank">
            {questions.map((q) => <button key={q} className={q === topic ? "picked" : ""} onClick={() => setTopic(q)}>{q}</button>)}
          </div>
          <p className="session-hint">
            {seated.length < 2 ? "Seat at least two characters." : !topic ? "Pick or type a topic, then press Start talking." : "Ready. Press Start talking."}
          </p>
        </div>
      )}
      <div className="session-time">
        <span className="label">Time</span>
        <b className="num clock">{hhmm(now)}</b>
        <dl>
          <div><dt>Started</dt><dd className="num">{started ? hhmm(started) : "—"}</dd></div>
          <div><dt>Elapsed</dt><dd className="num">{elapsed}</dd></div>
          <div><dt>At the table</dt><dd className="num">{seated.length} of {agents.length}</dd></div>
        </dl>
      </div>
    </aside>
    <main className="meeting">
      <div className="room" ref={roomRef}>
        <div className="chips">
          <span className="chip">Next standup meeting: 20:00</span>
          {playing && <span className="chip live"><i className="dot" aria-hidden="true" />Table is busy</span>}
        </div>

        <div className="controls">
          <button className={`btn ${playing ? "stop" : "go"}`} disabled={busy || (!playing && (seated.length < 2 || !topic))} onClick={playing ? () => setPlaying(false) : () => start(topic)}>
            {busy ? "Team is thinking…" : playing ? "Stop talking" : "Start talking"}
          </button>
          <button className="btn" disabled={!started || playing} onClick={report} title={started ? "Download this session as a report" : "Run a session first"}>
            Generate report
          </button>
        </div>

        <div className="table">{seated.length === 0 && <em>Drag a character from the sidebar onto a sofa, or tap an empty sofa</em>}</div>

        {cur && cur.act === "throw" && (
          <div
            key={`f${turn}`}
            className="folder"
            style={{ "--x1": `${seatOf(cur.from).x}%`, "--y1": `${seatOf(cur.from).y}%`, "--x2": `${seatOf(cur.to).x}%`, "--y2": `${seatOf(cur.to).y}%` } as React.CSSProperties}
          >
            <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></svg>
          </div>
        )}

        {SEATS.map((p, i) => {
          const id = seats[i];
          const a = id ? byId(id) : null;
          const standing = !!cur && cur.from === id;
          const target = !!cur && cur.to === id;
          const spare = agents.find((x) => !seats.includes(x.id)); // tapping an empty sofa seats the next free character
          return (
            <div
              key={i}
              className={`seat ${SIDE[i]} ${a ? "taken" : "free"} ${standing ? "standing" : ""} ${target ? "target" : ""} ${dragging && !a ? "ready" : ""} ${over === i ? "over" : ""}`}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              onDragOver={(e) => e.preventDefault()}
              onDragEnter={() => setOver(i)}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null); }}
              onDrop={(e) => { e.preventDefault(); const d = e.dataTransfer.getData("text/plain"); if (d) seat(i, d); setOver(null); setDragging(false); }}
              onClick={() => { if (!a && spare) seat(i, spare.id); }}
            >
              <Sofa side={SIDE[i]} />
              <div className="sitter">
                {a ? (
                  <>
                    <Walker key={`${a.id}-${i}`} id={a.id} dx={((p.x < 50 ? -8 : p.x > 50 ? 108 : -8) - p.x) * (roomRef.current?.clientWidth ?? 800) / 100} />
                    <b>{a.name}</b>
                    <button className="x" aria-label={`Remove ${a.name}`} onClick={(e) => { e.stopPropagation(); setSeats((s) => s.map((v, j) => (j === i ? null : v))); }}>×</button>
                    {standing && cur && <Bubble key={turn} text={chunks[speechPart] ?? chunks[0]} side={p.x > 50 ? "l" : "r"} />}
                    {target && <Bubble key={`t${turn}`} text="" listen side={p.x > 50 ? "l" : "r"} />}
                  </>
                ) : <span className="empty"><i>+</i>Drop here</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="transcript" ref={logRef}>
        {!playing && turn < 0 && <p className="hint">{seated.length < 2 ? "Seat at least two agents, then press Start talking." : "Press Start talking."}</p>}
        {topic && turn >= 0 && <p className="topic"><b>Question</b> {topic}</p>}
        {note && <p className="hint">{note}</p>}
        {council && !live && !playing && turn >= 0 && <p className="topic answer"><b>Manager</b> {plainSpeech(council.answer)}</p>}
        {plan.slice(0, turn + 1).map((t, i) => (
          <p key={i} className={i === turn && playing ? "now" : ""}>
            <b>{byId(t.from).name}</b> <span className="arrow">→ {byId(t.to).name}</span> {t.text}
          </p>
        ))}
      </div>
    </main>
    <div className="team-slot">
      <aside
        className={`team ${teamOpen ? "open" : ""}`}
        onPointerEnter={openTeam}
        onPointerLeave={closeTeam}
        onFocus={openTeam}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) closeTeam(); }}
      >
        <span className="label">Characters</span>
        <p className="session-hint">Drag one onto a sofa, or tap to seat it.</p>
        {agents.map((a) => {
          const at = seated.includes(a.id);
          return (
            <button
              key={a.id}
              className={`member ${at ? "at" : ""}`}
              draggable
              title={a.name}
              onDragStart={(e) => { e.dataTransfer.setData("text/plain", a.id); openTeam(); }}
              onDragEnd={() => setTeamOpen(false)}
              onClick={() => { const i = seats.indexOf(null); if (!at && i >= 0) seat(i, a.id); }}
            >
              <Buddy id={a.id} size={48} />
              <span><b>{a.name}</b><small>{at ? "At the table" : a.role}</small></span>
            </button>
          );
        })}
      </aside>
    </div>
    </>
  );
}
