# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Plain static HTML, CSS and JavaScript. No build step, no install, opens from a double-click on any device. User's answer: "choose a light weigth one this is just for a hackathon projetc i dont need to ship thios to actually prodcuttion , i need lightweight so i can empahsis it can be used on any device". The pasted React Bits components (GlassIcons, Dock) are re-created in plain CSS/JS, not imported.

## Users

Owner-operators of small Malaysian businesses (store owners, stall owners, entrepreneurs, SMEs). They use a phone or a laptop between customers and calls. Not technical. Primary default view is one shared "preview" layout; they then make it their own.

## Product Purpose

A local dashboard that WorkBuddy (Tencent's desktop AI agent) fills in. Receipts, documents, meeting transcripts and chats are parsed by WorkBuddy into modules (calendar, reminders, to-dos, sales, spend, meeting notes, money owed, monthly accountant pack). The dashboard shows the result and lets the owner choose which modules to keep and where they sit. Success: an owner opens it, sees today at a glance, and can rearrange it in under a minute.

## Positioning

Plug and play: the owner picks their own widgets and layout; WorkBuddy does the parsing, so there is no accounting software to learn and no per-seat SaaS fee beyond WorkBuddy itself.

## Operating Context

- WorkBuddy writes a `data.js` file next to the page; the page reads it. No server.
- Inputs land in an `/inbox` folder (drop, Google Drive sync, Telegram). WhatsApp has no confirmed route into WorkBuddy. See `SME_DASHBOARD_PLAN.md`.
- Refresh cadence is hourly at best (10 minutes is unverified). The page shows when it was last updated.
- Hackathon prototype (freeze Oct 11 03:00); not a production release.

## Capabilities and Constraints

- Modules (8): CAL (calendar), REM (reminders), TODO (to-dos), SALES, SPEND (receipts), MEET (meeting notes), OWE (money owed and owing), PACK (monthly accountant pack). Plus TIME (clock) from the sketch.
- Source of truth for the interaction: `islow idea 1 pic.pdf`. A sidebar of widget options; drag a widget onto a dotted snap grid; resize and different shapes; edit mode vs view mode (view is default, editor hidden); a prebuilt default layout, then user edit, then save.
- Interface language: English and Malay (Bahasa Malaysia) toggle, set in Settings. Parsed content keeps the owner's own words.
- Must work on phone, tablet and desktop, touch and mouse.
- All demo data is synthetic and must be labelled as such. No real names, receipts or customers.

## Brand Commitments

- Colour theme drawn from Tencent and WorkBuddy. White must not be the dominant colour (user's words: "theme the project arouund tencent and workbuddy colour ways, dont let white be the main colourwat").
- React Bits GlassIcons look for the widget picker in the editor; React Bits Dock effect for the app controls.
- Inherits what still applies from the CikguKit `DESIGN.md`: Hornbill orange as a single accent, Atkinson Hyperlegible, 8px radius, never rely on colour alone.

## Evidence on Hand

- `islow idea 1 pic.pdf`: the user's sketch of the editor and the view mode.
- `SME_DASHBOARD_PLAN.md`: inputs, routing, outputs, module list.
- No real SME owner interview yet. No measured time-saved figure. Nothing here may claim one.

## Product Principles

1. Preview first: the default layout must be useful before the owner touches anything.
2. The owner arranges; WorkBuddy fills. The dashboard never asks the owner to type data in.
3. Light on every device: no build, no server, nothing that stops it opening on a cheap phone.
4. The owner's words stay theirs: show parsed content in the language it arrived in.
5. Be honest about freshness: always show when WorkBuddy last updated the data.

## Accessibility & Inclusion

- Keyboard and touch operable, including drag, move and resize alternatives.
- Colour never the only carrier of meaning (overdue is a word as well as a colour).
- Respect reduced-motion.
- Bilingual: English and Bahasa Malaysia; Malay copy needs a native-speaker check.
