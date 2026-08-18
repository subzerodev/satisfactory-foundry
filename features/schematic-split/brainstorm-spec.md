# #135 — Split the schematic (Stage 23)

**Ticket:** #135 · **Epic:** #136 · **Milestone:** 94 · **Tier:** 2
**Status:** design r2

## Purpose

Michael: *"this diagram needs rethought i dont understand what its saying from
the layout of it."* The schematic answers three questions at once — where the
belts run, which stretches are over capacity, and how the machines are arranged —
and the third fights the first two for space.

## Settled — do NOT re-litigate

From Michael, 2026-08-17 (#135 comment 24630):

> **The schematic splits into separate views.** The bus/feed drawing answers
> **how to physically build it** *and* **what is over capacity** — together.
> **The 106-machine block becomes its own view.**

Constraints from epic #136: **presentation only** — the solver, the saturation
model and #120's parallel-line semantics are unchanged. And from Stage 13/14
(`docs/master-plan.md:211-252`): **nothing is deleted**; the block moves.

## What r1 got wrong, because it drives everything below

r1 built the split around `MachineBand`. **`MachineBand` does not run at Michael's
machine count.**

`bandMode(N)` is `USABLE / N < minPitch` = `912 / N < 8` (`layout.ts:100-102`,
`:21`, `:30`), so it engages only at **N > 114**. At N = 106,
`912 / 106 = 8.60`, which is **not** < 8 → `band === false`, and
`Schematic.tsx:507` takes the *else* arm.

**His screenshot confirms it independently:** the number strip reads 1, 3, 6, 9 …
105, 106 — every third index, which is the non-band `labelStep` rule
`ceil(106 × 20 / 912) = 3` (`layout.ts:297-300`). Band mode does not use
`labelStep` at all.

So what he is looking at is **106 adjacent 6px rects at pitch 8, 40px tall**
(`Schematic.tsx:516-537`) — not a band. r1 moved elements that are not rendered.

**The non-band path is therefore the primary path this design must specify.**

## The second thing r1 assumed and source refutes

The non-band branch emits exactly two things per machine: a `<rect>`
(`Schematic.tsx:518-523`) and a conditional `<text class="machine-label">`
(`:524-535`). **There is no tick `<line>`** — the rect *is* the positional mark.

So "move the rects out and the ticks stay" is impossible below the threshold: it
would leave numbers floating with nothing marking the boundaries the belt
segments' `x1`/`x2` land on. **The schematic's machine axis has to be drawn, not
retained.** That is the substantive design work in this ticket.

## Design

### 1. The machine axis (new drawing, both modes)

The schematic keeps a **thin ruler** where the 40px machine row is today:

- a continuous baseline rule spanning the machine axis;
- a **tick** at each labelled index;
- the existing index labels beneath, unchanged in content and x-position.

Height **12px**, replacing 40px. It reads as a scale rather than a filled block,
which is the point: a rule with ticks cannot smear.

One component, two index sources — the only mode difference:

| | tick indices | label indices |
|---|---|---|
| non-band (N ≤ 114) | machines where `m.labeled` | same |
| band (N > 114) | `layout.significant` | `layout.labeledSignificant` |

At N = 106 that is ticks and labels at 1, 3, 6 … 106 (~37 marks). At N = 20,
`pitch ≥ labelPitch` so `labelStep = 1` (`layout.ts:297-300`) and every machine
gets a tick — the axis is denser at small N, which is correct and readable.

*(The "colliding number strip" in Michael's report is the label crowding at
`labelStep = 3`; this design does not change label placement, so it does not fix
that. It is part of what #138 must address — flagged, not silently inherited.)*

### 2. The machines view

Renders the machine row at its **current** 40px height with the full drawing width
to itself, reusing `computeLayout`'s x positions and the existing band/non-band
split verbatim: `MachineBand` for N > 114, per-machine rects for N ≤ 114. **The
block is moved, not redesigned** — what it should *become* is #138, blocked by this.

### 3. Layout: the 40px is reclaimed, and that is a `layout.ts` change

r1 claimed the space could be reclaimed in CSS and that there was "no new layout
math". **Both were wrong** — the height is `layout.height` computed at
`layout.ts:321-326` with `LAYOUT.machineH` unconditional, and `.schematic` carries
no height (`app.css:684-692`).

`computeLayout` gains an explicit machine-row height:

```ts
computeLayout(result, machineCount, machineRowH)   // schematic: 12, machines: 40
```

x geometry (`pitch`, `machines[]`, every `x1`/`x2` via `boundaryX`) is independent
of it and is **identical in both views** — that is what keeps the two drawings in
register.

**Consequences, stated rather than denied:** `machineTop`, `outputTop` and
`height` all shift, so the output lanes and their breakout arrows **move up by
28px** in the schematic. The r1 criterion "output breakouts are pixel-unchanged"
was therefore unachievable and is withdrawn; the honest criterion is that they are
unchanged *relative to the machine axis*, and that the drawing gets shorter.

The literal `40` is duplicated at `Schematic.tsx:382`, `:393`, `:522`, `:553`
rather than read from `LAYOUT.machineH`. Those must read the parameter, or the
ticks silently desynchronise from the row.

### 4. A third view

`type View = "schematic" | "blueprint"` (`App.tsx:66`) gains `"machines"`. Sites:
`:66` union, `:158` default (stays `"schematic"`), `:429-446` a third tab,
`:447-469` a third arm, plus the `Machines` import — **five in `App.tsx`** — and
`.view-tabs` already scales (`app.css:850-853`). No store change; view state is
`useState`.

## Changes

1. `ui/layout.ts` — `computeLayout` takes `machineRowH`; `machineTop`/`outputTop`/
   `height` derive from it.
2. `ui/Schematic.tsx` — new `MachineAxis` (baseline + ticks + labels); the
   schematic renders it at 12px instead of the machine row; the four literal `40`s
   read the parameter.
3. `ui/Machines.tsx` (new) — the machine row at 40px, band and non-band arms moved
   verbatim.
4. `ui/App.tsx` — the third view.
5. `ui/app.css` — `.machine-axis` styles; `.view-tab` untouched.
6. Tests — below.

## Tests

**Four existing tests assert machine-block markup inside `<Schematic>` and will
fail. Each is re-pointed, not deleted** (the Stage 13/14 "nothing is deleted"
invariant applies to their coverage too):

| Test | Asserts | Lands |
|---|---|---|
| `smoke.test.tsx:204` | ≥20 `<rect>` at N=20 | `<Machines>` — `LaneG` emits no rects, so the schematic would have none |
| `smoke.test.tsx:330-332` | `machine-band` count 1, `×161` | `<Machines>` |
| `smoke.test.tsx:446-448` | `class="machine"` count 114 | `<Machines>` |
| `smoke.test.tsx:371-375` | `machine-band-mark` vs `machine-label` counts | split: marks → `<Machines>`, the axis keeps `machine-label` |

New tests:

1. **`bandMode` boundary is pinned in the split**: at N=106 the schematic renders
   the axis and **no** `class="machine"` rects; at N=161 the same, with the band in
   `<Machines>`. This is the pin on r1's root error.
2. The axis renders a tick per labelled index at N=20, N=106 and N=161.
3. `computeLayout` y-geometry at `machineRowH` 12 vs 40 — both pinned explicitly,
   with the expectation written as a **literal**, not derived from `LAYOUT.machineH`.
   *(r1's proposed tripwire — "if `layout.test.ts` changes, the split leaked" —
   cannot fire: `layout.test.ts:49-59` computes its expectation from the constant
   itself, so shrinking it keeps the test green. That tripwire is retired and
   replaced by these explicit pins.)*
4. Belt segment `x1`/`x2` are identical between the two views at the same N.

## Acceptance criteria

- Three tabs; SCHEMATIC still first and default.
- **At N = 106** (the reported case): the schematic shows the tick axis with labels
  and **no** machine rects; the machines view shows all 106.
- **At N = 161**: the schematic shows the tick axis from `significant`; the
  machines view shows the band and its `×161`.
- **At N = 20**: the schematic shows a tick per machine; the machines view shows 20
  rects.
- Belt segments, `x2` marks, seams and feed entry marks are unchanged in x; output
  lanes move up 28px and are unchanged relative to the axis.
- Nothing is deleted: no view, no data, no test coverage.
- `npm test`, `npm run check`, `npm run build` green; both browser matrices green.
- **Bidirectionality:** every new test fails with its production code reverted,
  captured in `features/schematic-split/r2-verification.log`.

## Out of scope

- **Redesigning the machine block, and fixing the label crowding** — #138.
- The solver, the saturation model, #120's parallel-line semantics.
- The Blueprint view.

## Assumptions ledger

| Assumption | Grounding |
|---|---|
| Bus geometry is machine-indexed, so the axis must stay | **Verified** — `layout.ts:77-85`; all x via `boundaryX` (`:214-216`, `:229`, `:234-235`, `:243`, `:306`) |
| N = 106 is **not** band mode | **Verified by arithmetic** — `912/106 = 8.60` ≮ 8 (`layout.ts:100-102`); corroborated by the screenshot's every-3rd labels matching `labelStep(106) = 3` |
| The non-band path has no ticks | **Verified** — `Schematic.tsx:516-537` emits `<rect>` + conditional `<text>` only |
| The 40px is layout, not CSS | **Verified** — `layout.ts:321-326`; `.schematic` has no height (`app.css:684-692`) |
| The `40` literal is duplicated in four places | **Verified** — `Schematic.tsx:382`, `:393`, `:522`, `:553` |
| Four smoke tests break | **Verified** — `smoke.test.tsx:204`, `:330-332`, `:371-375`, `:446-448` |
| r1's leak tripwire cannot fire | **Verified** — `layout.test.ts:49-59` derives its expectation from `LAYOUT.machineH` |
| Adding a view touches five `App.tsx` sites, none in the store | **Verified** — `:66`, `:158`, `:429-446`, `:447-469`, plus the import |
| Stage 15 thinning applies to band mode only | **Verified** — `labeledSignificantOf` called only when `band` (`layout.ts:292-295`) |
| A 12px tick ruler reads better than a 40px filled row | **Judgement, not measurement.** The functional claim — a rule with ticks cannot smear the way 106 adjacent filled rects do — is the reason; whether it *communicates* is Michael's call, and #138 is where the block's own legibility is decided |
