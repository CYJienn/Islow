import Buddy from "./Buddy";
import ThemeToggle from "./ThemeToggle";
import { agents } from "@/lib/data";

type View = "dash" | "table";

// Icon rail. The characters live in the round table's right-hand panel; here they are shortcuts to it.
export default function Rail({ view, onView }: { view: View; onView: (v: View) => void }) {
  return (
    <aside className="rail">
      <button className="logo" onClick={() => onView("dash")} aria-label="Home">K</button>
      <button className={`rail-item ${view === "table" ? "on" : ""}`} onClick={() => onView("table")} title="Round table">
        <span className="avatar" style={{ width: 44, height: 44 }}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 6v12M6 12h12" strokeLinecap="round" /></svg>
        </span>
      </button>
      {view === "dash" && (
        <nav>
          {agents.map((a) => (
            <button key={a.id} className="rail-item" onClick={() => onView("table")} title={`${a.name}: open the round table`}>
              <Buddy id={a.id} size={44} />
            </button>
          ))}
        </nav>
      )}
      <ThemeToggle />
    </aside>
  );
}
