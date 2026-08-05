# Stage 8 / Phase 0 — hygiene: #28 lookups + #34 resolver — design note v3 (FROZEN)

One combined behavior-preserving phase. Two items, one real fork.

## Already settled — do NOT re-litigate

- Both tickets' outcomes are fixed by their bodies (#28: uniform
  prototype-safe lookup discipline, colliding-id fixture test; #34: one
  planForLink resolver, five call sites collapsed, zero behavior change).
- The #34 resolver's natural home + signature were pinned by the P3
  diff-simplify reviewer whose finding spawned the ticket: graph-flow.ts,
  `planForLink(link, catalog, stages): TransportPlan | null`, folding the
  shared resolution + the five-arg computeLinkTransport call. (The
  reviewer's sketch ALSO folded the belt-skip guard — the #34 mechanics
  section below corrects that: per-surface filtering stays at the
  surfaces; the settled part is the home, signature and resolution fold.)
- Behavior-preserving: the existing 567 tests stay green; edits to
  existing tests only where a fixture legitimately needs the new shape.

## The #28 fork — per-site guards vs structural fix

**Pick: the STRUCTURAL fix — the catalog's three Record maps (items /
machines / recipes) are built as NULL-PROTOTYPE objects at their two build
boundaries (docs-loader parse; catalog-store revive). Bracket access on a
null-proto Record cannot resolve prototype members, so every current AND
future lookup site is safe with zero per-site discipline.**

- Why not 7 × `Object.hasOwn` guards: the ticket's own framing ("one
  structural fix beats N site guards"); guards are a per-site discipline
  every future lookup must remember (the S6P2 sweep already proved sites
  get missed), and the 7 sites span four files.
- Mechanics: the two build sites construct via `Object.assign(
  Object.create(null), …)`-style population (or key-by-key inserts — the
  loaders already build key-by-key). `Record<string, T>` typing is
  unchanged. IDB structured clone: cloning a null-proto object yields a
  PLAIN-proto clone, so the revive path (which already rebuilds each map
  per StoredCatalog) re-nulls on the way back in — the revive rebuild is
  the existing pattern; only the container literal changes.
- The S6P2-era `Object.hasOwn` guards — TWO call sites, both in
  advice.ts (a prior simplify fold already consolidated the App/graph-flow
  copies into stagePowerTextFor) — become redundant but stay (harmless
  static-Object calls that work on null-proto args; removing them is
  churn the phase doesn't need — recorded, not folded). Simplify fold:
  the guards' own comments gain a one-line breadcrumb ("redundant-by-design
  since the maps went null-proto — kept as belt-and-braces") so a future
  reader doesn't re-derive the analysis.
- Fixture/test posture: test fixtures keep plain object literals (their
  ids don't collide); the NEW colliding-id fixture test builds a catalog
  whose maps carry an id "constructor" THROUGH the real parse path
  (docs-loader on a synthetic Docs.json blob) and asserts the lookup
  misses cleanly — pinning the boundary, not a hand-built map.

## #34 mechanics (no fork — the reviewer specified the shape)

- `planForLink(link, catalog, stages): TransportPlan | null` exported
  from graph-flow.ts (beside linkRequiredRate + globalUnlockedTiers, its
  stated natural home). Null EXACTLY when the item is missing from the
  catalog — nothing else (see the boundary bullet). Internally:
  linkRequiredRate + globalUnlockedTiers + the five-arg
  computeLinkTransport (which itself supplies the belt default and the
  unsolved plan).
- Behavior-preservation boundary (r1-corrected on BOTH dimensions):
  planForLink resolves for EVERY configured-or-default mode (belt default
  included — computeLinkTransport handles the absent-transport default;
  null-on-belt would erase the inspector's belt fleet lines), AND it
  passes an unsolved rate THROUGH as computeLinkTransport's
  `{ kind: "unsolved" }` plan (null-on-unsolved would erase the
  inspector's "solve both stages to size the fleet" line — the r1 MAJOR).
  **null is reserved for exactly one absence: the item missing from the
  catalog.** The five call sites keep their OWN pre-filters (the chip's
  belt-skip, findings' train-only, power's belt/pipe-skip — per-surface
  policy, not resolver policy). The resolver folds the RESOLUTION, not
  the filtering — that distinction is what keeps this behavior-preserving.
- Call sites collapsed: graph-flow transportChipFor + computeTransportFindings,
  LinkInspector, chain-view linkChip + chainTransportPower. Each keeps its
  pre-filters; each replaces its resolve preamble with the call.
- Tests: existing suites already pin all five surfaces' behavior — the
  refactor's proof is 567 staying green + one new direct planForLink test
  row (null cases + a resolved case) with a bidirectionality entry.

## Test plan sketch

The colliding-id fixture through the real parse path (lookup misses
cleanly; nothing resolves Object.prototype members); a null-proto
round-trip through serialize/revive (revived maps are null-proto again);
planForLink direct rows (missing item → null; UNSOLVED rate → the
`{ kind: "unsolved" }` plan, never null; belt default resolves; vehicle
mode resolves identically to the old preamble output); the full
existing suite green unmodified. Bidirectionality log per the R2 rule.

## Assumptions ledger

1. The loaders build the three maps key-by-key (verified in docs-loader
   source this session for items/machines/recipes — literal `{}` seeds).
2. Structured clone of null-proto objects preserves own enumerable props
   (standard structured-clone behavior); the revive rebuild re-nulls.
3. The five #34 call sites' pre-filters differ (belt-skip at the chip;
   train-only at findings) — the resolver deliberately excludes them
   (the behavior-preservation boundary above).

## Revision history

- v1 (2026-08-04): initial.
- v2 (2026-08-04): dual-review r1 — BOTH reviewers NEEDS_REWORK on the
  same defect: v1's "null on unsolvable rate" clause would erase
  LinkInspector's rendered unsolved plan ("solve both stages to size the
  fleet") — the same class of correction v1 itself made for belt, missed
  on the rate dimension. Folded: null reserved for missing-item ONLY;
  unsolved plans flow through; test row added. NITs folded: the guard
  count corrected (two sites, both advice.ts — graph-flow has zero after
  the earlier consolidation); the settled-block's stale belt-skip wording
  reconciled with the corrected boundary. Verified clean by both: the
  null-proto sufficiency (full access-pattern sweep — no in/spread/
  prototype-method-on-map usage; revive rebuilds all three containers
  key-by-key incl. post-P2 items; static Object.* calls null-proto-safe),
  the belt-resolution boundary, the colliding-id fixture idiom, the 567
  baseline.
- v3 (2026-08-04): r2 APPROVED×2 (0 findings — the corrected contract
  verified behavior-preserving; the resolver's null definitionally
  unreachable at every pre-guarded site). Simplify pass APPROVED (0
  gating) with every probe affirming the design as right-sized (the
  structural fix genuinely simpler than 7 guards; the through-the-parse-
  path test pins the boundary, a hand-built map would be tautological;
  leaving the guards the smaller diff). One advisory nit FOLDED into the
  implementation scope: the guard comments gain the redundant-by-design
  breadcrumb. FROZEN.
