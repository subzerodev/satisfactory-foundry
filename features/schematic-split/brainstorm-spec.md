# #135 — Split the schematic (Stage 23)

**Ticket:** #135 · **Epic:** #136 · **Milestone:** 94 · **Tier:** 2
**Status:** design r1

## Purpose

Michael: *"this diagram needs rethought i dont understand what its saying from
the layout of it."* The schematic answers three questions at once — where the
belts run, which stretches are over capacity, and how 106 machines are arranged —
and the third fights the first two for space, arriving as a grey smear with a
colliding number strip.

## Settled — do NOT re-litigate

From Michael, 2026-08-17 (#135 comment 24630):

> **The schematic splits into separate views.** The bus/feed drawing answers
> **how to physically build it** *and* **what is over capacity** — those belong
> together, because where a belt runs and whether that stretch needs doubling are
> the same question at the same place. **The 106-machine block becomes its own
> view.**

Carried constraints from epic #136:

- **Presentation only.** The solver, the saturation model and #120's
  parallel-line semantics are unchanged — only how they are drawn.
- Stage 13/14 already removed a view and had to restore it, because a mislabelled
  toggle made the user ask for the wrong deletion (`docs/master-plan.md:211-252`).
  **Nothing is deleted here** — the machine block moves, it does not go away.

## The fact that shapes the design

**The bus rows are spatially indexed by the machine axis.** `LaneTrack.segments`
carries both machine ordinals *and* pixel positions derived from them
(`ui/layout.ts:76-85`: `fromMachine`, `toMachine`, `x1`, `x2`), and every x in the
drawing comes from `computeLayout`'s single machine axis (`:275-340`).

So "move the machine block out" cannot mean "remove the machine axis". A belt
segment spanning x=120..300 *means* "machines 12 through 45"; without an index
reference on that axis the build-guide drawing stops being a build guide, which
would defeat the half of the decision that says it answers **how to physically
build it**.

The split therefore is:

- the **grey band rect and its `×106` count** move to the new view — they are the
  "how are the machines arranged" answer;
- the **ticks and index labels stay** in the bus view as a machine-axis ruler —
  they are the reference that makes belt spans legible. They are already
  decluttered by Stage 15's greedy label thinning (`layout.ts:190-211`), so they
  are the cheap, readable part.

## Design

### 1. A third view

`type View = "schematic" | "blueprint"` (`ui/App.tsx:66`) gains `"machines"`.
Blast radius is five sites, all in `App.tsx`, and view state is component-local
(`:158`) — no store change:

| Site | Change |
|---|---|
| `:66` | widen the union |
| `:158` | default stays `"schematic"` |
| `:429-446` | third tab button, after BLUEPRINT |
| `:447-469` | third conditional arm |
| `app.css` `.view-tab` | already scales to N buttons |

### 2. `MachineBand` splits by role

`Schematic.tsx:356-411` currently draws four things. They divide cleanly:

| Element | Lines | Goes to |
|---|---|---|
| grey `<rect>` band | `:382` | machines view |
| `×N` count text | `:383-385` | machines view |
| boundary ticks at significant indices | `:393` | **stays** (the ruler) |
| index labels at thinned indices | `:399-405` | **stays** (the ruler) |

Extract a `MachineAxis` component carrying the ticks + labels, used by the
schematic. The machines view renders the band and the count.

The non-band path (`Schematic.tsx:516-537`, N ≤ 114 per `bandMode`,
`layout.ts:100-102`) splits the same way: per-machine rects move to the machines
view; ticks and labels stay as the ruler.

### 3. The machines view

Renders the machine row with the full drawing width to itself, reusing
`computeLayout`'s existing geometry — the same `machines[]` positions, the same
`significant`/`labeledSignificant` sets, the same band/non-band rule. **No new
layout math.**

**Deliberately NOT redesigned in this ticket.** Michael's decision settles that
the block gets its own view; it does not say what the block should *become*. At
106 machines in a single row, more space alone will not make it communicate —
wrapping into a grid, or replacing it with a per-segment table, is a different
design act and needs his call. Filed as a follow-on rather than guessed at here.

## Changes

1. `ui/App.tsx` — third view (five sites above).
2. `ui/Schematic.tsx` — extract `MachineAxis` (ticks + labels) from `MachineBand`;
   the schematic renders the axis, not the band. Same split on the non-band path.
3. `ui/Machines.tsx` (new) — the machines view: band or per-machine rects, plus
   the count.
4. `ui/app.css` — height for the schematic once the 40px band leaves it; styles
   for the new view.
5. Tests — below.

## Acceptance criteria

- Three tabs; SCHEMATIC is still first and default (Stage 14's restoration).
- The schematic keeps its machine-index ruler: every significant index keeps a
  tick, and the Stage 15 label thinning is unchanged — **no new label collisions**.
- The schematic no longer draws the grey band or the `×N` count.
- The machines view shows every machine the schematic used to, with the same
  indices, at the same band/non-band threshold.
- Belt segments, `x2` parallel marks, seams, feed entry marks and output breakouts
  are pixel-unchanged in the schematic apart from the vertical space the band
  vacates.
- Nothing is deleted: no view, no data, no solver output.
- `npm test`, `npm run check`, `npm run build` green; both browser matrices green.
- **Bidirectionality:** every new test fails with its production code reverted,
  captured in `features/schematic-split/r2-verification.log`.

## Out of scope

- **Redesigning the machine block** — see above; follow-on ticket.
- The solver, the saturation model, #120's parallel-line semantics.
- The Blueprint view.
- The number strip's *meaning* (1-based machine ordinals, Stage 16 #85) — it moves
  intact.

## Assumptions ledger

| Assumption | Grounding |
|---|---|
| Bus geometry is machine-indexed, so the axis must stay | **Verified** — `layout.ts:76-85` (`fromMachine`/`toMachine` alongside `x1`/`x2`); all x from `computeLayout` `:275-340` |
| Adding a view touches five sites, none in the store | **Verified** — `App.tsx:66`, `:158`, `:429-446`, `:447-469`; view state is `useState` at `:158` |
| `MachineBand` divides cleanly into band vs ruler | **Verified** — `Schematic.tsx:382` (rect), `:383-385` (count), `:393` (ticks), `:399-405` (labels) are separate elements in one `<g>` |
| Band mode is a pure function of N and needs no change | **Verified** — `layout.ts:100-102`, `bandMode(N)` = `USABLE/N < minPitch`, N > 114 |
| Label thinning survives the move untouched | **Verified** — `layout.ts:190-211` operates on `significant`, which the ruler keeps in full |
| No snapshot tests to churn | **Verified via map, spot-checked** — `smoke.test.tsx`, `layout.test.ts`, `parallel-feed-belts.test.tsx`, `coincident-feed-marks.test.tsx` assert structure, not snapshots. `layout.test.ts` is pure math and should not need to change — if it does, the split has leaked into layout, which it should not |
| More space alone will not fix the 106-machine block | **Judgement, not measurement** — stated as the reason for scoping the redesign out, not as a finding |
