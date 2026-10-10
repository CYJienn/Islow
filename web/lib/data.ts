// Demo data only. SYNTHETIC: no real people or customers.
// `color` is the agent's identity dot (matches its Buddy eye colour); `tag` is the short role shown on widgets.
export type Agent = { id: string; name: string; role: string; shape: "circle" | "triangle" | "square" | "ring"; next: string; color: string; tag: string };

export const agents: Agent[] = [
  { id: "manager", name: "Manager", role: "Runs the team", shape: "circle", next: "Standup, today 20:00", color: "#3ee6b0", tag: "Manager" },
  { id: "marketing", name: "Marketing lead", role: "Promos & posts", shape: "triangle", next: "Weekend promo post, tomorrow 09:00", color: "#ff4d8d", tag: "Marketing" },
  { id: "finance", name: "Finance and Ops lead", role: "Cash, stock, invoices", shape: "square", next: "Supplier payment run, today 17:00", color: "#ffc400", tag: "Finance" },
  { id: "legal", name: "Legal Team lead", role: "Contracts & compliance", shape: "square", next: "Supplier contract review, tomorrow 11:00", color: "#8a5cff", tag: "Legal" },
  { id: "assistant", name: "Personal Assist.", role: "Your day, sorted", shape: "ring", next: "Bank appointment prep, tomorrow 08:30", color: "#4aa8ff", tag: "Assistant" },
];

export const owner = "Kai";

export const reminders = ["Collect parcel from courier, 17:00", "Ingat telefon pembekal, 09:00"];
export const upcoming = ["Call pembekal tepung, 15:30", "Bank appointment, tomorrow 10:00"];

// Demo "today" for the dashboard widgets. Only the time of day comes from the real clock.
export const TODAY = "2026-10-11";

// Finance: takings Mon..Sun (RM). Sunday is today, still counting. Last week was RM 8,071.
export const sales = { days: [["Mon", 1120], ["Tue", 1380], ["Wed", 960], ["Thu", 1710], ["Fri", 1490], ["Sat", 1650], ["Sun", 730]] as [string, number][], lastWeek: 8071 };

// Finance: the invoice check summary, same fields the Invoice Assurance report.json carries.
export const invoiceCheck = {
  checked: 14, verified: 11, needsEvidence: 1, exposure: 640,
  flagged: [
    { ref: "INV-2041", vendor: "Tepung Maju", rm: 380, why: "Bank account differs from vendor record" },
    { ref: "INV-2057", vendor: "Minyak Sawit KL", rm: 260, why: "Duplicate invoice reference" },
  ],
};

// Marketing: ranked campaigns, review stars (1..5), and rival prices.
export const campaigns = [
  { name: "Flour & oil bundle", score: 86, gain: 1200 },
  { name: "Weekend sambal 2-for-1", score: 74, gain: 780 },
  { name: "Cafe loyalty stamp card", score: 63, gain: 540 },
  { name: "Free delivery over RM 150", score: 55, gain: 410 },
  { name: "Deepavali pre-order pack", score: 41, gain: 300 },
];
export const campaignEvidence = ["3 of 5 rivals run bundle promos this month", "62% of reviews mention price", "Budget cap RM 300, set by Finance"];
export const stars: [string, number][] = [["1★", 3], ["2★", 5], ["3★", 12], ["4★", 31], ["5★", 49]];
export const reviewThemes = ["Price (62% of reviews)", "Late delivery (18%)", "Fresh stock (14%)"];
export const rivals = [
  { item: "Flour 1kg", ours: 2.6, others: [2.9, 3.0, 2.7] },
  { item: "Cooking oil 1kg", ours: 6.2, others: [5.9, 6.4, 6.1] },
  { item: "Sambal 200g", ours: 7.5, others: [8.0, 7.9, 8.5] },
];

// Legal: one clause checked against the playbook (days). Preferred up to 30, fallback up to 60, walk-away beyond.
export const contract = {
  name: "Supplier contract", term: "Payment terms", days: 90, preferred: 30, fallback: 60,
  clauses: [
    { name: "Payment terms", value: "90 days", level: "stop" as const },
    { name: "Termination notice", value: "30 days", level: "review" as const },
    { name: "Governing law", value: "Malaysia", level: "ok" as const },
  ],
};

// Manager: calendar items and to-dos. `agent` decides the dot colour.
export type Ev = { id: string; date: string; time: string; title: string; agent: string };
export const events: Ev[] = [
  { id: "e1", date: "2026-10-11", time: "15:30", title: "Call pembekal tepung", agent: "assistant" },
  { id: "e2", date: "2026-10-11", time: "17:00", title: "Supplier payment run", agent: "finance" },
  { id: "e3", date: "2026-10-11", time: "20:00", title: "Standup: freezer decision", agent: "manager" },
  { id: "e4", date: "2026-10-12", time: "08:30", title: "Bank appointment prep", agent: "assistant" },
  { id: "e5", date: "2026-10-12", time: "09:00", title: "Weekend promo post", agent: "marketing" },
  { id: "e6", date: "2026-10-12", time: "10:00", title: "Bank appointment", agent: "assistant" },
  { id: "e7", date: "2026-10-12", time: "11:00", title: "Supplier contract review", agent: "legal" },
  { id: "e8", date: "2026-10-15", time: "14:00", title: "Freezer supplier visit", agent: "manager" },
  { id: "e9", date: "2026-10-17", time: "10:00", title: "Weekend promo starts", agent: "marketing" },
  { id: "e10", date: "2026-10-30", time: "09:00", title: "Month-end accountant pack", agent: "finance" },
];
export type Todo = { id: string; text: string; due: string; agent: string; done: boolean };
export const todos: Todo[] = [
  { id: "t1", text: "Bayar sewa kedai", due: "2026-10-10", agent: "assistant", done: false },
  { id: "t2", text: "Decide on the new freezer", due: "2026-10-11", agent: "manager", done: false },
  { id: "t3", text: "Approve weekend promo draft", due: "2026-10-12", agent: "marketing", done: false },
  { id: "t4", text: "Reply to flour supplier quote", due: "2026-10-11", agent: "finance", done: true },
];

// A discussion turn. The speaker always stands; `act` adds a gesture toward `to`.
export type Turn = { from: string; to: string; act: "throw" | "point" | "stand"; text: string };

export const script: Turn[] = [
  { from: "manager", to: "finance", act: "throw", text: "Finance, send me the cash report. Can we afford the new freezer this month?" },
  { from: "finance", to: "manager", act: "throw", text: "Cash is fine if we delay the stock top-up by two days." },
  { from: "manager", to: "marketing", act: "point", text: "Marketing, can a weekend promo cover the gap?" },
  { from: "marketing", to: "finance", act: "throw", text: "Yes, the draft is ready. Finance, what budget cap do I get?" },
  { from: "finance", to: "marketing", act: "point", text: "RM 300 maximum, and only on the flour and oil bundles." },
  { from: "manager", to: "legal", act: "point", text: "Legal, is the supplier contract safe to sign before we commit the promo budget?" },
  { from: "legal", to: "manager", act: "throw", text: "One clause needs changing: 90-day payment terms. I will send a redline today." },
  { from: "assistant", to: "manager", act: "stand", text: "Noted. I will put the freezer decision on Kai's list for 20:00." },
];

// Question bank: shown when the owner presses "Start talking".
export const questions = [
  "Can we afford the new freezer this month?",
  "What should this weekend's promo be?",
  "Which supplier invoices are due this week?",
  "What stock will run out first, and when do we reorder?",
  "How do we plan Kai's day tomorrow?",
];
