# Design review r6 (delta-scoped) — S20 P3 (#102)

Re-review of `features/propose-grows-up/p3-brainstorm.md` (v6) in
`/home/subzerodev/workspace/satisfactory-foundry` (develop). At r5 you
both returned NEEDS_REWORK (you confirmed v5's own deltas were
correct; these were gaps those folds left behind). All folded.

## The deltas (the ONLY changes since v6's predecessor)

1. **Cache round-trip (both, IMPORTANT)** — spec item 3 now names
   `StoredCatalogData` + `serializeCatalog` + `reviveCatalog` for
   `recipeUnlocks` (null-prototype), with the asymmetric-failure
   rationale (revive tsc-forced, serialize not) and the
   `isRawResource`/#57 precedent; spec 8 adds a save → load →
   non-empty + null-proto pin.
2. **Spec 6 contradiction (both, IMPORTANT)** — spec item 6 no longer
   says "derive once in the single repropose path"; it names both
   derivation sites and the memoization.
3. **"Compile-forced" was false (adversarial, IMPORTANT)** — Axis 4
   now states the seams are NOT compiler-enforced and are pinned by
   tests instead; spec 8 adds behavioural rows (a tier-gated recipe
   absent from rendered picker options and from the label; the
   clear-rule seam resolves against the gated default).
4. **Two derivation sites (both, NIT)** — stated explicitly with
   distinct inputs, why they cannot diverge, and that the body
   derivation runs per RENDER (memoize on `[catalog, unlockedTier]`).
5. **Undercount (both, NIT)** — "ALL FIVE" sites are outside
   `repropose`.
6. **Tier binding (adversarial, NIT)** — spec 6 states the TIER
   control is component state seeded-and-mirrored like the other two
   persisted controls (which is what Axis 4's `unlockedTier` binding
   refers to).
7. **Clamp-on-read (adversarial, NIT)** — Axis 1 validates
   `unlockedTier` to `number | null` and clamps to the derived max.

## Your question

Do these folds close the r5 findings without opening new ones?
- Is the cache fold COMPLETE — are those three the only enumerating
  sites for a new `Catalog` field (check for any fourth: type guards,
  validators, test factories)?
- Do the two derivation sites, as now written, actually serve every
  consumer correctly, and is the no-divergence argument sound?
- Are the new spec-8 behavioural rows sufficient to catch a missed
  seam (each of `:387`, `:441`/`:615`, `:237`)?
- Does the clamp interact correctly with the derived max when
  `recipeUnlocks` is empty (max would be... what)?
- Any remaining residue or new hole.

Everything else was approved at earlier rounds — do not re-litigate.
Return exactly one verdict (APPROVED / APPROVED_WITH_NITS /
NEEDS_REWORK / BLOCKED) with severity-tagged, line-cited findings.
