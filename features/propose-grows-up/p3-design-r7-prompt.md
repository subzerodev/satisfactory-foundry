# Design review r7 (delta-scoped) — S20 P3 (#102)

Re-review of `features/propose-grows-up/p3-brainstorm.md` (v7) in
`/home/subzerodev/workspace/satisfactory-foundry` (develop). At r6 you
both returned NEEDS_REWORK; v6's deltas 1-6 survived your refutation,
so these folds address the gaps those folds left plus the one defect
the team lead introduced at v6 (the clamp).

## The deltas (the ONLY changes since v6)

1. **The clamp is DROPPED, not re-placed** (both, IMPORTANT). Axis 1
   now validates `unlockedTier` to `number | null` — type only. The
   three failure modes you found are recorded as the rationale.
   Replaced by RENDER-level normalization: if `unlockedTier` is not
   among the derived options (too high, or `recipeUnlocks` empty so
   only "all" exists), the TIER select renders "all" — which is what
   a too-high tier already behaves as. No write-back, no `-Infinity`,
   no hydration-order dependency, no empty-case special rule.
2. **Cache fold completed** (both, IMPORTANT). Spec 3 now also names:
   `reviveCatalog`'s field-by-field shape guard; that the field is
   REQUIRED with the fan-out INTENDED (and why the `isRawResource`
   optional precedent must not be followed — optional un-forces
   revive and voids the delta's own argument); the tsc-forced sites
   incl. `GraphCanvas.tsx:353-358`; and the one NON-forced site,
   `serializedSample()` (`catalog-store.test.ts:253-290`), with an
   explicit ruling: fix the fixture, do NOT make revive tolerant.
3. **Seam pins restructured** (code-reviewer, IMPORTANT + NIT). One
   row per genuinely separate edit — `:387`, `:418`, `:441`, `:237`
   (`:615` inherits from `:387`). The `:441` row now pins the
   `(default)` TAG rather than list membership, because `recipeLabel`
   only decides that tag. `:418` added (an ungated one renders a dead
   recovery select contradicting the matrix). All rows are UI-level.
4. **Memo placement** (code-reviewer, NIT). The body derivation's
   memo must sit ABOVE `ChainBuilder.tsx:131`'s null-catalog guard
   and tolerate null — every existing body derivation sits below it,
   so the natural placement is a conditional hook and the toolchain
   has no `eslint-plugin-react-hooks`.

## Your question

Do these close r6 without opening anything new?
- Is render-level normalization actually sufficient and side-effect
  free? Walk it: persisted tier 9, catalog whose max is 3 → what
  renders, what gates, what (if anything) is written back? And with
  an empty `recipeUnlocks`?
- Is the cache fold NOW exhaustive (any remaining site that
  constructs or validates a `Catalog` / stored shape)?
- Does each of the four seam rows actually FAIL if its edit is
  missed? Walk each against source.
- Any residue of the dropped clamp, or of earlier deltas.
- Any new hole.

This design has been through six rounds; deltas 1-6 of v6 were
confirmed sound. If it is genuinely ready, APPROVE honestly — do not
manufacture a seventh finding. If something real remains, say so
plainly.

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS /
NEEDS_REWORK / BLOCKED) with severity-tagged, line-cited findings.
