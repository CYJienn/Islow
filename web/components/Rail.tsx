import Buddy from "./Buddy";
import ThemeToggle from "./ThemeToggle";
import { agents } from "@/lib/data";

type View = "dash" | "table";

// Agents are drag sources: drop one on a seat at the round table.
export default function Rail({ view, onView }: { view: View; onView: (v: View) => void }) {
  const open = view === "table";
  return (
    <aside className={`rail ${open ? "open" : ""}`}>
      <button className="logo" onClick={() => onView("dash")} aria-label="Home">K</button>
      <button className={`rail-item ${open ? "on" : ""}`} onClick={() => onView("table")} title="Round table">
        <span className="avatar" style={{ width: 44, height: 44 }}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6"><ellipse cx="12" cy="12" rx="8" ry="5" /></svg>
        </span>
        {open && <span>Round table</span>}
      </button>
      <nav>
        {agents.map((a) => (
          <button
            key={a.id}
            className="rail-item"
            draggable
            onDragStart={(e) => e.dataTransfer.setData("text/plain", a.id)}
            onClick={() => onView("table")}
            title={`${a.name}: drag onto the table`}
          >
            <Buddy id={a.id} size={44} />
            {open && <span>{a.name}</span>}
          </button>
        ))}
      </nav>
      <ThemeToggle />
    </aside>
  );
}
