"use client";
import { useEffect, useRef, useState } from "react";
import { financeReportPayload } from "./FinanceReport";

// Business profile for an SME owner. Demo data only; saved in this browser, and sent to the assistant as context.
export type Profile = {
  name: string; owner: string; kind: string; ssm: string; industry: string; since: string;
  city: string; address: string; hours: string; outlets: string;
  employees: string; approvalLimit: string;
  about: string; offerings: string; customers: string; channels: string[];
  revenue: string; budget: string;
  notDoing: string; goal: string; challenges: string; competitors: string;
  phone: string; email: string;
  reviews: string; // customer reviews / comments, one per line: feeds the sentiment analysis
};

export const emptyProfile: Profile = {
  name: "", owner: "", kind: "", ssm: "", industry: "", since: "",
  city: "", address: "", hours: "", outlets: "",
  employees: "", approvalLimit: "",
  about: "", offerings: "", customers: "", channels: [],
  revenue: "", budget: "",
  notDoing: "", goal: "", challenges: "", competitors: "",
  phone: "", email: "",
  reviews: "",
};

// Fictional business for demos (English reviews only: the sentiment model is English).
export const demoProfile: Profile = {
  name: "Kedai Maju Trading", owner: "Kai", kind: "Private limited (Sdn Bhd)", ssm: "", industry: "Packaged food wholesale", since: "2019",
  city: "Shah Alam, Selangor", address: "Lot 12, Jalan Industri 3, Seksyen 26", hours: "Mon-Sat 8am-6pm", outlets: "1",
  employees: "8", approvalLimit: "10000",
  about: "We supply flour, cooking oil and homemade sambal to cafes, mini markets and small restaurants around Klang Valley, with free delivery on orders above RM 300.",
  offerings: "flour, cooking oil, sambal, rice", customers: "cafes, mini markets and small restaurants in Klang Valley",
  channels: ["WhatsApp", "Facebook / Instagram", "Wholesale / B2B"],
  revenue: "RM 30,000 – 100,000", budget: "300",
  notDoing: "No credit sales beyond 30 days. No selling below cost. No new outlets this year.",
  goal: "Double wholesale orders in 6 months", challenges: "Late supplier payments, slow WhatsApp replies, stock running out before reorder.",
  competitors: "Mydin Wholesale, 99 Speedmart", phone: "", email: "",
  reviews: [
    "Fast delivery and a fair price, will order again.",
    "The flour arrived late and one bag was torn.",
    "Their sambal is amazing, my customers keep asking for it.",
    "Hard to reach on WhatsApp, replies take a whole day.",
    "Good quality cooking oil and the invoice was clear.",
    "Delivery driver was polite and on time.",
    "Prices went up again this month, a bit expensive for a small cafe.",
    "Very reliable supplier, never ran out of stock for us.",
    "Wrong quantity delivered and it took three days to fix.",
    "Love the bundle deal on flour and oil, saves us money.",
    "Packaging is sturdy and neat. Happy with the service.",
    "Minimum order is too high for a small shop like mine.",
  ].join("\n"),
};

export const KEY = "kaunter-profile";
const KINDS = ["Sole proprietor", "Partnership", "Private limited (Sdn Bhd)", "Cooperative", "Other"];
const CHANNELS = ["Walk-in", "WhatsApp", "Facebook / Instagram", "TikTok", "Shopee / Lazada", "GrabFood / foodpanda", "Own website", "Wholesale / B2B"];
const REVENUE = ["Under RM 10,000", "RM 10,000 – 30,000", "RM 30,000 – 100,000", "RM 100,000 – 300,000", "Over RM 300,000"];

export function loadProfile(): Profile {
  try { return { ...emptyProfile, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return emptyProfile; }
}

// Plain-text summary the chat sends along, so answers are about this business.
export function profileContext(p: Profile): string | null {
  const rows: [string, string][] = [
    ["Business", p.name], ["Owner", p.owner], ["Type", p.kind], ["SSM no.", p.ssm], ["Industry", p.industry], ["Operating since", p.since],
    ["City / state", p.city], ["Address", p.address], ["Opening hours", p.hours], ["Outlets", p.outlets],
    ["Employees", p.employees], ["Owner approval limit (RM)", p.approvalLimit],
    ["What we do", p.about], ["Products / services", p.offerings], ["Customers", p.customers], ["Sales channels", p.channels.join(", ")],
    ["Monthly revenue", p.revenue], ["Monthly marketing budget (RM)", p.budget],
    ["What we do NOT do", p.notDoing], ["Main goal", p.goal], ["Biggest challenges", p.challenges], ["Competitors", p.competitors],
  ];
  const lines = rows.filter(([, v]) => v.trim()).map(([k, v]) => `${k}: ${v}`);
  return lines.length ? lines.join("\n") : null;
}

// Body for POST /api/v1/chat: the profile as context, plus the marketing agent's business payload when the profile has every field it needs.
const list = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
export function chatBody(p: Profile, text: string, extra: object = {}) {
  const ctx = profileContext(p);
  const budget = Number(p.budget);
  const business = {
    name: p.name.trim(), industry: p.industry.trim(), location: p.city.trim(), products: list(p.offerings),
    target_customers: p.customers.trim(), marketing_budget_rm: budget, objective: p.goal.trim(),
    channels: p.channels, competitor_names: list(p.competitors).slice(0, 3),
  };
  const reviews = list(p.reviews).slice(0, 200).map((t) => ({ text: t.slice(0, 2000), source: "owner pasted" }));
  const ready = business.name && business.industry && business.location && business.products.length && business.target_customers
    && budget > 0 && business.objective && business.channels.length;
  return {
    text, ...financeReportPayload(), ...extra,
    documents: ctx ? [{ source: "Business profile", content: ctx }] : [],
    ...(ready ? { marketing: { business, reviews, research_mode: "live", optional: true } } : {}), // ponytail: no reviews until the UI can take them
  };
}

const KEYS: (keyof Profile)[] = ["name", "owner", "kind", "industry", "city", "employees", "about", "offerings", "customers", "channels", "revenue", "goal"];
const filled = (p: Profile) => KEYS.filter((k) => (Array.isArray(p[k]) ? (p[k] as string[]).length : String(p[k]).trim())).length;

export default function ProfileDialog({ open, profile, onSave, onClose }: { open: boolean; profile: Profile; onSave: (p: Profile) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [d, setD] = useState<Profile>(profile);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) { setD(profile); el.showModal(); }
    if (!open && el.open) el.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setD((x) => ({ ...x, [k]: v }));
  const text = (k: keyof Profile, label: string, ph = "", type = "text") => (
    <label className="field"><span className="label">{label}</span>
      <input type={type} value={d[k] as string} placeholder={ph} onChange={(e) => set(k, e.target.value as never)} />
    </label>
  );
  const area = (k: keyof Profile, label: string, ph = "") => (
    <label className="field wide"><span className="label">{label}</span>
      <textarea rows={3} value={d[k] as string} placeholder={ph} onChange={(e) => set(k, e.target.value as never)} />
    </label>
  );
  const pick = (k: keyof Profile, label: string, options: string[]) => (
    <label className="field"><span className="label">{label}</span>
      <select value={d[k] as string} onChange={(e) => set(k, e.target.value as never)}>
        <option value="">Choose…</option>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
  const done = filled(d);

  return (
    <dialog ref={ref} className="modal" onClose={onClose} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} aria-labelledby="profile-title">
      <form className="profile" onSubmit={(e) => { e.preventDefault(); onSave(d); }}>
        <header className="profile-head">
          <div>
            <h2 id="profile-title">Business profile</h2>
            <p className="session-hint">Tell your team about the business. The more they know, the better the answers. Stored in this browser only; use demo details.</p>
          </div>
          <button type="button" className="x-close" aria-label="Close" onClick={onClose}>×</button>
        </header>
        <div className="meter" aria-label={`${done} of ${KEYS.length} key fields filled`}><i style={{ width: `${(done / KEYS.length) * 100}%` }} /></div>

        <div className="profile-body">
          <fieldset><legend className="label">About the business</legend>
            <div className="fields">
              {text("name", "Business name", "e.g. Kedai Maju Trading")}
              {text("owner", "Your name", "e.g. Kai")}
              {pick("kind", "Type of business", KINDS)}
              {text("ssm", "SSM registration no.", "optional")}
              {text("industry", "Industry", "e.g. Packaged food, retail")}
              {text("since", "Operating since (year)", "e.g. 2019", "number")}
            </div>
          </fieldset>

          <fieldset><legend className="label">Where</legend>
            <div className="fields">
              {text("city", "City and state", "e.g. Shah Alam, Selangor")}
              {text("outlets", "Number of outlets", "e.g. 1", "number")}
              {area("address", "Address", "Shop lot, street, postcode")}
              {text("hours", "Opening hours", "e.g. Mon–Sat 8am–6pm")}
            </div>
          </fieldset>

          <fieldset><legend className="label">Team</legend>
            <div className="fields">
              {text("employees", "How many employees", "including part-time", "number")}
              {text("approvalLimit", "Spending you approve alone (RM)", "e.g. 10000", "number")}
            </div>
          </fieldset>

          <fieldset><legend className="label">What we do</legend>
            <div className="fields">
              {area("about", "In a few lines, what does the business do?", "We supply packaged food to cafes and mini markets in…")}
              {area("offerings", "Main products or services", "Flour, cooking oil, sambal… one per line or comma-separated")}
              {text("customers", "Who are your customers?", "e.g. cafes, mini markets, households")}
              <div className="field wide"><span className="label">Where do you sell?</span>
                <div className="checks">
                  {CHANNELS.map((c) => (
                    <label key={c} className={`check ${d.channels.includes(c) ? "on" : ""}`}>
                      <input type="checkbox" checked={d.channels.includes(c)} onChange={() => set("channels", d.channels.includes(c) ? d.channels.filter((x) => x !== c) : [...d.channels, c])} />
                      {c}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </fieldset>

          <fieldset><legend className="label">Money</legend>
            <div className="fields">
              {pick("revenue", "Monthly revenue", REVENUE)}
              {text("budget", "Monthly marketing budget (RM)", "e.g. 300", "number")}
            </div>
          </fieldset>

          <fieldset><legend className="label">Goals and limits</legend>
            <div className="fields">
              {text("goal", "Main goal this year", "e.g. Double wholesale orders")}
              {text("competitors", "Competitors (up to 3)", "names, comma-separated")}
              {area("challenges", "Biggest challenges", "Late payments, stock running out, rising costs…")}
              {area("notDoing", "What we do NOT do", "Things the team should never suggest: e.g. no credit sales, no halal-uncertified products, no new outlets this year")}
            </div>
          </fieldset>

          <fieldset><legend className="label">Customer reviews (for sentiment analysis)</legend>
            <div className="fields">
              {area("reviews", "Paste reviews or comments, one per line", "Copy from Google Maps, Facebook comments, Shopee reviews or WhatsApp feedback. English only for now. Remove names and phone numbers.")}
            </div>
          </fieldset>

          <fieldset><legend className="label">Contact (optional)</legend>
            <div className="fields">
              {text("phone", "Phone", "demo number only", "tel")}
              {text("email", "Email", "demo address only", "email")}
            </div>
          </fieldset>
        </div>

        <footer className="profile-foot">
          <button type="button" className="btn" onClick={() => setD(emptyProfile)}>Clear all</button>
          <button type="button" className="btn" onClick={() => setD(demoProfile)}>Fill demo data</button>
          <span className="grow" />
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary">Save profile</button>
        </footer>
      </form>
    </dialog>
  );
}
