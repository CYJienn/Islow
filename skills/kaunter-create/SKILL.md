---
name: kaunter-create
description: Design a new Kaunter dashboard widget (beyond the 9 built-in ones) and output a single JSON spec the owner pastes after /create in the Kaunter chat. Use when asked to make, add, design or "/create" a widget for Kaunter.
---

# kaunter-create

Kaunter is a draggable, resizable widget board. You add a widget **type** by writing one JSON spec. The owner pastes `/create <your JSON>` into the chat bubble; Kaunter registers the type, adds a tile to the tray, and places the widget on the board. You write no HTML, CSS or JS.

## Output rules

1. Reply with **one JSON object in one code block**, nothing else inside it. Then one line telling the owner: `Paste this after /create in the Kaunter chat.`
2. Pure JSON: double quotes, no comments, no trailing commas, no raw line breaks inside strings.
3. Use only the vocabulary below. Anything else is rejected with an error message you can fix and resend.
4. Demo data only. No real names, phone numbers or IC numbers.

## Spec

```json
{
  "id": "water",
  "title": { "en": "Water", "ms": "Air" },
  "icon": "M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z",
  "colors": ["#99f6e4", "#14b8a6"],
  "iconColor": "#04201c",
  "size": [4, 3],
  "mini": { "big": "6/8", "l1": "glasses today", "l2": "2 to go" },
  "blocks": [
    { "type": "sum", "bold": "6 of 8", "text": "glasses today" },
    { "type": "meter", "value": 75 },
    { "type": "row", "title": "Morning", "sub": "2 glasses", "value": "500 ml" }
  ]
}
```

| Field | Rule |
|---|---|
| `id` | required, lowercase `a-z0-9-`, 2-24 chars, must not be `time cal rem todo sales spend meet owe pack`. Reusing a custom id updates that widget in place. |
| `title` | required. A string, or `{en, ms}`. Max 40 chars. Give both languages; Malay needs a native check. |
| `icon` | optional. A single SVG path `d` string on a 24x24 grid, drawn as a 2px-stroke outline (no fills). Letters `MLHVCSQTAZ` and numbers only. Omit for a star. |
| `colors` | optional. Two hex colours, light then dark, used as the tile and header gradient. Pick from the palette below. |
| `iconColor` | optional hex. Use a dark ink (`#04201c`) when both colours are light. |
| `size` | optional `[cols, rows]`, default `[4,4]`, max 12 each. Cells are about 88px. Minimum is always 2 wide, 1 tall; user can resize. |
| `mini` | optional. Shown when the user shrinks the widget: `big` (one number or short value), `l1` (label), `l2` (small label). Falls back to a block count. |
| `blocks` | required, 1-40 blocks, drawn top to bottom. |
| `pipeline` | optional, see the Pipeline section. |

## Blocks (the only ones that exist)

| `type` | Fields | Use for |
|---|---|---|
| `sum` | `text`, optional `bold` | one-line headline, bold part first |
| `row` | `title`, optional `sub`, `value`, `pill`, `late` (true = orange pill) | list items, one fact each |
| `group` | `label`, `value` | a subtotal header between rows |
| `bars` | `items: [{label, value}]` (max 12, numbers) | small trend chart, last bar highlighted |
| `hist` | `items: [{label, value}]` (max 15, numbers) | histogram — bars with no gaps, last highlighted |
| `line` | `items: [{label, value}]` (max 20) | line chart with area fill and dots |
| `pie` | `slices: [{label, value}]` or `items` (max 8) | pie chart with legend |
| `donut` | `slices` like pie, optional `center`, `sub` | donut chart with center text + legend |
| `gauge` | `value` 0-100, optional `label`, `center` | 270-degree gauge with center value |
| `ring` | `value` 0-100, optional `label`, `center` | full-circle progress ring with center value |
| `meter` | `value` 0-100, optional `label` | horizontal progress bar |
| `scatter` | `points: [{x, y}]` (max 30, x/y 0-100) | scatter plot with axes |
| `heat` | `items: [{label, value}]` (max 49) | heatmap grid, colored by value intensity |
| `text` | `text` | a quiet note |

Strings are plain text and are trimmed (about 120 chars, `text` 400). Keep a row title to a few words; the widget is small.

## Pipeline (optional, powers the Pipeline page)

Add a `pipeline` field to show **how WorkBuddy built this widget** as a clickable flow (input, classify, JSON, widget). The owner opens it from the dock (Pipeline) and clicks a step to read what it is and ask for a change. If you leave it out, a 3-step default is drawn.

```json
"pipeline": {
  "nodes": [
    { "id": "mail", "kind": "trigger", "title": "New email", "sub": "Gmail inbox", "desc": "One or two plain sentences: what this step does." },
    { "id": "agent", "kind": "ai", "title": "Email agent", "sub": "reads and drafts", "desc": "..." },
    { "id": "llm", "kind": "model", "title": "AI model", "desc": "..." }
  ],
  "edges": [ ["mail", "agent"], ["llm", "agent", null, "dashed"] ]
}
```

- `kind`: `trigger` (input) `ai` `branch` (decision) `data` (JSON) `widget` `output` and the small side nodes `model` `memory` `tool`. Unknown kinds draw as `data`.
- Node: `id` (unique), `kind`, `title` (max 40), optional `sub` (small label), `desc` (max 500, what a non-technical owner should know), optional `icon` (SVG path, same rule as the widget icon), optional `x`,`y` (grid cells; leave out to auto-place left to right).
- Edge: `[from, to, label?, "dashed"?]`. A plain edge flows left to right. A `"dashed"` edge from a side node (`model`, `memory`, `tool`) to its parent hangs the side node under the parent.
- Typical shape: `trigger -> ai -> branch -> data -> widget`, with `model`/`memory`/`tool` hanging under the `ai` node. Max 24 nodes, one job per node, say the data actually used.
- The last real-world step should be a `data` node named `JSON data`, then the `widget` node, so the owner sees where the board gets its numbers.
- Full example with an email agent: `skills/kaunter-create/email.json`.

**Change requests:** when the owner asks to alter a step, they paste you: `Change the "<step>" step (node id "<id>") of the Kaunter "<widget>" widget (id "<id>"): <request>`. Reply with the **full updated spec**, same `id`, changed pipeline and blocks, so `/create` updates it in place.

## Design rules (match the board, do not invent)

- Palette is light: cool-gray ground, white cards, teal `#14b8a6` accent, orange only for overdue/late. Safe `colors` pairs: `["#5eead4","#0d9488"]` `["#99f6e4","#14b8a6"]` `["#7dd3c8","#2a9d8f"]` `["#cbd5e1","#64748b"]` `["#a9b6c6","#5b6b7f"]` `["#475569","#1f2937"]`. Dark pairs need no `iconColor`; light pairs need `#04201c` or `#0f172a`.
- One job per widget. Lead with the number that matters (`sum` first), then 3-6 rows at most. Money looks like `RM 1,240`.
- Use `late: true` only for something actually overdue. Never use colour as the only signal; put the word in `pill`.
- `size` should fit the content: about 1 row per 2 blocks, 3 to 5 rows tall, 4 wide.
- Source of truth for tokens is `frontend/style.css` (`:root`). `docs/design/DESIGN.md` still lists an older dark-blue palette; ignore its colours.

## Sync paths

- **Chat (owner):** `/create <JSON>`. A bare `/create` shows help. A fenced ```json block is fine.
- **WorkBuddy / code:** `Kaunter.create(spec)` in the page, or put specs in `window.KAUNTER_DATA.widgets = [spec, ...]` in `data.js` and call `Kaunter.refresh()`. Re-sending a spec with the same `id` updates the widget's content live.
- Specs persist in the browser (`kaunter.custom.v1`). The owner presses Save in the dock to keep the widget's position.

## Self-check before replying

`id` valid and not built-in, `blocks` non-empty with known types, hex colours only, one code block, no HTML anywhere.
