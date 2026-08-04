# Stage 4 / Phase 1 brainstorm — the layout engine (ticket #20, epic #13)

Date: 2026-08-04
Status: v3 FROZEN — correctness converged (r2); simplify dispositioned
Inputs: live `src/core/manifold.ts` (the full solver contract:
StageInput/StageSolveResult, FeedBelt.entersAfterMachine,
BreakoutBelt.startsAfterMachine, BusSegment spans), `src/data/types.ts`
(CatalogRecipe.machineId + Catalog.machines), the epic #13 research
grounding (official-wiki dims, seed table on the epic), eslint.config core
purity scoping, the Stage 1–3 model-then-surface precedent.

## Already settled — do NOT re-litigate

1. Sequential directive + auto-greenlit gates; all-Claude roster; opus
   implementer.
2. Geometry lives OUTSIDE `src/core/` (epic acceptance pin) — core solver
   semantics untouched.
3. Footprint source authority: the official wiki (satisfactory.wiki.gg);
   dims are NOT in Docs.json; seed values grounded at pickup (epic
   §Decisions): Smelter 5×10, Constructor 7.9×9.9, Assembler 9×16,
   Foundry 10×9, Conveyor Splitter 4×4, Foundation tile 8×8.
4. Rendering is Phase 2; this phase produces data only.
5. Testing posture: node env, table-driven, bidirectionality log.

## Axis 1 — Package: `src/layout/`, core-grade purity, own lint scope

- New top-level `src/layout/` — pure TS, no React/DOM, imports allowed
  from `src/core/` (Fraction, solver types) and `src/data/types.ts`
  (Catalog types) only. The eslint purity enforcement gains a SIBLING
  block scoped `src/layout/**` (r1 fold — NOT "same rules"): the
  package-import ban, dynamic-import ban, and globals rules carry over
  unchanged, but the layer-escape regex is layout's OWN —
  `^\.\./(\.\./)*(state|ui)(/|$)` — banning state/ui while ALLOWING
  `../data` (the core block's regex also bans data, which layout
  legitimately imports for Catalog types). UI may import layout; layout
  may never import UI/state.
- Rationale: the engine is exactly the schematic-side `src/ui/layout.ts`
  precedent (pure module carrying render-contract weight) promoted to a
  package, because this one owns game-data (footprints) and a real
  algorithm, not view math.

## Axis 2 — Units: integer DECIMETERS end to end

- All geometry is integers in decimeters (`dm`): Constructor = 79×99,
  Foundation tile = 80×80, Splitter = 40×40. Every wiki dim is a
  multiple of 0.1 m, so decimeters lose nothing; integer arithmetic is
  EXACT with plain `number` (safe far beyond any factory size) — the
  repo's exactness ethos without dragging `Fraction` into geometry
  (Fractions stay what they are: flow rates). The LayoutResult carries
  `units: "dm"`; P2 divides by 10 only at the SVG boundary.
- Footprints store the wiki dims verbatim (7.9 m → 79 dm) — no rounding
  policy needed at the data layer. The ALGORITHM aligns placements to
  the 10 dm (1 m) build grid: machine origins snap up to whole meters
  (`ceilTo(10)`), matching in-game build-grid snapping without
  falsifying any building's true size.

## Axis 3 — Footprint table: curated, machineId-keyed, cited, fallback

- `src/layout/footprints.ts`: `Record<string, Footprint>` keyed by the
  catalog's `machineId` (the Docs.json-derived machine id — the same key
  `CatalogRecipe.machineId` carries), value `{width, length}` in dm.
  **Provenance lives in the file-HEADER citation block** (building →
  dims → wiki.gg URL; simplify fold — the in-header pattern manifold.ts
  and ui/layout.ts already use; the runtime never reads a source field).
  Seed = the producer buildings reachable from the bundled catalog
  (enumerated at implementation from the machines map; each cited in the
  header from its wiki.gg infobox).
- **Unknown machineId → a stated DEFAULT footprint (100×100 dm) + a
  `layout finding`** (`unknown-footprint`, carrying the machineId) — the
  layout never refuses to draw; it draws honestly-approximate and says
  so. This mirrors the solver's findings-not-exceptions posture.
- Splitter (40×40) and merger (40×40) are constants in the same file,
  same citation discipline. Belt width convention: 20 dm visual lane
  width (a RENDER convention, recorded as such — belts have no
  gameplay footprint).

## Axis 4 — The algorithm: fixed manifold convention, computed placement

The engine lays out ONE stage in the canonical in-game manifold shape.
What is FIXED (convention, not computed): machines in a single row,
side-by-side along +x at a uniform PITCH of `ceilTo10(width) + 10` (r1
fold — the invariant is the pitch and the grid-aligned origins, NOT a
footprint gap: a sub-metre width like the Constructor's 79 leaves
pitch − width = 11 dm between footprints; tests assert pitch/origins,
never a fixed gap); feed bus
lanes run in FRONT of the row (−y side), one lane per feed
(`FeedLaneResult` order, nearest lane closest to the machines); output
collection lanes run BEHIND (+y), one per output lane; a splitter sits
on each feed lane once per machine column; a merger on each output lane
once per machine column. What is COMPUTED from inputs: every rectangle
and polyline position.

`layoutStage(solve: StageSolveResult, machineId: string, machineCount:
number, footprints) → StageLayout`:

1. **Machine row**: N copies of the footprint at
   `x_i = i × (ceilTo10(width) + 10)`, `y = 0` — origins on the metre
   grid (Axis 2), true-size rectangles. `machineDepth` below =
   `footprint.length` (one machine type per stage, so one depth; r1
   nit).
2. **Feed lanes** (index f, front): a bus polyline along y =
   `−(20 + f × 60)` dm spanning the row; per machine column a 40×40
   splitter centred on the lane at that column's x-centre (lane-0
   junctions ABUT the machine row face with zero clearance — accepted
   v1 convention, in-game junctions may abut; r1 nit states intent);
   **belt-drop markers** at each `FeedBelt.entersAfterMachine` boundary
   (the fresh belt joining the manifold — position = the gap after that
   machine index, or the row head for 0), carrying the belt index +
   capacity so P2 can label them. **Coincident marks are legal (r1
   fold): the solver clamps entersAfterMachine to N and two belts CAN
   share a boundary (manifold's empty-span case) — the layout emits one
   mark per belt, distinct indices, same point; P2 owns overlap
   rendering.**
3. **Output lanes** (index o, back): mirrored at `y = machineDepth +
   20 + o × 60`; mergers per column; **break-out markers** at each
   `BreakoutBelt.startsAfterMachine` boundary with index + capacity +
   load.
4. **Foundations**: the bounding box of everything, inflated to the
   next 80 dm multiple in both axes, emitted as `{cols, rows, origin}`
   (an 8 m-tile count P2 draws as the floor grid).
5. **Zero-machine stage (r1 fold — the shape is pinned)**: `machines:
   []`; every lane present with a ZERO-LENGTH bus (`from == to` at the
   row origin), `junctions: []`, `marks: []` (the degenerate solve has
   no belts); `foundations: {origin: (0,0), cols: 0, rows: 0}` — the
   bounding-box-of-nothing is the zero-tile grid, drawn as nothing.
6. **Findings pass-through**: layout emits only its own findings
   (`unknown-footprint`); solver findings stay on the solve — P2
   already renders those elsewhere. Pipes: same geometry as belts this
   phase (lanes/junction boxes) — a pipes-look-different affordance is
   Stage-5 polish material, recorded.

## Axis 5 — The LayoutResult contract (what P2 renders, no math)

```ts
interface StageLayout {
  units: "dm";
  machines: Rect[];                    // one per machine, true size
  feedLanes: LaneLayout[];             // order = solve.feeds
  outputLanes: LaneLayout[];           // order = solve.outputs
  foundations: { origin: Point; cols: number; rows: number };
  findings: LayoutFinding[];           // unknown-footprint only (v1)
}
type LayoutFinding = { type: "unknown-footprint"; machineId: string };
// LaneLayout deliberately omits the solver's `kind` (r1 nit): P2 holds
// the solve and reads feeds[f].kind / outputs[o].kind directly.
interface LaneLayout {
  itemId: string;
  bus: { from: Point; to: Point };     // straight lane this phase
  junctions: Rect[];                   // splitters (feed) / mergers (output)
  marks: BeltMark[];                   // drops (feed) / breakouts (output)
}
interface BeltMark { index: number; at: Point; capacity: Fraction;
                     load?: Fraction }  // load: breakouts only
```

Rect/Point are `{x, y, w, h}` / `{x, y}` integers (dm). Fractions appear
ONLY as passed-through labels (capacity/load) — never in geometry math.

## Axis 6 — Testing posture

- `layout.test.ts` — table-driven: row PITCH + grid-aligned origins
  (incl. a sub-metre width proving pitch − width > 10 is legal; r1
  fold), lane y-positions for 1..3 feeds/outputs, splitter count = N
  per lane, drop marks exactly at entersAfterMachine boundaries (incl.
  head-entry 0 AND the coincident two-belts-one-boundary case; r1
  fold), breakout marks at startsAfterMachine, foundation inflation to
  80 dm multiples (exact boundary + one-dm-over cases),
  unknown-machineId → default footprint + finding, zero-machine stage →
  the pinned empty shape (zero-length buses, 0×0 foundations).
- Footprint data rows live IN `layout.test.ts` (simplify fold — no
  separate file): splitter/merger constants pinned; the
  literal-data-integrity rows (positive-integer dims, per-entry URLs)
  are dropped as type-system/tautology territory.
- Store/UI: NOTHING this phase (no store field, no component — the
  engine is dead code until P2 wires it; acceptable for one phase by
  the Stage-1 precedent of core landing before UI).
- Bidirectionality log per family (row placement, lane geometry, marks,
  foundations, fallback).

## Assumptions ledger

1. Solver contract shapes as read this session (manifold.ts:15-99) —
   grounded.
2. `CatalogRecipe.machineId` + `Catalog.machines` exist and key every
   recipe (types.ts:22-31, 39-44; r1 citation fix) — grounded.
3. Wiki dims are exact multiples of 0.1 m (all fetched values are) —
   grounded on the seed set; the implementation re-checks per entry as
   it cites each building.
4. Integer dm arithmetic stays within Number.MAX_SAFE_INTEGER for any
   real factory (N ≤ 10^4 machines × ~10^2 dm each) — trivially true.
5. The stage's machineId comes from the selected recipe
   (`catalog.recipes[recipeId].machineId`) at the call site (state/UI
   in P2); the engine takes it as an argument and stays
   catalog-agnostic beyond the footprint table.

## Revision history

- **r1 correctness (2026-08-04):** code-reviewer APPROVED_WITH_NITS (1
  citation fix + 3 NIT); adversarial NEEDS_REWORK (2 MEDIUM + 2 MINOR +
  1 NIT). Folded in v2:
  1. **Pitch, not gap** (adversarial MEDIUM): the row invariant is
     pitch = ceilTo10(width)+10 with grid origins; the footprint gap is
     pitch − width (11 for the Constructor) — tests assert pitch/origins.
  2. **Layout lint block precision** (adversarial MEDIUM): package/
     dynamic-import/globals rules carry over; the layer-escape regex is
     layout's own (state|ui banned, data ALLOWED).
  3. **Coincident marks legal** (adversarial MINOR): one mark per belt,
     same point possible (clamp-to-N / empty-span case); test row added.
  4. **Zero-machine shape pinned** (adversarial MINOR): empty machines,
     zero-length buses, 0×0 foundations.
  5. **Junction-abuts-row intent stated** (adversarial NIT); citation
     range fixed, machineDepth named, LayoutFinding shape pinned,
     LaneLayout kind-omission note (code-reviewer).
  Refuted-and-held r1: boundary-mark semantics match the solver + the
  ui/layout.ts precedent (no off-by-one); machineId keying stable with
  fallback covering catalog drift; adjacent-lane junction spacing
  collision-free; contract completeness = honest P2 scoping.
- **Simplify pass (2026-08-04, one-shot): APPROVED_WITH_NITS (3 NIT).**
  Dispositions:
  1. REJECTED with rationale — `junctions` STAY in the LaneLayout
     contract: the placement convention needs exactly one home (the
     tested engine) and P2 stays math-free per the design's pinned
     "P2 renders, no math" ethos; deriving in P2 would split the
     algorithm across layers and un-test the convention.
  2. FOLDED — per-entry `source` URLs replaced by the file-header
     citation block (the codebase's own in-header precedent; runtime
     never reads provenance).
  3. FOLDED — no separate footprints.test.ts; constant-pins fold into
     layout.test.ts, literal-integrity rows dropped.
  Affirmed already-simple: decimeter units (the SMALLER exact shape),
  foundations-as-tile-counts (a Rect would push math into P2), the
  layout lint block (correctness-mandated), LaneLayout granularity.
  Folds 2–3 remove non-load-bearing ceremony only (no verified
  invariant touched) — classified prose-equivalent, no correctness
  re-run; the one contract-shape question (junctions) was resolved by
  REJECTION, leaving the converged contract unchanged.
- **v3 FROZEN (2026-08-04).**
