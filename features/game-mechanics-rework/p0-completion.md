# P0 completion report — data foundations (#150, child of #140)

**Merged:** `cece96d` (`feature/phase-p0` → `develop`, `--no-ff`, 2026-08-19).
**Spec:** `p0-brainstorm-spec.md`, frozen at r8 (`2febb21`).
**Trunk state after merge:** 1177 tests green, `npm run check` clean (verified after worktree removal).

## What landed

- **D1 — parsed tier table.** `parseDocsJson` derives belt tiers (`mSpeed ÷ 2`)
  and pipe tiers (`mFlowLimit × 60`) from the Docs file as exact Fractions —
  string-tokenized BigInt parse, no floats — deduped and sorted ascending.
  Parse-else-curated per kind: an empty or malformed kind falls back to the
  curated `TIER_TABLE`, never a rejection; malformed individual entries skip
  leniently.
- **D1b — single source of truth.** The four direct `TIER_TABLE` consumers
  reroute through `catalog.tiers`: `sliceTier` takes the table as a parameter,
  the store's ready transition owns the sole upper clamp (all four
  catalog→ready sites, composed before any derive/solve), `setUnlockedTiers`
  clamps against the live table, and `ControlsStrip`/`TierToggles` get the max
  via a prop cascade from `App`. The persist merge keeps only the three-branch
  sanitizer: `undefined` → full fallback, present positive integer → kept
  (no upper bound — a modded 7 survives reboot), anything else → 1.
- **D2 — round-trip.** Tiers serialize into the catalog cache and revive by
  value; `CATALOG_PARSER_VERSION` 7 → 8.
- **D3 — drift tripwire.** A guard test parses the real
  `public/bundled-docs/en-US.json` and asserts the derived table equals the
  curated one value-for-value — a game-patch speed change now fails loudly.
- **D4 — lockout correction.** `TRAIN_LOCKOUT_SECONDS` is exactly 27, cited to
  `Build_TrainDockingStation_C.mTimeToCompleteLoad`; every assertion in the
  docking describe blocks re-derived from 27 (not find-replaced), docstrings
  and `docs/research/transport-facts.md` swept.

## Review trail

- **Design:** 8 rounds (r1–r8) on the degraded all-Claude roster
  (code-reviewer + adversarial-reviewer), then a zero-finding simplify pass.
  Substantive catches along the way: the tiers bifurcation (r1), the
  pre-catalog merge-clamp BLOCKER (r2), the down-only silent-loss defect that
  produced the single-owner clamp (r4), two pinned tests falsifying an
  "unobservable" claim (r4), the zustand corrupt-JSON path divergence resolved
  by reading middleware source (r6), and the unpinned `undefined → max` branch
  (r7). Full dispositions in the spec's `## Revision history`.
- **Diff:** code-reviewer APPROVED (0 findings) + adversarial
  APPROVED_WITH_NITS (1 cosmetic comment nit, folded @ `780346d`), simplify
  APPROVED (0 findings). Two implementer deviations reviewed and endorsed:
  the `transport-text.test.ts` fixture re-choice (RtD 140 keeps the ≈-branch
  non-terminating under 27 s) and preserving the two revision-history 27.08
  mentions in `transport-facts.md` as audit record.
- **Bidirectionality:** `r2-verification.log` — 7 behaviours mutation-proven
  (tier parse factor, ready clamp upper bound, all three sanitizer branches,
  round-trip serialization, lockout ceiling), every mutant compiling, every
  FAIL genuine, work committed before mutating.

## Acceptance criteria

All five met: file-derived tiers with the D3 guard (1), per-kind fallback (2),
round-trip + version 8 (3), lockout 27 cited to the game field (4), suite +
lint green (5).

## Follow-ons

None opened by this phase. P1 (solver overflow-chain model) is next and all
its decisions are locked; its brainstorm starts after the P0 USER GATE.
