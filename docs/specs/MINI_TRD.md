# CikguKit TRD (PROVISIONAL)

## Goals / Non-goals
- Goals: one lesson in, print-ready bilingual worksheets out; low token use; runs from one folder on one laptop; all built, shown and documented in WorkBuddy.
- Non-goals (chosen to skip): offline model, multi-user sync, cloud hosting, curriculum certification, indigenous-language output.

## Stack (one line per layer)
- **WorkBuddy desktop, Plan mode:** the agent and the approval gate (track requires WorkBuddy only).
- **`cikgukit/SKILL.md`:** one custom skill that fixes format, reading level and languages. Cheaper than re-prompting.
- **`tools/build_docx.py` (python-docx), ASSUMED allowed:** lays out pages, numbering, answer key. Zero tokens. FALLBACK: WorkBuddy's Office Document Suite builds the .docx.
- **Cheap model by default (Hy3), stronger only if the check fails:** per-million-token prices differ ~20x between models.
- **Optional:** Automation (weekly run), Assistant (Telegram trigger).

## Architecture (demo flow)
```
lesson.docx -> [WorkBuddy: Plan, teacher approves]
   -> [skill: parse lesson locally]            0 tokens
   -> [LLM: questions + Malay/English, ONE call, JSON]   the only token spend
   -> [build_docx.py: layout, numbering, answer key]     0 tokens
   -> /output: easy.docx, medium.docx, hard.docx, answer-key.docx
   -> teacher edits -> [regenerate one level only, cached by lesson hash]
```

## Data model (key fields only)
- Lesson: id (hash), title, year, language
- Question: level (easy/medium/hard), text_ms, text_en, answer
- Worksheet: level, questions[], page_count

## Real vs faked
| Component | Status |
|---|---|
| Lesson parsing, question generation, translation | **Real** |
| Docx layout and answer key | **Real** (script or Office suite) |
| Plan-mode approval gate | **Real** |
| Class tracker scores | **Hardcoded seed data** |
| Phone trigger (Telegram) | **Real if it works; recorded fallback if not** |
| Curriculum alignment label | **Not claimed** |

## Alternatives considered
- **Web app + backend:** rejected, track forbids it and 24h is too short.
- **WorkBuddy does the layout too:** simpler setup, but output varies run to run and costs more tokens; kept as the fallback.
- **SME document checker (DocuVerify-lite):** strong industry fit; held in reserve if the brief points to a business track.

## Risks and fallbacks
- Credits run out -> cheap model, cache by hash, test with 1 lesson not 10.
- Script won't run in WorkBuddy -> Office suite fallback (decide by hour 2).
- Malay quality -> a Malay speaker checks every demo worksheet.
- Scheduled run stalls on a permission prompt -> demo it manually; show automation as a screenshot.
- Brief differs from education -> **swap rule:** keep the folder/skill/approval/output structure; change only `SKILL.md` and the template.
