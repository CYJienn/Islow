"use client";
import { useState } from "react";
import Rail from "@/components/Rail";
import Dashboard from "@/components/Dashboard";
import Meeting from "@/components/Meeting";

// One landing page, two views: dashboard (page 1) and the round table (page 2).
// The chat box can call the round table: `council` carries the question and the manager's answer.
export default function Home() {
  const [view, setView] = useState<"dash" | "table">("dash");
  const [council, setCouncil] = useState<{ question: string; answer: string; turns: { agent: string; text: string }[] } | null>(null);
  return (
    <div className="shell">
      <Rail view={view} onView={(v) => { setCouncil(null); setView(v); }} />
      {view === "table"
        ? <Meeting council={council} />
        : <Dashboard onCouncil={(question, answer, turns) => { setCouncil({ question, answer, turns }); setView("table"); }} />}
    </div>
  );
}
