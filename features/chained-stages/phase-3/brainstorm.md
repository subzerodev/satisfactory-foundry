# Stage 3 / Phase 3 brainstorm — plans carry the graph (ticket #18, epic #12)

Date: 2026-08-04
Status: v4 FROZEN — correctness converged (r2); simplify dispositioned
Inputs: live `src/data/plan-store.ts` (PlanFileV1 + isPlanFileV1 pins, id-keyed
rows), `src/state/store.ts` (plan-op chain, savePlanAs/loadPlan bodies, stages/
links/positions/placementSeq post-P2), frozen P1/P2 brainstorms, Stage-2
brainstorm decisions on the ticket #11 trail.

## Already settled — do NOT re-litigate

1. Sequential directive + auto-greenlit gates; all-Claude roster; opus
   implementer.
2. PlanFileV1 pins (Stage 2, frozen): `format_version: 1`, `stages` an array
   from day one (exactly one entry serialized), `links: never[]` — a populated
   `links` in a v1 file ⇒ corrupt. The file header comment says the quiet part:
   "Stage 3 adds nodes/edges without a format break (`format_version` bumps)".
3. loadPlan PRESERVES current global tiers (P1 r3 supersession) — plan files
   still carry per-stage `selection.unlockedTiers` (frozen v1 shape); they are
   not read back.
4. The plan-op promise chain (total ops, catch-into-planError inside the body,
   fresh list read inside the body); name identity (trimmed, non-empty,
   case-sensitive, unique); rows keyed by `id` (uuid), name in the payload.
5. The #5 re-upload treatment (every stage: recipeId re-validated against the
   catalog, overrides cleared on invalidation) — the established semantics for
   "state meets a catalog it wasn't built against".
6. P1: dangling links kept + flagged, never auto-pruned; cycles allowed.
7. P2: positions are session-state; **persisting them is THIS phase's
   decision**. placementSeq monotonic, never reused. Stage ids are runtime
   `crypto.randomUUID()` values.
8. Testing posture: node env, no jsdom; store rows + pure-module rows;
   bidirectionality log.

## Axis 1 — Format identity: `PlanFileV2`, honest stamp, v1 accepted on read

- **Save always writes `format_version: 2`.** The v2 payload is the whole
  graph (Axis 2). Bumping is the Stage-2 design's own stated plan (the "format
  break" comment), and it is honest: a v1-era validator structurally REJECTS
  populated links, so pretending a multi-stage file is "still v1" would stamp
  a lie into every file.
- **Read accepts both.** `loadPlanFile` validates v2 first (`isPlanFileV2`),
  else falls back to `isPlanFileV1` → **migrates in memory** (pure function
  `migrateV1(plan): PlanFileV2` — one stage, `links: []`, no positions →
  auto-slot on load; `createdAt`/`updatedAt` carried VERBATIM, r1 fold — the
  save-over path reads the prior file for createdAt, so a migrated row must
  not reset its creation time). The stage name is SYNTHESIZED as "Stage 1"
  (r1 fold: v1 stage entries are `{selection}` only — there is no persisted
  name to drop). Migration is read-side only; the stored row is untouched
  until the next save-over (which writes v2). No bulk rewrite,
  no IDB migration — the `plans` store schema (id-keyed JSON rows) is
  unchanged, so **no DB_VERSION bump**.
- An unknown/newer `format_version` stays "corrupt-class" (existing posture:
  fails validation → planError, nothing loaded, nothing destroyed).

## Axis 2 — The v2 payload: id-free, order-carrying, positions included

```jsonc
{
  "format_version": 2,
  "name": "…", "createdAt": "…", "updatedAt": "…",
  "stages": [                      // array order IS stageOrder
    { "name": "Smelting",
      "selection": { …Selection, unlockedTiers stored-not-read… },
      "position": { "x": 40, "y": 40 } },
    …
  ],
  "links": [                       // stage references are ARRAY INDICES
    { "from": 0, "to": 1, "itemId": "Desc_OreIron_C" }
  ]
}
```

- **Stage ids do not serialize.** Runtime ids are ephemeral uuids regenerated
  on every load; the file references stages by **array index** — stable,
  id-free, and immune to uuid collisions across saves/devices. `stageOrder`
  is implicit in array order (no separate field to drift).
- **Positions persist** (resolving the P2 deferral): one `{x,y}` per stage
  entry, keyed by co-location rather than id. Rationale: the canvas layout is
  user work product exactly like a belt override; losing it on every load
  would make the canvas feel amnesiac. Cost: two numbers per stage. On load,
  a stage entry **without** `position` (v1-migrated files) gets the standard
  auto-slot for its index.
- **Stage `name` persists** (it exists only in runtime state today; a plan
  that forgot names would round-trip lossy).
- `placementSeq` does **not** serialize: on load it re-seeds to
  `stages.length` (the next fresh slot; slots 0..n-1 are notionally consumed
  whether or not the file's positions still sit on them — monotonicity is the
  only invariant that matters, frozen P2).

## Axis 3 — Validation: structural invariants are corrupt-class

`isPlanFileV2` pins, in the spirit of the v1 validator's strictness:

- `format_version === 2`; name/createdAt/updatedAt strings; `stages` array
  with ≥1 entry, each `{name: string, selection: Selection-shape, position?:
  {x,y} numbers}` (position optional — v1-migrated saves always write it, but
  optional keeps the validator honest about what load actually requires);
- `links` array (may be empty), each `{from, to, itemId}` with `from`/`to`
  **integer indices in range**, `from !== to` (self-link), and no duplicate
  `(to, itemId)` pair — the frozen P1 refusal invariants enforced at the file
  boundary. A file violating them is **corrupt** (planError, load refused),
  matching the v1 "populated links ⇒ corrupt" precedent: we never load a
  graph the runtime could not have produced. **These pins are the SOLE
  guard (simplify fold): the load rebuild constructs link records directly
  from indices — it never routes through `addLink`, so the validator is
  the only place the self/duplicate invariants hold at load. Do not
  "simplify" them away.**
- Note: a link's `itemId` NOT matching the current catalog is *not* corrupt —
  that is the dangling-link case (Axis 4), a catalog-relative condition, not
  a file-structural one.

## Axis 4 — Load semantics: whole-graph replacement, frozen treatments intact

`loadPlan(id)` (inside the existing op chain, same total-op discipline):

1. Fetch + validate (Axis 1/3). Failure → planError, state untouched.
2. Build the graph: fresh uuid per stage entry; `stages` map with
   `{id, name, selection, solve: idle}` (solve seeded idle, overwritten by
   step 5's derive — r1 nit); **per stage, the frozen machineCount
   null→NaN coercion applies** (r1 fold, both reviewers:
   `JSON.stringify(NaN)` emits null, so a saved-invalid stage must load
   rendered-invalid — exactly store.ts's current single-stage coercion,
   now per entry); `stageOrder` = array order; `links` rebuilt from
   indices → fresh link uuids; `positions` from file entries (missing →
   auto-slot by index); `placementSeq = stages.length`;
   `activeStageId` = first stage (deterministic, matches removeStage's
   cursor-to-first posture).
3. **Tiers: the CURRENT global unlockedTiers are stamped over every loaded
   stage's selection** (the frozen P1 supersession, now applied per-stage —
   the file's stored tiers are dead weight by design).
4. **recipeId re-validation against the current catalog, overrides
   VERBATIM** (r1 fold — the adversarial caught a mislabel): per stage, a
   recipeId absent from the catalog → null. Overrides are applied
   verbatim, matching the CURRENT load path's explicit posture
   ("Overrides apply verbatim; malformed strings / count excess surface
   through the existing derive/findings paths") — the #5 override-CLEAR
   belongs to the upload path only (P1 cadence table) and is NOT imported
   into load. Links are NOT pruned by this — a link whose endpoint went
   recipe-less flags as dangling (frozen P1 posture; P2 renders it).
5. `deriveAllStages` + `recomputeReconciliation` + `mirrorActive` — the
   standard full-recompute cadence for a state-replacing mutation (P1 table).

`savePlanAs(name)` captures stages (in stageOrder), names, selections,
positions, links (ids → indices). The Stage-2 op surface (upsert-by-name,
list refresh, rename/delete) keeps its BEHAVIOR — but `renamePlan` is a
second `loadPlanFile` consumer (r2 nit): it spreads the loaded payload,
so its annotation and `savePlanFile`'s signature widen to PlanFileV2, and
renaming a v1 row rewrites it as v2 — consistent with the save-over
model (any write persists v2), named here so it isn't a surprise.
`deletePlan` is untouched.

## Axis 5 — UI: nothing new

PlansBar is untouched — same save field, same list rows. The only observable
change is that loading restores the whole canvas. No new components; App.tsx
unchanged. (The P2 canvas re-renders from the store — a load is just a store
change.)

## Axis 6 — Testing posture

- `plan-store.test.ts`: isPlanFileV2 table (accept/reject rows incl. index
  out-of-range, self-link, duplicate (to,itemId), non-integer indices,
  missing position accepted); migrateV1 rows (v1 file → one-stage v2 shape;
  v1 rejection rows unchanged).
- `store.test.ts`: round-trip — build a 3-stage linked graph with dragged
  positions, savePlanAs → loadPlan → selections/names/order/links/positions
  identical (fresh ids, exact Fractions preserved); a NaN-machineCount
  stage round-trips to NaN, not null (r1 fold); load-time tier stamping
  (global tiers win over file tiers); load-time recipeId re-validation
  (recipe vanished → null, overrides KEPT verbatim, link dangles);
  placementSeq re-seed (addStage
  after load lands on a fresh slot); v1-file load (migrated, auto-slotted);
  corrupt v2 rows refuse without clobbering state.
- Bidirectionality log per family (validator, migration, round-trip,
  load-treatments, re-seed).

## Assumptions ledger

1. Live shapes as read this session (plan-store.ts:19-92 pins, store plan
   chain at store.ts:1004-1040, P2 store fields) — grounded, I merged them.
2. IDB `plans` store rows are opaque JSON keyed by uuid — payload growth
   needs no schema/version change — grounded: plan-store.ts row shape +
   db.ts v2 stores.
3. Selection round-trips through JSON with ONE known lossy edge (r1 fold):
   `machineCount: NaN` serializes as null and MUST be coerced back per
   stage (Axis 4 step 2). Fraction-bearing fields serialize via their
   string forms (Stage-2 shipped behavior, grounded in its round-trip
   tests); position x/y are plain IEEE floats, exact through JSON.
4. Array-index link references are unambiguous because stages array order is
   exactly stageOrder and the validator pins indices in range — by
   construction in this design.

## Revision history

- **r1 correctness (2026-08-04):** code-reviewer NEEDS_REWORK (1 IMPORTANT
  + 2 NIT); adversarial NEEDS_REWORK (2 IMPORTANT + 2 NIT). Folded in v2:
  1. **machineCount null→NaN coercion per stage** (both reviewers): the
     JSON-NaN edge is now in the build step, Assumption 3 corrected, and a
     round-trip test row added.
  2. **Overrides VERBATIM on load** (adversarial): the design had imported
     the upload path's #5 override-clear into load and mislabeled it
     frozen; corrected to the current load posture (recipeId re-validation
     only, overrides verbatim).
  3. **migrateV1 carries createdAt/updatedAt verbatim** (adversarial NIT —
     save-over reads the prior file for createdAt).
  4. **"Stage 1" synthesized** (code-reviewer NIT — v1 entries have no
     name); solve seeded idle in the build pseudocode.
  Refuted-and-held r1: validator not over-strict (no round-trip loss);
  tier stamping preserves tiers-global; save-over v1→v2 chain clean;
  canvas full-id-swap resync a clean replacement; no DB_VERSION bump.
- **r2 correctness (2026-08-04): CONVERGED** — code-reviewer APPROVED (0);
  adversarial APPROVED_WITH_NITS (1 NIT). Folded in v3: renamePlan named
  as the second loadPlanFile consumer — rename types widen to v2 and a
  rename of a v1 row rewrites it as v2; "rename UNCHANGED" claim
  corrected to behavior-unchanged. Refuted-and-held r2: verbatim
  overrides cannot crash (idle short-circuit, selectRecipe clears on
  re-pick, bad-override finding path = shipped precedent); NaN coercion
  at the right layer; timestamp carry closes the save-over hole.
- **Simplify pass (2026-08-04, one-shot): APPROVED_WITH_NITS (2 NIT,
  both prose).** Dispositions: (1) FOLDED — Axis 3 now states the pins
  are the sole guard because the rebuild bypasses addLink (prevents a
  future wrong simplification); (2) RECORDED considered-and-held —
  migrateV1 stays a named pure function (two loadPlanFile consumers +
  its own test family; inline would duplicate into renamePlan).
  Affirmed already-minimal: the format bump (forced by the shipped v1
  validator), position optionality, placementSeq reseed, test rows
  (no subsets). Prose-only folds — no correctness re-run required.
- **v4 FROZEN (2026-08-04).**
