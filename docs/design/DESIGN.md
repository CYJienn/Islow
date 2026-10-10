---
name: Kaunter
description: A workbench dashboard for a small-shop owner; widgets pulled from a glass tray onto a dotted canvas on a Tencent-blue ground.
colors:
  ground: "#061744"
  ground-2: "#08205c"
  canvas: "#0a2468"
  card: "#0e2f82"
  card-2: "#12388f"
  ink: "#eaf1ff"
  ink-2: "#b4c6f1"
  ink-3: "#8aa3da"
  green: "#28b894"
  green-2: "#009273"
  on-green: "#04163c"
  blue: "#0052d9"
  blue-2: "#4f8bff"
  sky: "#8fbaff"
  alert: "#f2994a"
typography:
  headline:
    fontFamily: "Atkinson Hyperlegible, Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.2
  title:
    fontFamily: "Atkinson Hyperlegible, Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Atkinson Hyperlegible, Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.4
  label:
    fontFamily: "Atkinson Hyperlegible, Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
  clock:
    fontFamily: "Atkinson Hyperlegible, Atkinson Hyperlegible Next, system-ui, sans-serif"
    fontSize: "clamp(28px, 28cqh, 64px)"
    fontWeight: 700
    lineHeight: 1
rounded:
  card: "8px"
  control: "10px"
  canvas: "16px"
  pill: "999px"
spacing:
  tight: "6px"
  sm: "10px"
  md: "12px"
  lg: "16px"
components:
  widget-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "0 14px 12px"
  chip:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  chip-mode-edit:
    backgroundColor: "{colors.green}"
    textColor: "{colors.on-green}"
    rounded: "{rounded.pill}"
    height: "34px"
  pill-late:
    textColor: "{colors.alert}"
    rounded: "{rounded.pill}"
    padding: "1px 8px"
  segmented-selected:
    backgroundColor: "{colors.green}"
    textColor: "{colors.on-green}"
    rounded: "9px"
    height: "40px"
  button-quiet:
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "44px"
  toast:
    backgroundColor: "{colors.green}"
    textColor: "{colors.on-green}"
    rounded: "{rounded.pill}"
    padding: "10px 18px"
---

# Design System: Kaunter

## Overview

**Creative North Star: "The Workbench"**

Kaunter is a bench the owner rearranges, not a report handed to them. A deep Tencent-blue ground carries a dotted canvas; flat 8px cards sit on the dots and snap to them. In view mode the dots recede (30% opacity) and the page reads as today at a glance. In edit mode the dots come up to full strength, cards go dashed-edged, and a glass tray of widget tiles slides in. The shift between the two is the whole interaction.

The system is dark, dense, and calm. Cards are flat with a 1px edge; all depth and glass lives in the tools around the cards (dock, tray, popovers), never in the content. Green means "act or done", orange means "overdue", and nothing else borrows either.

The white KPI-card dashboard is refused. Atkinson Hyperlegible is the single face because the audience reads small numbers quickly, in two languages (English and Malay).

**Key Characteristics:**
- Blue-on-blue tonal layering: ground, canvas, card step lighter in that order.
- One action colour (WorkBuddy green) and one alarm colour (Hornbill orange, overdue only).
- Flat 8px cards with 1px low-alpha edges; glass and shadows only in dock, tray, popovers.
- A dotted lattice that is the visible grid and the snap target.
- Never colour alone: overdue carries an icon and the word.

## Colors

A saturated navy ground with lighter blue card fields, a mint-green action accent, and a single warm orange reserved for lateness.

### Primary
- **WorkBuddy Green** (`{colors.green}`, #28b894): Action and "now". Edit-mode chip, selected segment, checked checkbox, today in the calendar, current bar in the chart, ghost snap rectangle, toast, focus ring, selection. Sampled from the live workbuddy.ai accent.
- **Deep Bud Green** (`{colors.green-2}`, #009273): The darker WorkBuddy nav green. Used inside tile gradients (to-do tile end stop), not as a UI fill.
- **Night Ink on Green** (`{colors.on-green}`, #04163c): Text and glyphs on any green fill.

### Secondary
- **Tencent Blue** (`{colors.blue}`, #0052d9): The brand blue; appears as the end stop of the calendar tile gradient. TDesign brand blue recalled from memory, not sampled from a live source.
- **Signal Blue** (`{colors.blue-2}`, #4f8bff): Inactive chart bars.
- **Sky** (`{colors.sky}`, #8fbaff): Informational secondary state ("warn" pill, "no" state, event dots). Calm, not alarming.

### Tertiary
- **Hornbill Orange** (`{colors.alert}`, #f2994a): Overdue only.

### Neutral
- **Deep Ground** (`{colors.ground}`, #061744): Page background (with one soft lighter radial glow at top-left), label plates, theme-color.
- **Ground 2** (`{colors.ground-2}`, #08205c): Ring behind dock badges.
- **Canvas Navy** (`{colors.canvas}`, #0a2468): The canvas panel the lattice sits on.
- **Card Blue** (`{colors.card}`, #0e2f82): Widget surface. Also the base of the dock's translucent glass.
- **Card 2** (`{colors.card-2}`, #12388f): Declared lifted-card step; not used by the shipped components, so treat as reserved.
- **Pale Ink** (`{colors.ink}`, #eaf1ff): Primary text; about 10:1 on card.
- **Ink 2** (`{colors.ink-2}`, #b4c6f1): Secondary text, metadata.
- **Ink 3** (`{colors.ink-3}`, #8aa3da): Weekday headers, completed-item strike-through, grip dots; about 4.8:1 on card, so keep it to 12px+ non-essential text.
- **Edge** (rgba(170,198,255,0.2)) and **Edge Strong** (rgba(170,198,255,0.4)): 1px card borders and dividers; strong for chips, edit-mode dashed borders, popovers.

### Named Rules
**The Orange Is Overdue Rule.** Hornbill orange appears only on overdue items, and always with the alert icon and the word "overdue" (never colour alone). Nothing else, including warnings, may borrow it; use Sky for non-alarm states.

**The Green Means Act Rule.** Green marks what the owner can do or has done now. It never decorates.

**The Module Hue Rule.** Each widget module owns a gradient pair used only on its small header chip and its tray tile (e.g. calendar #6fa3ff to #0052d9, to-do #4fe0b8 to #009273). These identify modules; they are not general palette colours.

## Typography

**Display Font:** none; Atkinson Hyperlegible (self-hosted, 400 and 700, woff2) with Atkinson Hyperlegible Next, system-ui fallbacks.
**Body Font:** Atkinson Hyperlegible, same stack.
**Label/Mono Font:** ui-monospace / Cascadia Mono / Consolas for `code` only.

**Character:** One humane, high-legibility face, with weight (400 vs 700) doing all the hierarchy work. Numerals use tabular figures wherever amounts and times align.

### Hierarchy
- **Headline** (700, 22px, 1.2): The greeting in the top bar, balanced wrap.
- **Brand / Tray title** (700, 20px and 17px): Wordmark and tray heading.
- **Title** (700, 15px, 1.3): Widget titles, tile-label scale, meeting title.
- **Body** (400, 15px, 1.4): Page default; list rows at 14px; summary lines 13.5px.
- **Label** (400/700, 12.5 to 13px): Metadata, chips, field labels, pills (12px).
- **Clock** (700, clamp(28px, 28cqh, 64px), 1): The time widget numeral, scaled by container height.

### Named Rules
**The Weight Is The Hierarchy Rule.** Size steps are small (12.5 to 22px, plus the clock); distinction comes from 400 versus 700, never from a second family.

**The Tabular Numbers Rule.** Amounts, times, dates, and chart values use `font-variant-numeric: tabular-nums`.

## Layout

A fixed left rail (98px) holds the dock; the main column holds a top bar (brand, greeting and date, freshness chip, mode chip) and the canvas. The canvas is a 16px-radius navy panel (12px padding) containing an absolutely positioned lattice grid. Columns: 12 by default, 8 under 760px, 4 under 560px; the cell is grid width divided by columns (88px is only the CSS fallback). Widgets are placed by integer x, y, w, h in cells, inset 3px per side, so there is a 6px gutter between neighbours. Widgets have per-module default and minimum sizes (minimum 3 cells wide, 2 to 3 tall).

Edit mode: at 1280px and wider the tray is its own 340px column and the main content shifts right by 356px beyond the rail, so no widget hides behind it. Below 1280px the tray becomes a bottom strip with horizontally scrolling tiles and the page gains bottom padding. At 720px and below the rail collapses to 0, the dock moves to a bottom bar, the top bar becomes a two-row grid, and popovers stretch to the viewport with 8px margins. Widget bodies adapt with container queries (e.g. the calendar grid hides under 340px height, the clock note under 150px).

Rhythm is compact: 6, 10, 12, 14, 16px steps; list rows 8px vertical padding with 1px dividers. Touch targets are enlarged with invisible hit areas (close button, checkbox) and 40 to 44px minimum control heights.

## Elevation & Depth

Hybrid, with a strict boundary. Content is flat: widget cards use tonal layering (ground, canvas, card) and a 1px edge, no shadow at rest. Depth and glass belong to the tools floating above the content: the dock, the tray, popovers, and the drag chip. This split was a user request.

### Shadow Vocabulary
- **Dock glass** (`rgba(14,47,130,0.66)` fill, `backdrop-filter: blur(20px) saturate(1.6)`, inset hairlines plus `0 22px 44px -20px rgba(0,0,0,0.8)`): the magnifying dock.
- **Tray / popover glass** (`rgba(5,18,58,0.86)` and `0.94` fill, `blur(18px)`, `0 28px 50px -22px rgba(0,0,0,0.85)`): tray and popovers.
- **Glass tile** (gradient white 0.24 to 0.08 plate, `blur(7px) saturate(1.5)`, top-lit inset highlight): tray tiles only, over a tilted (28deg) gradient plate.
- **Drag lift** (`0 22px 36px -14px rgba(0,0,0,0.7)` with a green border): a widget being dragged. Transient.
- **Placement pulse** (`0 0 0 4px` green ring, 0.9s): a widget just dropped.

### Named Rules
**The Flat Cards Rule.** A widget card at rest has no shadow and no blur. Glass and shadow are for the dock, tray, popovers, and transient drag states only.

## Shapes

An 8px card radius is the spine (widgets, ghost rectangle, dock labels, menu items). Larger containers step up: canvas 16px, popovers 16px, tray 20px, dock 22px. Controls use 9 to 14px (segmented 12/9, quiet button 10, dock tile 14, tray tile 20 to 22). Chips, pills, and the toast are fully round (999px); the close button is a circle. Module header chips are 26px squares with 7px radius. Borders are 1px low-alpha blue; in edit mode they turn dashed and stronger. The lattice is a radial-gradient dot field (1.6px dots, one per cell), offset half a cell so cards snap to dot-bounded cells. The snap target is a 2px dashed green rectangle tinted at 14% green.

## Components

### Dock
A vertical magnifying dock (left, vertically centred) of 48px tiles; icons scale with a cosine falloff toward the pointer, and the container grows to match. Glass container, gradient blue tiles, the pressed tile turns green with night-ink glyph, a small dot marks the active item, a green badge marks pending state. Labels appear on hover or keyboard focus. On phones (720px and below) it is a horizontal bottom bar with 44px tiles; on touch devices (`hover: none`) a short 11px caption sits under each tile because there is no hover.

### Widget Card
Flat 8px card, `{colors.card}` fill, 1px edge. Header (min 46px): 26px gradient module chip, bold title, and in edit mode the tools (grip dots, 30px close circle). Body scrolls, 14px side padding. In edit mode the card gains a dashed border, a grab cursor on the header, and a green L-shaped resize corner (30px hit area). Dragging adds the lift shadow and green border. Entry is a single 0.6s rise with 60ms stagger.

### Glass Tray and Tiles
64px tiles (58px in the strip, 56px on short screens) of a tilted gradient plate with a frosted glass face and white glyph, label below in 13px bold. Placed modules dim to 45% with a green check badge and can still be tapped to remove. Dragging a tile shows a 72px drag chip and the ghost snap rectangle on the lattice. Plain CSS port of the React Bits GlassIcons look.

### Chips and Pills
Chips: fully round, 1px strong edge, 13px, secondary ink. The mode chip is the only filled one when active (green, night ink). The freshness chip is informational. Pills in rows: 12px, 1px edge; `late` is orange bold with border in current colour, plus icon and word; `warn` is sky.

### Checkbox, Meter, Chart
22px rounded-square checkbox, 2px ink-3 border; checked fills green with a night-ink check. Meter: 6px track, green fill. Bar chart: signal-blue bars with 4px top radius, current period in green and bold.

### Segmented Control and Buttons
Language control: two-up segmented group on a faint white tile, selected segment green with night ink, 40px min height. Quiet button: transparent, 1px strong edge, 10px radius, 44px min height, hover tint of 8% white. There is no filled primary button; the green fill is reserved for the mode chip, selected state, and toast.

### Popovers and Toast
Popovers: 270px, 16px radius, dark glass, menu rows 44px min with a green check for the selected item. Toast: round pill, green with night ink, rises from below, centred over the main column.

### Motion
Ease is a single decelerating curve (`cubic-bezier(0.22, 1, 0.36, 1)`). Widgets animate left, top, width, and height on snap (0.3s; intentionally animating layout properties so cards glide to their dots; disabled while dragging or resizing). Other motion: widget rise-in, dock magnification and hop, tray slide-in with staggered tile entry, placement pulse. Under `prefers-reduced-motion` all animation and transition durations collapse to 0.01ms.

## Do's and Don'ts

### Do:
- **Do** keep widget cards flat: `{colors.card}` fill, 1px edge, 8px radius, no shadow at rest.
- **Do** reserve Hornbill orange (#f2994a) for overdue and pair it with the alert icon and the word.
- **Do** use WorkBuddy green only for action, selection, "now", and done states, with night-ink (#04163c) text on it.
- **Do** use Atkinson Hyperlegible at 400 and 700 only; build hierarchy with weight.
- **Do** keep layout on the integer cell lattice (x, y, w, h in cells, 3px inset) so snap and the dotted canvas stay the same grid.
- **Do** give every new module a gradient pair for its header chip and tray tile, and a 3 by 2 or 3 by 3 minimum size.
- **Do** keep glass, backdrop blur, and soft shadows to the dock, tray, popovers, and drag states.
- **Do** honour `prefers-reduced-motion` and give touch devices visible captions.

### Don't:
- **Don't** build a white or light KPI-card dashboard; the world is blue-on-blue.
- **Don't** put shadows, blur, or gradients on widget cards.
- **Don't** use orange for warnings, emphasis, or decoration; use Sky for non-alarm states.
- **Don't** convey state with colour alone (overdue, done, placed all carry an icon or text).
- **Don't** introduce a second typeface or a decorative display face.
- **Don't** use ink-3 (#8aa3da) for text that must be read; it is for disabled and de-emphasised items.

## Known Limits

- Malay copy has not been checked by a native speaker.
- The 721 to 1279px bottom-strip tray layout has not been screenshot-verified.
- WorkBuddy green (#28b894, #009273) was sampled from the live workbuddy.ai page; Tencent blue (#0052d9) is recalled from the TDesign brand, not sampled.
- `card-2` (#12388f) is declared but unused by any shipped component.
- Superseded: the earlier CikguKit system (warm paper palette, Fraunces, no-shadow-on-chrome rule) no longer applies; it is kept at DESIGN_cikgukit.md.
