"use client";
import { useState } from "react";
import Rail from "@/components/Rail";
import Dashboard from "@/components/Dashboard";
import Meeting from "@/components/Meeting";

// One landing page, two views: dashboard (page 1) and the round table (page 2).
export default function Home() {
  const [view, setView] = useState<"dash" | "table">("dash");
  return (
    <div className="shell">
      <Rail view={view} onView={setView} />
      {view === "table" ? <Meeting /> : <Dashboard />}
    </div>
  );
}
