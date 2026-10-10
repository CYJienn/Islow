# CikguKit PRD (PROVISIONAL)

**Summary:** A teacher drops one lesson file into a folder. WorkBuddy shows a plan, the teacher approves, and it writes leveled, bilingual, print-ready worksheets plus an answer key. Built and presented entirely in WorkBuddy. Goal: one real lesson becomes printable materials in under 90 seconds of demo time.

## Demo flow (golden path, 3 to 5 minutes)
1. Judge sees the "before": a plain Year 4 lesson (.docx) and a teacher's note "I need 3 levels, Malay + English, printable" -> the pain.
2. Teacher drops `lesson.docx` in `/input`, opens WorkBuddy in **Plan mode**, runs the `cikgukit` skill -> a step-by-step plan appears, teacher approves.
3. Output appears in `/output`: 3 worksheets (easy/medium/hard), each bilingual, 1 page, plus an answer key -> open one in Word, print-preview.
4. Teacher edits one question and asks "regenerate the hard level only" -> only that file changes (cheap, cached).
5. Impact slide: credits used for this lesson and time saved (both MEASURED in rehearsal, never guessed).

## Must-have features (max 3)
- **Lesson to 3-level bilingual worksheets.** Pass: opens in Word; 3 levels; each fits 1 page; Malay and English both present; answer key correct on a 10-question spot check by a Malay speaker.
- **Human approval before files are written.** Pass: demo shows the Plan-mode approval step, and nothing is written before it.
- **Usage proof and token log.** Pass: screenshots of the Changes panel for every demo run, and a credits-per-lesson number we can state.

## Nice-to-have (only after the golden path works)
- `class-tracker.xlsx` with seeded scores
- Weekly automation: "every Monday, prep the week's worksheets"
- Phone trigger through Assistant (Telegram)
- Same skill, scam-awareness handout variant for community workers

## NOT building
Web app, login, backend server, database, student-facing chatbot, mobile app, Iban/Bidayuh output, grading from photos, curriculum-alignment claims, anything needing live internet at demo time.

## Success
A judge says "I could hand this to a real teacher tomorrow" within 90 seconds of the first click.

## Open questions
- Are Python scripts allowed and runnable in WorkBuddy for this track? (ASSUMED yes; test tonight.)
- Do the provided credits cover the cheap model (Hy3) and automations?
- Is the real brief about education, or will it point elsewhere? If so, which parts of this swap out (see TRD "swap rule")?
