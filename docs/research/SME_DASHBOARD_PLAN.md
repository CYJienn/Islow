# SME Plug-and-Play Dashboard: Inputs, Routing, Outputs, 8 Modules

Compiled 2026-10-10. **[sourced]** = found in a search this session. **[my model]** = my judgment or memory, not verified. Nothing here was tested on a live WorkBuddy install.

## 0. What your sketch fixes (`islow idea 1 pic.pdf`)

The dashboard is a **widget grid**, nothing more:
1. A sidebar lists widget options (8 slots; CAL, REM, TODO, SALES are labelled, 4 are blank).
2. The user drags a widget onto a **dotted grid**. Widgets snap to the grid, can be resized, and can take different shapes (L-shapes in the sketch).
3. **Edit mode:** sidebar and grid handles visible. A **prebuilt layout** is offered, or the user edits their own.
4. **View mode (default):** the editor sidebar is gone; only the widgets show (the sketch also shows a TIME widget).

Anything beyond this (login screens, reports pages, settings pages) is out of scope.

## 1. What SMEs receive (inputs)

| Input | Typical content | Evidence |
|---|---|---|
| WhatsApp chat | Customer orders, supplier quotes, fuzzy receipt photos, voice notes, PDF invoices | Receipt photos sent on WhatsApp appear in a bookkeeping vendor's description of the daily routine [sourced, marketing copy]. Meta says 78% of Malaysians message a business weekly [sourced, consumer data, not SME adoption] |
| Paper receipts / cash | Photos of receipts, handwritten notes | 61.5% of SMEs still receive 50%+ of sales in cash [sourced, CPA Australia 2021] |
| Email | Supplier invoices, quotations, LHDN notices | [my model] |
| Meeting audio/transcript | Google Meet / Zoom / in-person recording | [my model] |
| Bank / e-wallet / marketplace exports | Statements (PDF/CSV), seller reports | [my model] |
| Calendar invites, reminders | "Call supplier Thursday" | [my model] |

Gaps: I found no survey on how many Malaysian SMEs use WhatsApp Business, or how they use it with suppliers. Most adoption data is from 2019-2021 [sourced]. Interview an owner before claiming numbers.

## 2. Can WhatsApp reach WorkBuddy?

**Finding:** I found no documented WorkBuddy inbound webhook, API, CLI, or WhatsApp channel [sourced: searched this session]. Its documented ways in are local folders, connectors (Drive, Gmail, Slack, Notion, etc.), MCP servers, and phone triggers via Slack, Telegram, Discord and Chinese chat apps.

**Official WhatsApp route (Cloud API)** [sourced]:
- No polling: messages arrive by webhook at a **public HTTPS endpoint** you host, verified with an HMAC signature.
- Media in a webhook carries an ID; the download URL expires in **5 minutes**, the ID in 7 days. You must fetch the file promptly.
- Billing is per-message by country; MYR billing exists. I did not retrieve the rate card.
- So an always-on cloud endpoint is required. A sleeping laptop cannot do it. That breaks "local, pay only for WorkBuddy".

| Option | Cost | Setup | Risk |
|---|---|---|---|
| A. **Shared inbox folder** (owner drops/forwards files; Drive for Desktop syncs a phone upload into it) | Free | Low | Manual step [my model] |
| B. **Telegram bridge** (owner forwards WhatsApp items to own Telegram bot; WorkBuddy phone trigger) | Free | Low-medium | Does WorkBuddy accept photo attachments from Telegram? **Unknown. Test.** |
| C. **Gmail/Drive connector** (forward to a label, scan with Drive app) | Free | Low | Owner must use Gmail/Drive |
| D. **WhatsApp Cloud API + small cloud function** writing to Drive, local pull | Hosting + per-message fees | High | Not "only WorkBuddy"; Meta business verification |
| E. Unofficial WhatsApp Web bridges | Free | Medium | Breaks WhatsApp's terms and can get the number banned [my model]. Do not ship |

**Recommendation:** make the **`/inbox` folder the only contract.** Every adapter just drops a file there. Demo with A (and B if the test passes). Show D as the roadmap slot. WorkBuddy never needs to know where a file came from.

## 3. What SMEs need out (outputs)

| Output | For |
|---|---|
| Rows in a sales ledger | Daily/weekly takings |
| Rows in an expense list with receipt image link | Record-keeping; poor record-keeping and misclassified expenses are the cited cost of mistakes, up to RM20,000 per offence [sourced, CFOtech 2025, unverified against LHDN] |
| To-do items with owner and due date | After meetings and chats |
| Calendar events + `.ics` file | Google Calendar import without OAuth [my model] |
| Reminders | "Remind me Thursday" |
| Meeting summary (decisions, actions) | Founders |
| Follow-up list: who owes me / I owe | Cash flow [my model] |
| Monthly accountant pack (xlsx + receipts index) | Month-end, tax, e-Invoice |
| Draft replies (copy-paste text for WhatsApp) | Customers and suppliers |

e-Invoice dates and thresholds: sources disagree; check myinvois.hasil.gov.my before stating any date [sourced caveat].

## 4. The 8 modules (the sidebar)

| # | Widget | Fed by | Parse rule (one `rule.md` per module) |
|---|---|---|---|
| 1 | **CAL** Calendar | Meeting notes, chats with dates | Extract event, date, time; write `.ics` and `data.js` |
| 2 | **REM** Reminders | Any "remind/ingat/jangan lupa" mention | Extract text + due date |
| 3 | **TODO** To-dos | Meeting transcripts, chats | Extract action, owner, due date |
| 4 | **SALES** Sales | Cash notes, POS/marketplace exports | Extract amount, date, channel |
| 5 | **SPEND** Expenses | Receipt photos, supplier invoices | Extract vendor, amount, date, category |
| 6 | **MEET** Meeting notes | Transcripts, recordings | 5-line summary, decisions |
| 7 | **OWE** Follow-ups | Invoices, chats | Who, how much, due |
| 8 | **PACK** Monthly pack | Modules 4, 5 | Scheduled xlsx for accountant |

Plus a free **TIME** clock (it is in your sketch). Stock was my first idea for slot 8, but I found no source showing it as an SME pain point, so I dropped it.

**Plug and play** = a module is a folder: `modules/<name>/{widget.js, rule.md}`. Enable it in `config.json` and WorkBuddy runs its rule. Remove it and nothing runs, which also removes its cost.

## 5. Architecture

```
Inputs                Adapters (swappable)        Core                         Output
WhatsApp/photo/PDF -> drop / Drive / Telegram ->  /inbox  ->  WorkBuddy         -> data.js (per module)
Email / meeting    -> Gmail label / Drive      ->          router (cheap model)  -> .ics, xlsx, drafts
                                                           -> module rule.md     -> dashboard.html (grid)
```

- **`dashboard.html`:** one static file, grid editor + view mode. Grid library: I believe GridStack handles drag, resize and snap, but verify before relying on it [my model].
- **Data transport:** WorkBuddy writes `data.js` (`window.DATA = {...}`) and the page loads it with a `<script>` tag. A page opened from `file://` cannot `fetch()` local JSON, which is why. Layout saved in `localStorage`; test that it persists on `file://` in the demo browser.
- **No server.**

## 6. Keeping cost low

1. A change check first: a cheap script hashes `/inbox`; if nothing new, **no model call**. This script may hit WorkBuddy's permission prompt when unattended (documented risk). Test.
2. One cheap-model **router** pass classifies each new file, then only the enabled modules' rules run.
3. Cadence: WorkBuddy documents hourly, daily, weekly, one-time. **10 minutes is unverified.** Fall back to hourly plus a manual refresh trigger.
4. Receipt photos need vision, the costliest step. Only run it on new images.

## 7. Plan for the freeze (Oct 11 03:00)

1. Build 4 modules end to end: **TODO, CAL (+.ics), SPEND, MEET**. List all 8 as the roadmap.
2. Two demo flows: meeting transcript -> TODO + CAL + MEET; receipt photo -> SPEND.
3. Build the grid editor last. It is the visual wow but the least valuable logic.
4. All building inside WorkBuddy, per `CLAUDE.md`. Moving off CikguKit needs the decider's approval.

## 8. Test first

- [ ] Hourly automation runs with the screen locked
- [ ] Unattended run with a script does not stall on a permission prompt
- [ ] A Telegram phone trigger accepts a receipt photo
- [ ] One prompt turns a receipt photo into a SPEND row
- [ ] `data.js` + `localStorage` work from `file://`
- [ ] Mixed Malay/English dates ("esok", "Isnin depan") parse correctly

## Sources

- [Digital adoption among Malaysian small businesses](https://marketech-apac.com/digital-adoption-on-the-rise-among-my-small-businesses-survey/)
- [OECD survey via MIDA](https://mida.gov.my/?p=62643)
- [UOB Business Outlook 2023, Malaysia](https://www.uob.com.sg/asean-insights/articles/uob-business-outlook-study-2023-malaysia.page)
- [Meta WhatsApp webhook payload](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/webhooks/whatsapp-incoming-webhook-payload)
- [Meta WhatsApp media download API](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/media/media-download-api)
- [Meta WhatsApp changelog (MYR billing)](https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog/)
- [WorkBuddy product page (Tencent Cloud)](https://www.tencentcloud.com/act/pro/workbuddy)
- [CFOtech: Malaysian SMEs and e-invoicing fines](https://cfotech.asia/story/malaysian-smes-risk-rm-20-000-fines-as-e-invoicing-nears)
- [HASiL: e-Invoice for SMEs](https://www.hasil.gov.my/wp-content/uploads/20250731_borneo-post_e-invoice-a-smart-move-for-malaysian-smes-in-the-digital-era.pdf)
- [Bookkeeping app blog (marketing, illustrative)](https://www.info-tech.com.my/blog/best-bookkeeping-app-for-malaysian-business/)
