"use client";
import { useEffect, useRef, useState } from "react";
import Avatar from "./Avatar";
import { agents, script } from "@/lib/data";

// Seat centres as % of the room (top, right, bottom, left of the table).
const SEATS = [{ x: 50, y: 15 }, { x: 82, y: 50 }, { x: 50, y: 85 }, { x: 18, y: 50 }];
const byId = (id: string) => agents.find((a) => a.id === id)!;

export default function Meeting() {
  const [seats, setSeats] = useState<(string | null)[]>([null, null, null, null]);
  const [turn, setTurn] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [sched, setSched] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const seated = seats.filter(Boolean) as string[];
  const plan = script.filter((t) => seated.includes(t.from) && seated.includes(t.to));
  const seatOf = (id: string) => SEATS[seats.indexOf(id)];
  const cur = playing && turn >= 0 ? plan[turn] : undefined;

  // any change at the table restarts the conversation
  useEffect(() => { setPlaying(false); setTurn(-1); }, [seats]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setTurn((n) => {
      if (n + 1 >= plan.length) { setPlaying(false); return n; }
      return n + 1;
    }), 3400);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, plan.length]);

  useEffect(() => { logRef.current?.scrollTo({ top: 1e6, behavior: "smooth" }); }, [turn]);

  const seat = (i: number, id: string) =>
    setSeats((s) => s.map((x, j) => (j === i ? id : x === id ? null : x)));

  const start = () => { setTurn(0); setPlaying(true); };

  return (
    <main className="meeting">
      <div className="room">
        <div className="chips">
          <span className={`chip ${playing ? "live" : ""}`}>{playing ? "Meeting now" : "Table is quiet"}</span>
          <span className="chip">Next standup meeting: 20:00</span>
        </div>

        <div className="controls">
          <button className="btn primary" disabled={seated.length < 2} onClick={playing ? () => setPlaying(false) : start}>
            {playing ? "Stop talking" : "Start talking"}
          </button>
          <button className={`btn ${sched ? "on" : ""}`} disabled={!seated.length} onClick={() => setSched((v) => !v)}>
            Next schedule
          </button>
        </div>

        <div className="table">{seated.length === 0 && <em>Drag the characters from the sidebar onto a seat</em>}</div>

        {cur && cur.act === "point" && (
          <svg className="beam" viewBox="0 0 100 100" preserveAspectRatio="none" key={`p${turn}`}>
            <line x1={seatOf(cur.from).x} y1={seatOf(cur.from).y} x2={seatOf(cur.to).x} y2={seatOf(cur.to).y} />
          </svg>
        )}
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
          return (
            <div
              key={i}
              className={`seat ${a ? "taken" : ""} ${standing ? "standing" : ""} ${target ? "target" : ""}`}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const d = e.dataTransfer.getData("text/plain"); if (d) seat(i, d); }}
            >
              {a ? (
                <>
                  <Avatar shape={a.shape} size={72} />
                  <b>{a.name}</b>
                  <button className="x" aria-label={`Remove ${a.name}`} onClick={() => setSeats((s) => s.map((v, j) => (j === i ? null : v)))}>×</button>
                  {sched && <span className="next">{a.next}</span>}
                </>
              ) : <span className="empty">Drop here</span>}
            </div>
          );
        })}
      </div>

      <div className="transcript" ref={logRef}>
        {!playing && turn < 0 && <p className="hint">{seated.length < 2 ? "Seat at least two agents, then press Start talking." : "Press Start talking."}</p>}
        {plan.slice(0, turn + 1).map((t, i) => (
          <p key={i} className={i === turn && playing ? "now" : ""}>
            <b>{byId(t.from).name}</b> <span className="arrow">→ {byId(t.to).name}</span> {t.text}
          </p>
        ))}
      </div>
    </main>
  );
}
