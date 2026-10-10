# Kaunter: Product Description

> A team of AI staff for the small Malaysian business owner, run from one dashboard the owner arranges themselves.

All demo data is synthetic. No real customers, invoices or people appear anywhere in the prototype.

---

## 1. What Kaunter is

Owner-operators of small Malaysian businesses (shops, stalls, suppliers, SMEs) do the marketing, the books and the legal admin themselves, between customers and phone calls. They cannot afford a marketing agency, a finance clerk and a lawyer.

Kaunter gives them a small AI team instead:

| Team member | Job | What makes it special |
|---|---|---|
| **Manager** | Takes the owner's request, picks the right specialist, merges the answers | One front door, one place that sees and logs everything |
| **Marketing lead** | Reads customer reviews, studies competitors, proposes campaigns | Backed by a trained machine learning model |
| **Finance and Ops lead** | Checks supplier invoices before they are paid | Built-in fraud detection |
| **Legal Team lead** | Reviews contracts, checks compliance, drafts documents | Retrieval-augmented generation (RAG) over Malaysian law |
| **Personal Assistant** | Reminders, calendar, the owner's day | Keeps the owner's own wording and language |

The owner sees all of it on a dashboard they can rearrange freely, and nothing consequential happens without their approval.

---

## 2. Main features

### 2.1 Main orchestrator (the Manager)

- Every request goes to one **Manager** agent. It classifies the task (financial operations, marketing and competitors, legal and compliance, or personal assistant) and routes it to the matching specialist.
- Mixed questions ("can we afford this promo, and is the supplier contract OK?") are sent to several specialists. The Manager merges their answers into one reply.
- For big decisions it calls a **round table**: the whole team discusses the question on screen, each lead speaking in turn, and the Manager gives the final answer.
- **Specialists never talk to each other directly.** Every hand-off goes back through the Manager. Example: if Finance spots a suspicious invoice, it reports to the Manager, and the Manager decides whether to bring in Legal. One place sees everything and logs everything, so the owner only has to watch the Manager.
- Work moves between agents as a structured **brief** (who it is from and to, summary, facts with sources, risk tier, citations, next action, deadline), so nothing gets lost in translation.
- Built on a FastAPI backend with LangChain.

### 2.2 Marketing bot: backed by a machine learning model

- A **fine-tuned DistilBERT sentiment classifier** reads the business's customer reviews and predicts a **1 to 5 star** rating for each. It was tuned on Yelp reviews, with an Amazon-adapted variant for retail. It runs locally or from the Hugging Face Hub. English reviews only.
- The pipeline is a **LangGraph workflow** with eight steps: validate input, load reviews, analyse sentiment, search competitors, analyse competitors, generate campaigns, rank campaigns, build report. Review analysis and competitor research run in parallel, then join.
- **Competitor research** uses live web search (Tavily), so the campaign ideas respond to what rivals are doing now.
- **Campaigns are generated and then ranked**, so the owner sees the best idea first, with the evidence behind it.
- **It does not invent facts.** If a source is missing, the report says "unavailable" or "partial" and gives a warning. Demo mode uses clearly labelled fixtures and makes no paid API calls.

### 2.3 Finance bot: invoice fraud detection

- Every supplier invoice goes through **deterministic checks** that can be reproduced and audited:
  - **Duplicate detection:** repeated vendor invoice references are flagged as duplicate candidates.
  - **Bank detail comparison:** the bank account on the invoice is compared with the vendor master record. A mismatch is a classic payment-diversion fraud signal.
  - **Three-way matching:** invoice against purchase order and goods received, where the evidence exists.
- **An optional AI risk review** sits on top of the rules. It sees only selected fields and redacted rule outcomes (never raw documents or bank values), and returns one of `NO_ADDITIONAL_INDICATORS`, `SUSPECTED_RISK` or `INSUFFICIENT_EVIDENCE`. It has **no payment or approval authority**.
- **Honest by design.** Findings are described as "candidates" and "indicators", never as confirmed fraud. Missing evidence stays `UNKNOWN`, and "no additional indicators" is never presented as proof an invoice is legitimate.
- Documents come in through a flow from OneDrive, document intake and OCR, through the checks, to a dashboard report, then Excel export, with Outlook and Telegram alerts.
- Runs as its own service with a SQLite history of reports and approvals.

### 2.4 Legal bot: RAG over Malaysian law

- A **searchable Legal Handbook** grounds every answer in real sources instead of the model's memory:
  - **Statutes:** 8 Malaysian Acts from the Attorney General's Chambers (AGC), split one chunk per section, each tagged with act, section, in-force date and amendments.
  - **Playbooks:** for each contract type (NDA, service agreement, supplier agreement) the preferred, fallback and walk-away position for each clause, with the reason.
  - **Templates:** contracts, letters and checklists the owner can start from.
  - **Company profile:** the owner's own company details, licences and past matters, so answers fit their business.
- **Two-stage retrieval:** BM25 sparse search finds candidates, and a reranker re-scores them. A query like "s.74" or "section 74" jumps straight to that section. No paid embedding calls are needed per query.
- **Answers carry citations**, for example "Contracts Act 1950 s.74", so the owner or their lawyer can check the source.
- **A legal team of specialists:** a Legal Lead who triages and signs off, Contracts, Compliance, Disputes and Recovery, a shared Research service, and a **Checker** that every output must pass before it goes back up.
- **Information, not legal advice.** The bot drafts, explains and escalates to a lawyer when needed.

### 2.5 Human in the loop

The AI does the work. **The owner keeps the decisions.**

- **Risk tiers on legal work:** 🟢 *Green* (routine, low money): the agent completes it. 🟡 *Amber* (non-standard clause, an employee termination, anything sent outside in the company's name, an amount over the owner's limit): a draft is prepared and **the owner must approve** before it goes out. 🔴 *Red* (criminal matter, court letter, litigation, large sums, anything the handbook cannot cite): **stop**. The bot produces a lawyer brief only and never acts externally. When unsure, it goes one tier up.
- **Owner-set approval limit:** the business profile includes "spending you approve alone", so the agents know when to ask.
- **Finance reports are approved by a person.** A report snapshot needs explicit approval, then a separate send confirmation, before it reaches anyone on Outlook or Telegram. Approval authorises distribution only, not payments and not clearing a finding.
- **Agents cannot change themselves.** The Manager proposes changes and asks for approval. It never claims a skill was updated on its own.

### 2.6 Fully customisable dashboard

- The home screen is a grid of **widgets** (sales this week, to-do, spend, cold room temperature, unpaid invoices, stock alerts, next event, customers).
- In **edit mode** the owner can:
  - **Drag** widgets to move them, with a ghost outline that snaps to the grid.
  - **Resize** them from the corner handle.
  - **Add** new widgets by dragging them in from a tray.
  - **Delete** widgets they do not need.
  - Use the **keyboard**: arrow keys move a focused card, Shift+arrows resize, Delete removes. It works with touch too.
- **View mode is the default.** The editor stays out of the way until the owner wants it.
- **Preview first:** the default layout is useful before the owner touches anything. An owner can open it and rearrange it in under a minute.
- A **chat assistant** sits in the dashboard. It can answer questions and build new widgets on request.
- **Light and dark theme.** The owner's layout, language and custom widgets are remembered.
- **Bilingual:** English and Bahasa Malaysia. Parsed content stays in the language it arrived in.
- **Accessible:** keyboard and touch operable. Meaning never depends on colour alone (an overdue item says "overdue" as well as turning red). Reduced-motion is respected.

---

## 3. What is special about Kaunter

1. **Three different kinds of AI, each doing what it is good at.** A trained ML model for marketing sentiment. Deterministic rules plus an AI second opinion for fraud. RAG for law. The product does not use one generic chatbot for everything.
2. **One orchestrator, not five separate tools.** The owner talks to the Manager. Specialists hand work back through it, so there is a single place to watch and a single log.
3. **Evidence over confidence.** Every specialist is built to say "I don't know" or "evidence missing" rather than invent. Fraud findings are indicators, legal answers are cited, and marketing facts come from search results.
4. **The owner is always in control.** Risk tiers, an approval limit, and explicit approve-then-send steps keep a human in the loop where it matters.
5. **Built for Malaysian SMEs.** Malaysian statutes (Contracts Act, Employment Act, PDPA, Companies Act, MACC s.17A and more), Bahasa Malaysia, and RM amounts.
6. **The owner arranges, the AI fills.** The dashboard never asks the owner to type data in. They choose the widgets and the layout, and the agents supply the content.

---

## 4. Where we used WorkBuddy AI in our workflow

WorkBuddy (Tencent's desktop AI agent) is the **agent runtime** of Kaunter. It is where the AI staff are defined, given skills and run. The website, the backend services and the demo videos were built with other tools, and this section says which is which.

| Stage of the workflow | How WorkBuddy is used | Where it lives |
|---|---|---|
| **1. Research and planning** | We used WorkBuddy's documented abilities (folder access, connectors, MCP, phone triggers, scheduled runs, Plan mode) to decide what Kaunter can and cannot rely on. This produced the `/inbox` folder contract, in which WorkBuddy reads whatever lands in the folder and never needs to know where it came from. | `docs/guides/WORKBUDDY_GUIDE.md`, `docs/research/SME_DASHBOARD_PLAN.md`, `docs/research/OFFICE_DAY_RESEARCH.md` |
| **2. Company Manager** | The **Manager** is a WorkBuddy skill. It classifies each request (general, finance and operations, marketing, legal), calls the right specialist, merges the answers, and proposes (never applies) changes to a specialist's skill when the owner reports a mistake. | `skills/company-manager/SKILL.md` |
| **3. Finance team (Invoice Assurance)** | A **six-expert WorkBuddy team** checks supplier invoices. A Team Lead, "Lin", dispatches Intake and Data Quality first. Then Three-Way Matching, Fraud and Vendor Risk, and Accounting Approval Policy run **in parallel**. Assurance Reporting reconciles them into a draft report. Specialists report only to the lead, never to each other. Each expert has its own agent file and skill, plus shared rules, schemas and offline tests. | `backend/finance/workbuddy/` (agents, skills, schemas, `COMMON_RULES.md`), `backend/finance/skills/` |
| **4. Human approval and alerts** | The Team Lead asks the owner to approve an exact report version before WorkBuddy sends it to Outlook and Telegram. It records who approved and how long the review took. Approval never clears a finding and never triggers a payment. | `backend/finance/workbuddy/agents/invoice-assurance-team-lead.md` |
| **5. Marketing expert** | The Marketing Expert is a WorkBuddy skill plus a small HTTP client. It sends a JSON request to our FastAPI GrowthLab service (health check and `POST /marketing/analyze`, with an optional bearer token) and shows the ranked campaigns. The sentiment model, search and ranking run in our backend, not inside WorkBuddy. | `GrowthLab_AGENTS.md` (section 15), `backend/README.md` |
| **6. Original project plan** | The team contract required all building, running and showing to happen inside WorkBuddy (Plan mode, approval gate, proof in the Changes panel). That is why every specialist keeps a human approval step. | `CLAUDE.md`, `docs/specs/` |

### What WorkBuddy did **not** do

Stated plainly so nobody over-claims:

- **The frontend was built with Claude Code and the marketing backend with Codex**, not inside WorkBuddy. The team contract says all building should happen inside WorkBuddy unless the organisers confirm otherwise. **This must be confirmed with the decider and organisers before submission.**
- **There is no live WorkBuddy connection in the dashboard yet.** `data.js` is still hand-written demo data. WorkBuddy has no documented inbound webhook or WhatsApp route, so the plan is the `/inbox` folder.
- **The WorkBuddy GUI was not tested end to end for the marketing client.** It was tested from the terminal first, and the sample request against the running API.
- **The finance expert package is imported, not registered.** Copying it into the repo does not create the team in WorkBuddy. It has to be installed and the team reopened.
- **Scheduled runs are prepared but off.** No auto-approve, no auto-send, no payments.

---

## 5. How it fits together

```text
                    Owner (approves amber items, approves reports)
                                   |
                  Dashboard (Next.js, drag / resize / chat)
                                   |
                       FastAPI backend  /api/v1
                                   |
                       MANAGER (orchestrator)
        ______________|____________|______________|______________
       |              |            |              |
  Marketing       Finance        Legal        Personal
   lead            lead          lead         Assistant
   |               |             |
 DistilBERT      Rule checks   RAG Handbook
 sentiment +     + AI risk     (statutes, playbooks,
 Tavily search   review        templates, company profile)
 + LangGraph     + approval    + risk tiers + Checker
                 before send
```

| Layer | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Backend | FastAPI (Python 3.11), LangChain |
| Marketing | DistilBERT (Hugging Face), LangGraph, Tavily |
| Finance | Python rule engine, SQLite, optional OpenAI risk review, Excel export |
| Legal | BM25 plus rerank RAG over AGC statutes |

---

## 6. Prototype status (so nobody over-claims)

- **Demo data is synthetic.** The dashboard widgets and the company profile are made up.
- **Not yet measured:** no time-saved or money-saved figure exists. No SME owner has been interviewed.
- **Legal handbook needs a lawyer's review.** Playbook positions are drafts. Several statute points are marked for verification (for example the limitation period, the small claims limit, and the PDPA 2024 commencement). It gives information, not legal advice.
- **Fraud checks are partial.** The supplied workbook has invoice headers only, so full line-level three-way matching cannot be established.
- **Sentiment model supports English reviews only.**
- **Review identity is local.** The finance reviewer label is not enterprise authentication, and a shared deployment would need real sign-in.
- **Scheduling and payments are off.** No scheduled sends, payment actions or external deliveries are enabled.
