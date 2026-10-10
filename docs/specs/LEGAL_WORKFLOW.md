# SME Agent Team: Legal Workflow (Malaysia only)

Draft plan for the Legal team inside the SME master-agent system. Not legal advice;
the product gives legal information, drafts documents, and escalates to a lawyer.
Items marked ⚠ must be verified before going into the handbook.

---

## 1. The one routing rule

**Every hand-off goes through the Manager.** Team leads never talk to each other directly.

```
Team lead finishes work → writes a BRIEF → hands it back to MANAGER
MANAGER reads brief → decides next step → delegates to the next team lead (or the owner)
```

Example: Finance spots fraud → Finance brief → Manager → Legal Lead. Finance never calls Legal.

Why: one place sees everything, one place logs everything, and the owner only has to
watch the Manager.

---

## 2. The brief (the only message format between Manager and leads)

Every task going down and every result coming back uses the same shape:

| Field | Meaning |
|---|---|
| `brief_id` | Unique id, e.g. `LGL-2026-0042` |
| `from` / `to` | `manager`, `legal_lead`, `finance_lead`, `marketing_lead`, `owner` |
| `type` | `task` (going down) or `result` (coming back) |
| `summary` | One line, plain language |
| `facts` | What is known, with sources (invoice no., contract file, dates, amounts) |
| `attachments` | Files: contracts, invoices, chat screenshots, logs |
| `risk_tier` | 🟢 green / 🟡 amber / 🔴 red (set by Legal Lead on results) |
| `citations` | Handbook references, e.g. `Contracts Act 1950 s.74` |
| `output` | The deliverable: draft, checklist, calendar entry, lawyer brief |
| `next_action` | What the Manager should do next and who with |
| `deadline` | Date this matters by |

---

## 3. Team structure

```
MANAGER
  └─ LEGAL LEAD (intake, risk tier, routing, sign-off)
        ├─ 1. Contracts
        ├─ 2. Compliance
        ├─ 3. Disputes & Recovery
        ├─ 4. Research       (shared service, called by 1–3)
        └─ ✔  Checker        (every output passes through before going back up)
```

All sub-agents read from the **Legal Handbook (RAG)**:

| Part | Contents |
|---|---|
| A. Statutes | Malaysian Acts, one chunk per section, tagged `act, section, title, in_force_date, amended_by` |
| B. Playbooks | Per contract type: clause → preferred / fallback / walk-away → why |
| C. Templates | NDA, service agreement, employment letter, letter of demand, privacy notice, anti-bribery policy, police-report checklist |
| D. Company profile | SSM no., industry, staff count, licences + expiry, signed contracts, past matters |

Starter statute list (Part A) ⚠ confirm current versions on the AGC Laws of Malaysia portal:
Contracts Act 1950 · Companies Act 2016 · Employment Act 1955 · Industrial Relations Act 1967 ·
Personal Data Protection Act 2010 (+2024 amendments) · Penal Code (Act 574) · MACC Act 2009 (s.17A) ·
Consumer Protection Act 1999 · Sale of Goods Act 1957 · Electronic Commerce Act 2006 ·
Limitation Act 1953 · Trademarks Act 2019 · Copyright Act 1987 · Minimum Wages Order (current) ·
Subordinate Courts Rules (small claims) ⚠

---

## 4. Risk tiers (owned by Legal Lead)

| Tier | When | What happens |
|---|---|---|
| 🟢 Green | Routine, template fits, low money, no third-party conflict | Agent completes it; Manager can release it |
| 🟡 Amber | Non-standard clause, employee termination, amount above owner's set threshold, anything sent externally in the company's name | Draft ready; **owner must approve** before it goes out |
| 🔴 Red | Criminal matter, court/regulator letter, litigation, large sums, insolvency, anything the handbook can't cite | **Stop.** Produce a lawyer brief only. Never act externally |

Default when unsure: go one tier up.

---

## 5. Role cards

### Legal Lead
- **Purpose:** the front door and the sign-off for all legal work.
- **Receives:** task briefs from the Manager only.
- **Steps:**
  1. Read the brief; check facts and attachments are enough. If not, return a `result` brief to the Manager listing what's missing.
  2. Classify the matter: contract / compliance / dispute / question.
  3. Set a provisional risk tier.
  4. Assign to one sub-agent (or split into parts across several, then merge).
  5. Receive the sub-agent output **after the Checker passes it**.
  6. Confirm final tier, write the `result` brief, hand back to the Manager.
- **Never:** sends anything outside the company; talks to other team leads directly.
- **Daily routine:** morning pull from Compliance (deadlines next 30 days) and Contracts (renewals next 60 days) → one combined brief to the Manager for the owner's daily briefing.

### 1. Contracts
- **Purpose:** make sure the owner never signs something blind, and has good templates for their own deals.
- **Triggers:** owner uploads a contract; owner needs a new agreement; a renewal date approaches.
- **Steps (review):**
  1. Identify contract type → load matching playbook (Part B).
  2. Extract key terms: parties, price, payment terms, duration, termination, liability, indemnity, IP, governing law, auto-renewal.
  3. Compare each clause with the playbook: ✅ preferred / ⚠ fallback / ❌ beyond walk-away.
  4. Ask Research for statute backing where a clause touches law (e.g. penalty clauses → Contracts Act s.75 ⚠).
  5. Produce: plain-language summary, clause-by-clause flag table, suggested redlines, questions to ask the other side.
- **Steps (draft):** pick template (Part C) → fill from company profile + brief facts → flag every blank the owner must decide.
- **Steps (renewals):** scan Part D signed contracts → list renewals/notice deadlines in next 60 days.
- **Output tier guide:** standard NDA on own template 🟢 · third-party paper with fallbacks 🟡 · unlimited liability, exclusivity, personal guarantee, or large value 🔴.

### 2. Compliance
- **Purpose:** no missed deadline, no missing policy.
- **Triggers:** daily calendar check; new company profile data (new hire, new licence, new branch); Manager asks "are we compliant on X".
- **Steps:**
  1. Build the compliance calendar from Part D: SSM annual return, business/premises licence renewals, tax and SST dates, e-invoicing phase ⚠, EPF/SOCSO/EIS monthly, trademark renewals.
  2. Each item: due date, what to file, where, penalty for missing (cited).
  3. Policy gap check against company profile: privacy notice (PDPA), data breach procedure, DPO need ⚠, anti-bribery "adequate procedures" (MACC s.17A), employee handbook basics (Employment Act).
  4. Draft missing policies from templates.
- **Output tier guide:** reminders 🟢 · new policy drafts 🟡 · missed deadline with penalty or regulator contact 🔴.

### 3. Disputes & Recovery
- **Purpose:** get the company paid and handle conflicts properly before they get expensive.
- **Triggers (always via Manager):** Finance flags overdue invoice; Finance flags suspected fraud; customer complaint; employee dispute.
- **Steps (debt recovery ladder):**
  1. Confirm facts: invoice, contract/quotation, delivery proof, previous reminders.
  2. Check limitation (Limitation Act: 6 years for contract ⚠).
  3. Draft letter of demand (template) with a clear deadline (e.g. 14 days).
  4. If unpaid after deadline: pick forum by amount — Small Claims (≤ RM5,000 ⚠) / Tribunal for Consumer Claims (≤ RM50,000, consumer cases ⚠) / lawyer for anything bigger → prepare the filing pack or lawyer brief.
- **Steps (fraud):**
  1. Receive Finance's evidence via the Manager.
  2. Ask Research which offences the pattern may fit (e.g. Penal Code s.405–409 criminal breach of trust, s.415–420 cheating ⚠). Label as "may indicate", never as a conclusion.
  3. Produce: evidence-preservation checklist (don't delete, export logs, restrict access), police-report checklist, internal action list (suspend access, change approvals).
  4. Always 🔴 → lawyer brief.
- **Steps (complaints / employees):** facts timeline → relevant rights and duties (cited) → suggested response draft → tier.

### 4. Research (shared service)
- **Purpose:** the only agent that queries the handbook. Answers "what does the law / playbook say".
- **Called by:** Contracts, Compliance, Disputes (never directly by the Manager or owner; owner questions come in as a Legal Lead task).
- **Steps:**
  1. Turn the question into handbook queries (statute + playbook + company profile).
  2. Retrieve, rank, quote the exact section text.
  3. Answer with: short answer, quoted sections, `in_force_date`, and "not covered by handbook" if nothing fits.
- **Rule:** no citation = no claim. If the handbook doesn't cover it, say so; that pushes the matter toward 🔴.

### ✔ Checker
- **Purpose:** the senior-lawyer review. Nothing goes back to the Legal Lead without passing.
- **Checks:**
  1. Every citation exists in Part A and says what the draft claims.
  2. Cited law is in force (date check).
  3. Facts in the output match the brief (names, amounts, dates).
  4. Tier is respected: red matters contain no external action, only a lawyer brief.
  5. "Legal information, not legal advice" line present on anything the owner sees.
  6. No real personal data beyond what the task needs.
- **Result:** `pass` → Legal Lead. `fail` → back to the sub-agent with the reasons (max 2 loops, then escalate to 🔴).

---

## 6. Workflows

### W1. Owner: "Can I sign this contract?"
```
Owner → Manager → Legal Lead (contract, provisional 🟡)
  → Contracts (playbook review) ⇄ Research (statute backing)
  → Checker → Legal Lead (final tier) → result brief → Manager → Owner
Owner approves redlines → Manager → Legal Lead → Contracts logs it in Part D (renewal dates tracked)
```

### W2. Finance flags suspected fraud
```
Finance Lead detects pattern → result brief (evidence attached, next_action: "legal review") → Manager
Manager → task brief → Legal Lead (dispute/fraud, 🔴)
  → Disputes & Recovery ⇄ Research (possible offences, cited)
  → Checker → Legal Lead → result brief (🔴, lawyer brief + evidence checklist + police-report checklist) → Manager
Manager → Owner (decide: lawyer / police report)
Manager → Finance Lead (task: freeze approvals, preserve records)  ← if owner agrees
```

### W3. Overdue invoice escalation
```
Finance Lead: reminders 1–3 sent, still unpaid → result brief → Manager
Manager → Legal Lead (dispute/recovery, 🟡)
  → Disputes & Recovery (facts, limitation check, letter of demand) ⇄ Research
  → Checker → Legal Lead → result brief (draft LOD) → Manager → Owner approves → sent
Deadline passes, still unpaid → Finance brief → Manager → Legal Lead → forum choice + filing pack / lawyer brief
Paid → Finance brief → Manager closes the matter
```

### W4. Daily compliance & renewals
```
Scheduled each morning: Manager → Legal Lead (task: daily legal check)
  → Compliance (deadlines next 30 days) + Contracts (renewals next 60 days)
  → Checker → Legal Lead → one result brief → Manager → owner's daily briefing
```

### W5. Owner asks a legal question ("How much notice do I give a staff member?")
```
Owner → Manager → Legal Lead (question) → Research → Checker → Legal Lead → Manager → Owner
If the answer leads to action (termination letter) → new task: Legal Lead → Disputes/Contracts → 🟡
```

---

## 7. Open items
- ⚠ Verify every statute, section number, threshold and deadline above against current law.
- Owner sets the amber money threshold (e.g. RM10,000) in the company profile.
- Decide who can see what: fraud matters should be hidden from the person suspected.
- Positioning: legal information + document prep + lawyer escalation (Legal Profession Act 1976 ⚠).
