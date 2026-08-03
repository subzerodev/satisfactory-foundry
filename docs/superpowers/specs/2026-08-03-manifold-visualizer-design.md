# Satisfactory Foundry — v1 manifold visualizer design

Date: 2026-08-03
Status: approved (brainstormed with Michael, section-by-section)

## Purpose

Satisfactory Foundry is a fresh, minimal replacement for `satisfactory-planner`
(which accumulated too many features to remain usable) and, eventually, for the
third-party Satisfactory Modeler. Features are added one at a time, each in its
correct architectural place.

**v1 answers exactly one question the existing tools don't:** for a production
stage (one recipe run on N machines), how many belts/pipes must feed the
manifold, *where along the manifold each one must enter*, and where the output
side saturates and must break out to a fresh belt.

## Decisions made during brainstorming

| Decision | Choice |
|---|---|
| Input model | Pick recipe + machine count from parsed `Docs.json` (no hand-typed rates) |
| Detail level | Logical schematic (machine indices), designed so a physical-layout layer can be added later; no geometry in core |
| Belt selection | User declares unlocked tiers; tool computes fewest belts / best combination; per-belt manual override |
| Fluids | Pipes in v1 — same math as belts, different capacity table; headlift/pumps out of scope |
| v1 unit of work | One manifold stage at a time; chaining stages is a later feature the data model must not block |
| Clock speed | Per-stage clock % (rates scale linearly); uniform across the stage |
| Arithmetic | Exact rational arithmetic (`Fraction` type) in core — no floats in solver math |
| Stack | React + TypeScript + Vite; Zustand for state; SVG schematic in v1; React Flow planned for the future graph editor |

Stack rationale: the core is pure TS with zero framework imports, so the UI
framework is a swappable skin. React was chosen over Svelte/Solid because the
project's endgame (superseding the Modeler) is a node-graph editor, and React
Flow (xyflow) is the most mature open-source flow library; React is also the
framework LLM agents write most reliably, which matters for the agent-led
workflow.

## Non-goals for v1

Chained stages, physical layout/geometry, plan save/load, modeler/planner
import, alternate-recipe recommendations, AWESOME sink, trains/drones/trucks,
power calculations, somersloop amplification, per-machine underclock balancing.
Each is a later feature; none may be structurally blocked by v1.

## Architecture

```
src/core/   pure TS math — Fraction type, manifold solver. No React, no DOM,
            no IndexedDB. Fully unit-tested.
src/data/   Docs.json parser + catalog (recipes, machines, belt/pipe tiers).
            Ported from satisfactory-planner's proven parser, trimmed to what
            v1 reads. Parsed catalog cached in IndexedDB (re-upload only after
            game patches).
src/state/  one Zustand store: selection (recipe, machine count, clock %,
            unlocked tiers, overrides) + derived solve result. Unlocked tiers
            persisted to localStorage. No document persistence in v1.
src/ui/     React components: upload screen (first boot), recipe picker,
            stage controls, SVG schematic, warnings panel.
```

User flow: first boot → upload `Docs.json` → pick recipe → set machine count +
clock % → schematic renders; every control change recomputes live.

## Core math (the manifold solver)

All per **lane**: one lane per input item, one per output item of the recipe.
Belts and pipes share the math; only the capacity table differs (belt tiers
e.g. 60/120/270/480/780/1200, pipes 300/600 — capacities come from the
catalog, never hardcoded). All arithmetic is exact rational (`Fraction`).

### Feed side (per input item)

1. Per-machine rate `d` = recipe rate × clock %. Total demand `D = N × d`.
2. Bus capacity `B` = highest unlocked tier (the manifold bus can never carry
   more than `B` past any single point).
3. Feed count `k = ceil(D / B)`.
4. Combination: `k − 1` belts of the top tier + the smallest unlocked tier
   whose capacity ≥ the remainder (e.g. 600/min with Mk4 unlocked → Mk4 480 +
   Mk2 120). Any individual belt overridable by the user afterwards.
5. Entry points: belt `j` (cumulative prior capacity `S = Σ capacities of
   belts 1..j−1`) enters between machine `floor(S/d)` and the next machine;
   belt 1 enters at the head. Exact-boundary case (`S/d` integral): belt
   enters immediately after machine `S/d`.
6. Validation: solver computes the actual steady-state flow on every bus
   segment. Overrides or odd combinations that exceed bus capacity on a
   segment or starve machines produce findings naming the exact machines and
   shortfall amounts. Never silently render a broken manifold.

### Output side (per output item, byproducts included)

Mirror image: each machine emits `p × clock %`; the collection bus (tier `T` =
highest unlocked) fills as it passes machines and must break out after machine
`floor(T/p)`; a fresh belt starts there. Belt count = `ceil(N × p / T)`. Each
break-out belt is assigned the smallest unlocked tier ≥ its segment's load.

### Validation and edge cases

- **Single machine outdemands the top belt** (e.g. overclocked past the best
  tier): no manifold works — report infeasibility with the numbers
  ("machine demand 812/min exceeds Mk4 480/min"), draw nothing misleading.
- **Manual override breaks the manifold**: recompute flows, report exactly
  which machines starve and by how much.
- **Degenerate inputs**: 0 machines, no-solid-input recipes (extractors),
  fluid-only recipes — empty lanes render empty; no crashes.
- **Docs.json quirks**: unparseable/patched files fail with a clear message at
  upload time, never at solve time.

## UI

Approved via inline mockup (20 Smelters / Iron Ingot / Mk4 unlocked example):

- **Controls strip**: recipe select, machine count, clock %, unlocked-tier
  toggles (belts + pipes).
- **Summary cards**: per item — total rate in/out and belt/pipe count.
- **Schematic (SVG)**: machines as a numbered row; feed belts arrive from
  above with entry-point arrows ("Feed 2 — Mk2 · 120/min · enters after
  machine 16"); the bus is colored by which feed belt supplies each segment
  (per-machine splitter ticks inherit the color); output side mirrors below
  with break-out arrows; dashed seam lines mark segment boundaries. One feed
  lane per input item stacked above; one output lane per output item below.
  Hovering a bus segment shows its exact flow. Warnings render as a findings
  panel plus in-schematic highlights.
- Belt tier → color mapping is consistent across the app, with a legend.
- Large machine counts: the row compresses (thinner boxes, label every Nth
  machine); no horizontal scrolling in v1 unless compression bottoms out.

## Testing

The solver is pure functions over `Fraction`, tested table-driven with Vitest:

- the 20-smelter worked example (hand-verified entry/break-out points);
- fractional rates (37.5/min-class recipes) where float math would misplace
  entry points;
- exact-multiple boundaries (demand an exact multiple of belt capacity);
- validation cases (starvation reporting, infeasible single-machine demand,
  degenerate inputs).

UI stays thin; solver tests carry the correctness weight. No browser
automation in v1.

## Growth path (designed-for, not built)

- **Chained stages**: a graph of stage objects (React Flow); one stage's
  output belts become the next stage's feeds.
- **Physical layout layer**: consumes the same solve result, adds geometry
  (machine footprints, splitter placement, foundation tiles).
- **Plan save/load**: serialize the store.
- **Modeler/planner import**: map their chains onto stage objects.

Nothing in v1 may structurally block any of these.
