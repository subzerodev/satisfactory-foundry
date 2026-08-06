# Design review r1 — S20 P0 (#99): Propose info layer

Review the merged brainstorm+spec at
`/home/subzerodev/workspace/satisfactory-foundry/features/propose-grows-up/p0-brainstorm.md`
against the live repo at `/home/subzerodev/workspace/satisfactory-foundry`
(develop).

## A. Current-state anchors (verify against live source)

- `src/ui/chain-builder-adapter.ts` — `candidateRecipesFor` (~:47),
  `candidateRowsFor` (~:143) and its subtree power computation (~:184-208,
  exact Σ machineCount × power.mw + varies flag), `itemRateLineText`
  (~:118), `toProposalPreview`/`previewRowText` (~:100-115),
  `EXCLUDED_MACHINE_IDS` (~:27).
- `src/core/chain-builder.ts` — `ChainProposal { stages, links, rawInputs,
  byproducts }`; `ProposedLink { fromItemId, toItemId }`; one stage per
  item; DAG with possible fan-out (a producer feeding multiple consumers).
- `src/ui/ChainBuilder.tsx` — preview markup (~:70-95), component-local
  ephemeral preview (frozen Stage 8 Axis 6).
- Epic #98 decisions: P0 is info-only; controls are P1+.

## B. Claims / choices to verify

1. **Axis 1 (reuse):** are the compare-path subtree metrics genuinely
   extractable into a shared `proposalMetrics` with byte-identical compare
   behavior? Check what the internals actually take (whole proposal vs
   per-candidate subtree proposals) — is "a whole proposal IS the target's
   subtree" true in this code?
2. **Axis 2 (depth-tiered rows):** is longest-path-from-target the right
   depth for a DAG here (vs shortest-path)? Does the fan-out "→ feeds"
   suffix + tier grouping honestly represent the structure the links
   encode? Attack the diamond case and the ordering-stability claim.
3. **Axis 3:** candidateRecipesFor as the alternates count — does it
   include alternates + the chosen recipe (the "N recipes, show when ≥2"
   wording) and respect exclusions consistently with what Propose itself
   would offer in P1?
4. **Axis 4:** cost-sheet block content/wording vs the TitleBlock Σ POWER
   idiom (the walk cross-check claim: must the two agree at 100% clock —
   is that actually true given the applied chain's clocks default to 100?).
5. **Scope discipline:** nothing mutates the proposal; nothing from P1-P3
   leaks in; the store gains nothing.
6. **Test plan:** are the four test families sufficient + bidirectional;
   is the compare-path regression pin adequate insurance for the Axis-1
   refactor?

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK /
BLOCKED) with severity-tagged, line-cited findings.
