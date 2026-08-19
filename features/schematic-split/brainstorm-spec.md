# #135 — Split the schematic (Stage 23)

**Ticket:** #135 · **Epic:** #136 · **Milestone:** 94 · **Tier:** 2
**Status:** design r3

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

The schematic keeps a **thin ruler**, 12px tall, where the 40px machine row is
today. It reads as a scale rather than a filled block: a rule with ticks cannot
smear.

**It carries two kinds of mark, because it has two jobs.** r2 specified one kind
and both reviewers showed that one kind cannot do both:

| Mark | x | Says |
|---|---|---|
| **major tick**, full 12px | `boundaryX(m)` — the cell's **left edge** (`layout.ts:214-216`) | *a belt span starts or ends here* |
| **minor tick**, 4px | `m.x + pitch/2` — the cell **centre**, the label's own x (`Schematic.tsx:527`) | *this number is this machine* |

Labels keep their existing content and x, beneath the minor tick that binds them.

**Why both.** r2 put ticks at labelled indices only. Two independent problems,
each verified:

- **Those positions are arithmetic, not solver-derived.** Labelled indices are
  `{1, N} ∪ {i : i mod labelStep = 0}` (`layout.ts:307`); segment boundaries are
  `boundaryX(fromMachine − 1)` and `boundaryX(toMachine)` (`:234-235`). Nothing
  makes a boundary a multiple of `labelStep`, so r2's ticks would **not** mark the
  spans the axis exists to make legible.
- **A boundary tick and its label are `pitch/2` apart.** At N = 20 (pitch 45) each
  number would sit 22.5px from its own tick and 22.5px from the next —
  attributable to neither. Today the filled `pitch−2` rect is what binds a
  mid-cell number to its machine; deleting it while keeping both endpoints of that
  offset strands the label. **This defect is specific to low N** — at N = 106 the
  offset is 4px against 24px spacing.

**Major-tick source: `significant` in both modes.** `significantMachines`
(`layout.ts:114-169`) is a pure set-union over existing solve data — feed entries,
output breakouts, every segment's bounds, finding-referenced machines — but it is
currently computed only when `band` (`:289-291`). r3 computes it unconditionally
and uses it for major ticks in both modes. No new solver math; the gate simply
lifts.

| | major ticks | minor ticks + labels |
|---|---|---|
| non-band (N ≤ 114) | `significant` | machines where `m.labeled` |
| band (N > 114) | `significant` | `labeledSignificant` |

At N = 20, `labelStep = 1` so every machine gets a minor tick and a number, with
major ticks only at real boundaries — dense but correctly attributed. At N = 106,
37 numbers with minor ticks, plus major ticks at the solver's boundaries.

**Label baseline:** `axisTop + 12 + labelGap`, *not* the current `top + 52`
(`Schematic.tsx:403`, `:528`), which is `machineH + 12` in disguise and at a 12px
rule would drop labels onto the output bus.

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

`computeLayout` gains a machine-row height **with a default**:

```ts
computeLayout(result, machineCount, machineRowH = LAYOUT.machineH)
```

The default is not optional politeness: **23 call sites exist** and a required
third parameter breaks the typecheck at every one of them
(`layout.test.ts` ×17, `smoke.test.tsx` ×3, `coincident-feed-marks.test.tsx:227`,
`Schematic.tsx:421`).

x geometry (`pitch`, `machines[]`, every `x1`/`x2` via `boundaryX`) is independent
of it and is **identical in both views** — that is what keeps the two drawings in
register.

**Consequences, corrected from r2.** `machineTop` does **not** shift —
`layout.ts:314-315` is `marginY + feeds·laneH + busH` with **no `machineH` term**.
Only `outputTop` (`:316`) and `height` (`:321-326`) carry it, each with
coefficient 1, so each drops by exactly 28.

That is better than r2 claimed: **the feed lanes and the axis top are
pixel-identical between the two views**, which is the register guarantee the split
needs. The output lanes and their breakout arrows move **up 28px**; r1's
"output breakouts are pixel-unchanged" criterion was unachievable and stays
withdrawn.

*(r2's Changes item instructed `machineTop` to "derive from" the parameter. That
would introduce a dependency that must not exist and would break
`layout.test.ts:71-75`, which pins `machineTop` symbolically without `machineH`.)*

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
| `smoke.test.tsx:456-498` | output lane name y, pinned as the **literal 194** at `:472` | **stays in `<Schematic>`, pin re-derived to 166** |

**The fifth is the one r2 missed, and it is not a relocation.** It breaks for the
*y-shift* reason: at `machineRowH = 12`, `outputTop = 140`, `busY = 148`, name
y = **166**, not 194. It has no home in `<Machines>`, which renders no lanes. Its
seam-clearance margin must be restated against the new geometry, and the stale
"machine row … 40" comment at `:459` goes with it.

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
4. `computeLayout(result, N, 12)` and `(result, N, 40)` produce identical `pitch`,
   `machines[].x`, `machineTop` and every segment `x1`/`x2` — the register pin.
   *(Not renderable as a two-view DOM comparison: the machines view emits no belt
   segments.)*

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
| Bus geometry is machine-indexed, so the axis must stay | **Verified** — `layout.ts:77-85`; one shared boundary grid via `boundaryX` (`:214-216`, `:229`, `:234-235`, `:243`) and the equivalent inline arithmetic at `:306` (which does not call it) |
| N = 106 is **not** band mode | **Verified by arithmetic** — `912/106 = 8.60` ≮ 8 (`layout.ts:100-102`); corroborated by the screenshot's every-3rd labels matching `labelStep(106) = 3` |
| The non-band path has no ticks | **Verified** — `Schematic.tsx:516-537` emits `<rect>` + conditional `<text>` only |
| The 40px is layout, not CSS | **Verified** — `layout.ts:321-326`; `.schematic` has no height (`app.css:684-692`) |
| The `40` literal is duplicated in four places | **Verified** — `Schematic.tsx:382`, `:393`, `:522`, `:553` |
| **Five** smoke tests break | **Verified, corrected** — `:204`, `:330-332`, `:371-375`, `:446-448` (relocation) plus `:456-498` (y-shift, pinned literal 194 → 166). r2 said four and marked it Verified |
| r1's leak tripwire cannot fire | **Verified** — `layout.test.ts:49-59` derives its expectation from `LAYOUT.machineH` |
| Adding a view touches five `App.tsx` sites, none in the store | **Verified** — `:66`, `:158`, `:429-446`, `:447-469`, plus the import |
| Stage 15 thinning applies to band mode only | **Verified** — `labeledSignificantOf` called only when `band` (`layout.ts:292-295`) |
| A 12px tick ruler reads better than a 40px filled row | **Judgement, not measurement.** The functional claim — a rule with ticks cannot smear the way 106 adjacent filled rects do — is the reason; whether it *communicates* is Michael's call, and #138 is where the block's own legibility is decided |
