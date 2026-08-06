# S20 P0 — Propose info layer (brainstorm + spec)

**Ticket:** #99 · **Epic:** #98 · **Milestone:** 91 · **Status:** v3 FROZEN 2026-08-06
(r1: APPROVED_WITH_NITS + NEEDS_REWORK, folded · r2: APPROVED_WITH_NITS ×2,
folded · simplify: 2 folded (struct widened) · r3 on the fold:
APPROVED_WITH_NITS ×2, 3 nits folded — all reviews degraded: same-vendor)

## Purpose

The Propose preview explains itself before Apply: what the chain costs
(power, machines, raw resources), how it is structured (what feeds what),
and where recipe choices exist (the hook P1's picker attaches to). Read-only
— no control changes the proposal in P0.

## Already settled — do NOT re-litigate

- Epic #98 decisions: all improvements one arc; P0 = info only; sequencing
  locked. Controls (picker/raw/exclusions) are P1; solver changes P2;
  persistence P3.
- The preview stays component-local ephemeral state (ChainBuilder's frozen
  Stage 8 Axis 6 posture) — P0 adds display, not store surface.

## Ground truth (verified this session)

- `src/ui/chain-builder-adapter.ts`:
  - `candidateRecipesFor(catalog, itemId): CatalogRecipe[]` (:166-169) —
    candidate producer recipes per item (catalog FIRST — design r1
    corrected the stated arg order); returns `[]` when fewer than 2
    candidates, so `.length` is 0 or ≥ 2, never 1.
  - The alt-compare subtree metrics: `candidateRowsFor` (:262-307) runs
    `proposeChain` per candidate and computes metrics over each returned
    WHOLE ChainProposal — `subtreePower` (:190-214, Σ machineCount ×
    `catalog.machines[id].power.mw`, exact, variable-power flag + bounds),
    `subtreePowerText` (:224-240, the S6 "(varies …)" discipline), inline
    machine Σ (:279), `itemRateDot` (:244, the "·"-joined compact text).
    "A whole proposal IS the target's subtree" is literally true in this
    code (design r1, verified by both reviewers).
  - `itemRateLineText` (:118, ", "-joined — the flat-preview raw-inputs
    idiom, distinct from `itemRateDot`).
  - `toProposalPreview` (:83) / `previewRowText` (:113) — the current flat row:
    "Item — Machine ×N — rate/min".
- `src/core/chain-builder.ts`: `ChainProposal.links: ProposedLink[]`
  (fromItemId → toItemId) — the structure exists, is never displayed. One
  stage per item; the graph is a DAG (a producer may feed MULTIPLE
  consumers), so a strict tree render would misrepresent fan-out.
- `src/ui/ChainBuilder.tsx` (167 lines): preview renders `.chain-builder-rows`
  flat `<ul>` + raw/byproducts lines + Apply/Discard.
- Drawing identity: title-block idiom (Σ POWER row exists in TitleBlock),
  IBM Plex Mono numerics, `--fg-muted` secondary text.

## Decision axes

### Axis 1 — Cost-sheet computation

Options: (a) new metric code; (b) refactor the alt-compare subtree helpers
into shared proposal-metric functions and apply them to the WHOLE proposal.

**Pick (b), reuse-first.** The compare machinery already computes exactly
these totals for candidate subtrees; a whole proposal IS the target's
subtree. Extract `proposalMetrics(proposal, catalog)` → `{ powerMw:
Fraction, powerVaries: boolean, minMw: Fraction, maxMw: Fraction,
machineCount: bigint, rawInputs: ItemRateRow[] }` from the existing
internals — the min/max bounds INCLUDED (simplify fold: accumulated at
:210-211 in subtreePower, consumed at :231 via stagePowerText →
variesSuffix advice.ts:215-230; on a fully-constant chain
minMw === maxMw === powerMw — the degenerate envelope, never an absent
state; r3 fold. Without the bounds
the compare path could not re-compose and the reuse claim would be
oversold). The compare path re-composes over the widened struct — behavior
byte-identical, its tests keep passing. No new math; the S6 "(varies …)"
power discipline carries over verbatim.

### Axis 2 — Structure display

Options: (a) indented strict tree (WRONG: the proposal is a DAG — fan-out
stages would render duplicated or lose consumers); (b) React-Flow mini-map
(a second graph renderer inside a panel — heavy, P0 is a list panel);
(c) **depth-tiered rows**: group rows by topological depth from the target
(T0 = target, T1 = its direct feeders, …), each row gaining a "→ feeds …"
suffix naming its consumer items.

**Pick (c).** Honest for a DAG (fan-out appears as multiple names in one
suffix, nothing duplicated), renders as the same linear list (mega-factory
scale = the existing list's scale), zero new layout machinery, and the tier
labels speak the drawing idiom (mono "T0/T1/…" markers). Depth =
longest-path-from-target: T0 = target, T1 = its direct feeders (links
point input-item → consumer-item, chain-builder.ts:245, so the traversal
walks `to → from`); longest-path guarantees no producer ever renders in a
shallower tier than any of its consumers (shortest-path would break the
"feeds" reading on a diamond with a shortcut edge — design r1). The two
structure signals are NOT redundant (simplify fold): tier markers encode
DEPTH (hops from target), the feeds suffix encodes NAMED ADJACENCY (which
consumers) — on a DAG a fan-out producer is legible only through the
suffix. Computed in the adapter from `proposal.links`, pure and
unit-testable; ties broken by existing row order for stability.

### Axis 3 — Alternates tell

`candidateRecipesFor(catalog, itemId).length` per row — the function
already returns `[]` below 2 candidates, so the length is 0 or ≥ 2 by
construction; a nonzero length shows a muted **"N recipes"** chip (count
includes the chosen recipe). P1's picker uses the SAME function
(AltCompare does today), so the P0 count is exactly what P1 will offer.
Pure count in the adapter row type; the chip is display-only in P0.

### Axis 4 — Cost-sheet placement + markup

A compact summary block ABOVE the rows (the reader decides feasibility
before reading structure): three mono lines in the title-block idiom —
`Σ POWER <n> MW[ (varies)]` · `Σ MACHINES <n>` · `RAW <compact item list>`.
Reuses `itemRateLineText` for RAW. Byproducts line stays where it is.
Styling: existing tokens only, both themes; no new CSS variables.

## Spec (file-by-file)

1. **`src/ui/chain-builder-adapter.ts`** — extract/export
   `proposalMetrics(proposal, catalog)` (shared with the compare path,
   which re-composes over it unchanged); extend `ProposalPreview` rows
   with `{ depth: number, feeds: string[] (display names), candidateCount:
   number }` + a `metrics` field on the preview; depth computation from
   `proposal.links` (longest path from target; target depth 0); rows
   ordered by (depth asc, existing order) with tier boundaries derivable
   from consecutive rows.
2. **`src/ui/ChainBuilder.tsx`** — render the cost-sheet block, tier
   markers ("T<n>" on first row of each depth), the "→ feeds …" suffix,
   and the "N recipes" chip. No new state, no new controls.
3. **`src/ui/app.css`** — `.chain-builder-metrics`, `.chain-builder-tier`,
   `.chain-builder-alt` styles from existing tokens (both themes).
4. **Tests** (adapter, node env): proposalMetrics totals on a fixed
   multi-stage proposal (exact Fraction values incl. the varies flag);
   depth assignment on a diamond DAG (fan-out + fan-in — proves
   longest-path and the feeds suffix); candidateCount against a catalog
   with known alternates; compare-path regression (candidateRowsFor
   unchanged). **Bidirectionality log** (`features/propose-grows-up/`
   `p0-r2-verification.log`) — per new behavior, a genuine FAIL with the
   production code broken, then restore + green.
5. **Docs at merge (team lead):** FEATURE.md phase status, changelog
   entry, completion note.

## Explicitly out of scope

Any control that mutates the proposal (P1); overrides/raw-set/exclusion
UI (P1); clock/byproduct routing (P2); persistence (P3); React-Flow
rendering of the preview.

## Test + verification plan

- Unit tests per spec item 4 + bidirectionality log.
- `npm test` + `npm run check` green in worktree AND on trunk after
  worktree removal.
- **Walk:** dev server — propose a deep chain (e.g. Computer 10/min):
  cost sheet shows exact totals. **Σ POWER sanity check (corrected at
  design r1 — the two renderers are DIFFERENT by design and can NEVER
  string-match):** the cost sheet is the exact Fraction figure
  (`stagePowerText` exact branch at 100%, advice.ts:95-98); the TitleBlock
  is deliberately float-summed, whole-MW-rounded, `Σ ≈`-prefixed
  (`chainPowerText`, advice.ts:124-143) AND sums ALL store stages, not
  the proposal. So: walk on an EMPTY graph, Apply, and check the
  TitleBlock's `Σ ≈ N MW` is WITHIN 1 MW of the cost sheet's exact value
  (r2 fold: float summation + toFixed(0) can tip a .5-adjacent total one
  whole MW off the exact rounding — "within 1 MW" is the honest,
  achievable predicate; never byte equality). Then: tiers read correctly (target T0 first); a
  fan-out producer shows both consumer names in its feeds suffix;
  "N recipes" chips appear on known-alternate items; both themes; 50+
  stage proposal stays readable.

## Assumptions ledger

- The alt-compare subtree metrics operate on ChainProposal shapes and are
  extractable without behavior change — grounded: read this session
  (:184-208 power, :143 rows); the regression test pins it.
- `catalog.machines[id].power.mw` exists for all standard machines with a
  varies flag — grounded: S6 power groundwork + the compare path already
  depends on it; unresolvable machines contribute nothing (existing
  discipline, preserved).
- The proposal DAG always has the target as its unique sink — grounded:
  builder constructs demand-driven from the target; the depth function
  still totalizes (unreachable rows get depth ∞ → rendered last) as
  defense.

## Revision history

- v1 (2026-08-06): initial merged brainstorm+spec.
- v2 (2026-08-06): design r1 fold. code-reviewer APPROVED_WITH_NITS
  (1 IMPORTANT + 2 NIT), adversarial NEEDS_REWORK (2 Major + 2 Minor) —
  both degraded: same-vendor. Both verified Axis-1 extraction is REAL.
  - **FOLDED (IMPORTANT, cr):** `candidateRecipesFor(catalog, itemId)` —
    arg order corrected everywhere; its returns-[]-below-2 contract now
    carries Axis 3 (length is 0 or ≥2 by construction).
  - **FOLDED (Major ×2, adv):** the walk's Σ POWER cross-check rewritten —
    the two renderers are different BY DESIGN (exact Fraction vs
    float/whole-MW/`Σ ≈`; TitleBlock sums ALL store stages): empty-graph
    precondition + value-modulo-rounding check, never string equality.
  - **FOLDED (NIT/Minor):** ground-truth anchors corrected
    (candidateRecipesFor :166-169, candidateRowsFor :262-307,
    subtreePower :190-214, subtreePowerText :224-240, itemRateLineText
    :118 vs itemRateDot :244); "consumer-side" depth wording replaced
    with the explicit link-direction traversal (to → from).
- v2b (2026-08-06): r2 nits folded (both reviewers APPROVED_WITH_NITS):
  Σ POWER walk predicate is "within 1 MW" (float/.5-boundary honesty);
  toProposalPreview anchor corrected to :83.
- v3 (2026-08-06): simplify-pass fold (one-shot, post-convergence).
  claude-simplify-reviewer APPROVED_WITH_NITS (2) — degraded: same-vendor.
  - **FOLDED:** proposalMetrics widened with minMw/maxMw — the compare
    path's varies-bounds rendering requires them; the narrower struct
    made the "re-composes unchanged" claim oversold.
  - **FOLDED:** Axis 2 now states the tier-vs-feeds non-redundancy
    (depth vs named adjacency) explicitly.
  - Confirmed already-minimal: the three row fields, three CSS classes,
    four test families, row keying unchanged.
- v3-final (2026-08-06): r3 nits folded (APPROVED_WITH_NITS ×2):
  accumulate-vs-consume citation relabeled; degenerate-envelope semantics
  stated (minMw===maxMw===powerMw when nothing varies); rawInputs typed
  as RAW ItemRate rows with rendering at the consumer. FROZEN.
