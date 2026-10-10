# Office Worker's Day -> WorkBuddy Deliverable Chain

Compiled 2026-10-10. **[sourced]** = found in a search result. **[my model]** = my synthesis, not measured. Not tested on a live WorkBuddy install.

## 1. What the evidence says about the day

| Finding | Source | Caveat |
|---|---|---|
| ~60% of the day goes to "work about work" (chasing updates, meetings, tool switching) | Asana Anatomy of Work 2021 [sourced] | Self-reported, vendor survey, 2020 data |
| 117 emails + 153 Teams messages per day; ~275 interruptions (one every ~2 min) | Microsoft Work Trend Index 2025 [sourced] | Microsoft 365 telemetry, 12 months to Feb 2025 |
| 57-60% of meetings are ad hoc (no invite); about half land in peak focus hours | Microsoft 2025 [sourced] | Coverage differs slightly between outlets |
| 28 hours/week on emails, searching for info, internal collaboration | McKinsey "Social Economy" 2012 [sourced] | Old. The 28% and 19% figures were NOT confirmed |

Use these as framing only. The Asana and McKinsey numbers are soft.

## 2. A day in the life [my model]

| Time | Activity | What it produces | What happens next |
|---|---|---|---|
| 08:30 | Triage email/chat | Replies, forwarded asks | Becomes tasks |
| 09:30 | Meeting (standup, client, project) | Notes, a recording/transcript | Someone must write minutes |
| 10:30 | After-meeting admin | Minutes draft, action list, follow-up email | Tasks assigned, tracker updated |
| 11:00 | Focus work | Report, analysis, spreadsheet | Feeds the deck/proposal |
| 14:00 | Second meeting / client call | Same as above | Same |
| 15:30 | Build the output | Slides, proposal, quotation, summary | Review, revise |
| 16:30 | Status/reporting | Weekly report, update to manager | Sent |
| 17:30 | Plan tomorrow | To-do list | Loop restarts |

The loop is: **trigger -> raw capture -> admin artifact -> real deliverable -> sent.** Most of the pain sits in the admin artifact step, which is where WorkBuddy fits.

## 3. The chain, with final deliverables

| Trigger | Raw input | Intermediate artifacts | Final deliverable (what gets sent/filed) |
|---|---|---|---|
| Meeting | Recording / transcript / rough notes | Minutes draft, decisions, action items | **Minutes .docx + follow-up email** |
| Action items | Minutes | To-do list, owner/due-date tracker | **Task tracker .xlsx** |
| Client ask / project start | Brief, past files | Outline, data pull | **Proposal .docx / quotation** |
| Presenting | Notes, data, past deck | Storyline, charts | **Slide deck .pptx** |
| Every week/month | Week's folder of files | Collected updates | **Weekly/monthly report** (scheduled) |

Design rule: every step ends in a file someone can open, edit and send. Anything that stops at a chat answer is not finished.

## 4. Similar ideas already on the market

- **Otter, Fireflies** [sourced]: join meetings, transcribe, summarise, extract action items, push tasks to Asana/CRM via integrations. They stop at notes and tasks. Reviews say they miss implicit commitments and struggle with heavy accents and jargon. Follow-up emails and slides are a separate manual or AI step.
- **Microsoft Copilot Cowork / Claude Cowork** [sourced, comparison sites]: general agents over Microsoft 365 or local files. Copilot needs a Microsoft 365 Copilot licence; Claude Cowork runs on the desktop and reads and writes local files.
- **Gap** [my model]: capture tools end at notes. General agents are not shaped around a fixed meeting-to-deliverable chain. A pack that always ends in the final files is the open slot.

## 5. How WorkBuddy covers it

Tencent's own examples [sourced] list weekly/monthly reports, meeting-note transcription and distribution, and PPT layout and polishing. A Citi note [sourced, secondhand] names meeting minutes and periodic reports as use cases. Local Whisper speech-to-text is listed in the existing `WORKBUDDY_GUIDE.md`.

| Chain step | WorkBuddy piece |
|---|---|
| Recording -> transcript | Local Whisper skill |
| Transcript -> minutes, tracker, email | Office Document Suite (.docx/.xlsx) |
| Data -> deck | PPT skill / Office Document Suite |
| Weekly report | Scheduled Automation |
| Send / notify | Gmail, Slack connectors; phone trigger |
| Approval | Plan mode shows the steps before anything is written |
| Reuse | One `SKILL.md` per deliverable |

**Not confirmed:** a direct Tencent Meeting integration (one commentator infers it, nothing official). Also, reviewers say WorkBuddy may fit Western SaaS stacks less well.

## 6. Pivot option vs CikguKit

**"Meeting-to-Deliverable Pack":** drop a transcript or recording into `/input`; after the user approves the plan, WorkBuddy returns `minutes.docx`, `actions.xlsx`, `followup_email.docx`, and a 5-slide `update.pptx`.

- Same architecture as CikguKit (folder in, files out, approve in Plan mode), so the build effort is roughly the same.
- It is broader. The pitch needs one named persona, e.g. "a project coordinator", not "everyone in an office".
- Risk: meeting content is confidential, and Tencent advises against sensitive data. Demo files only (already a rule in `CLAUDE.md`).

**Process flag:** `CLAUDE.md` says anything outside the current scope needs the decider's approval, and the freeze is Oct 11 03:00. A pivot is a decider call, and today is Oct 10.

## 7. To test before committing

- [ ] Does Whisper run locally and handle a 10-minute Malay/English mixed recording?
- [ ] Can one prompt produce all four files in one Plan-mode run?
- [ ] Does the .pptx look presentable without manual fixing?
- [ ] Does a scheduled weekly report run unattended?

## Sources

- [Asana Anatomy of Work Index 2021](https://www.nasdaq.com/press-release/asana-anatomy-of-work-index-2021:-work-about-work-is-dominating-in-a-distributed)
- [Microsoft "infinite workday" (Axios)](https://www.axios.com/2025/06/17/microsoft-remote-work-meetings)
- [Microsoft 2025 study (Microsoft Switzerland)](https://news.microsoft.com/de-ch/2025/06/17/new-microsoft-study-reveals-the-rise-of-the-infinite-workday-40-of-employees-check-email-before-6-a-m-evening-meetings-up-16/)
- [McKinsey, The Social Economy](https://www.mckinsey.com/industries/technology-media-and-telecommunications/our-insights/the-social-economy)
- [Otter vs Fireflies (Read AI)](https://www.read.ai/articles/otter-ai-vs-fireflies-ai-notetaking-transcription-accuracy-and-collaboration)
- [AI meeting notes and follow-ups guide](https://onaitech.substack.com/p/how-to-use-ai-to-automate-your-meeting)
- [Tencent Techpedia: WorkBuddy](https://www-sg.tencentcloud.com/techpedia/144100?lang=en)
- [Claude Cowork vs Microsoft Copilot](https://easyitguys.com/ai/claude-cowork-vs-microsoft-copilot/)
