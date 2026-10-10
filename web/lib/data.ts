// Demo data only. SYNTHETIC: no real people or customers.
export type Agent = { id: string; name: string; role: string; shape: "circle" | "triangle" | "square" | "ring"; next: string };

export const agents: Agent[] = [
  { id: "manager", name: "Manager", role: "Runs the team", shape: "circle", next: "Standup, today 20:00" },
  { id: "marketing", name: "Marketing lead", role: "Promos & posts", shape: "triangle", next: "Weekend promo post, tomorrow 09:00" },
  { id: "finance", name: "Finance and Ops lead", role: "Cash, stock, invoices", shape: "square", next: "Supplier payment run, today 17:00" },
  { id: "assistant", name: "Personal Assist.", role: "Your day, sorted", shape: "ring", next: "Bank appointment prep, tomorrow 08:30" },
];

export const owner = "Kai";

export const reminders = ["Collect parcel from courier, 17:00", "Ingat telefon pembekal, 09:00"];
export const upcoming = ["Call pembekal tepung, 15:30", "Bank appointment, tomorrow 10:00"];

export const widgets: { title: string; big: string; sub: string; bars?: number[]; tone?: "review" | "ok" }[] = [
  { title: "Sales this week", big: "RM 9,040", sub: "+12% vs last week", bars: [40, 52, 36, 63, 55, 78, 52] },
  { title: "To-do", big: "3 open", sub: "1 overdue: Bayar sewa kedai", tone: "review" },
  { title: "Spend", big: "RM 1,284", sub: "Stock is 61% of it" },
  { title: "Cold room", big: "3.8 °C", sub: "Within range", tone: "ok" },
  { title: "Invoices", big: "2 unpaid", sub: "RM 640 outstanding", tone: "review" },
  { title: "Stock alert", big: "Cooking oil", sub: "About 2 days left", tone: "review" },
  { title: "Next event", big: "15:30", sub: "Call pembekal tepung" },
  { title: "Customers", big: "148", sub: "9 new this week" },
];

// A discussion turn. The speaker always stands; `act` adds a gesture toward `to`.
export type Turn = { from: string; to: string; act: "throw" | "point" | "stand"; text: string };

export const script: Turn[] = [
  { from: "manager", to: "finance", act: "throw", text: "Finance, send me the cash report. Can we afford the new freezer this month?" },
  { from: "finance", to: "manager", act: "throw", text: "Cash is fine if we delay the stock top-up by two days." },
  { from: "manager", to: "marketing", act: "point", text: "Marketing, can a weekend promo cover the gap?" },
  { from: "marketing", to: "finance", act: "throw", text: "Yes, the draft is ready. Finance, what budget cap do I get?" },
  { from: "finance", to: "marketing", act: "point", text: "RM 300 maximum, and only on the flour and oil bundles." },
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
