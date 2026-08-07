# Design review r3 (delta-scoped) — S20 P2 (#101)

Re-review of `features/propose-grows-up/p2-brainstorm.md` (v3) in
`/home/subzerodev/workspace/satisfactory-foundry` (develop), AFTER a
post-convergence simplify fold. You (the correctness pair) converged
APPROVED_WITH_NITS × 2 on v2; the fold contract requires a correctness
re-run on the changed artifact.

## The delta (the ONLY change from the v2 you approved)

`byproductSuggestions` payload narrowed:
`{itemId, rate, fromItemId, toItemId, toItemName}` →
`{itemId, rate, toItemId, toItemName}` — `fromItemId` removed (it was a
StageLink source key serving only the routing feature descoped to #105;
the display line `B R/min could feed <StageItem>` reads
itemId/rate/toItemName only), `toItemId` retained solely as the stable
list key. See Axis 4 + the v3 revision-history entry.

## Your question

Does this narrowing break anything the v2 design relied on? Check:
- No P2 spec/test/walk surface consumes `fromItemId` (grep the
  artifact).
- The key claim: can two suggestions collide on (itemId, toItemId)? A
  proposal's stages are keyed by item (one stage per item), and a
  suggestion pairs one byproduct with one consuming stage — verify
  against `src/core/chain-builder.ts` stage identity if in doubt.
- Ticket #105 (the routing follow-up) documents its own needs — the
  narrowing here does not starve it (it re-derives payloads in its own
  design).

Everything else in v3 is the artifact you already approved — do not
re-litigate it. Return exactly one verdict (APPROVED /
APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED) with line-cited findings.
