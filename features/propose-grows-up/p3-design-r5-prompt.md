# Design review r5 (delta-scoped) — S20 P3 (#102)

Re-review of `features/propose-grows-up/p3-brainstorm.md` (v5) in
`/home/subzerodev/workspace/satisfactory-foundry` (develop). At r4 you
both returned NEEDS_REWORK on the mechanism swap's unstated
consequences (you confirmed the r1-r3 both-worlds folds themselves
survived). Every r4 finding is folded.

## The deltas (the ONLY changes since v4)

1. **Tier staleness (both, IMPORTANT)** — Axis 4 now specifies that
   the tier rides the `repropose` PATCH: `patch.unlockedTier?:
   number | null`, resolved `patch.unlockedTier !== undefined ?
   patch.unlockedTier : unlockedTier` (deliberately `!== undefined`,
   not `??`, since `null` is the meaningful "all"); spec-8 pins that
   a tier change's own propose uses the NEW world.
2. **Derivation scope (both, IMPORTANT)** — derive `gated` in the
   ChainBuilder COMPONENT BODY (not inside `repropose`); the three
   module-scope seams are named: `RecipePicker`'s `catalog=` prop
   (`:387`), `recipeLabel`'s two call sites (`:441`, `:615`).
3. **#28 null prototype (code-reviewer, IMPORTANT)** — spec 5 now
   mandates `Object.create(null)` for `gateCatalog`'s filtered
   `recipes` map (and `recipeUnlocks`), with test rows; rationale
   cites the two existing construction sites and the fact that
   existing pins only cover the parse/revive boundaries.
4. **Delta-1 residue (both, IMPORTANT/NIT)** — Axis 3's `{tier,
   source}` sentence and Axis 4's `unlock.tier` predicate rewritten
   to the narrowed `Record<string, number>` model (absent key ⇒
   always available).
5. **Silent-total-failure guard (adversarial, out-of-delta advisory)**
   — Axis 3 now mandates that the extracted `seg` EXCLUDES the
   trailing apostrophe (a whole ref through `normalizeClassName`
   returns `""`), with a test pinning a real ref → a real id.
6. **Carve-outs (both, NIT)** — `excludableMachines` (`:276`) and
   `byproductSuggestions` (`:490`) explicitly keep the UNGATED
   catalog, each with its rationale; the Axis-4 gated-consumer list
   no longer contradicts spec 6.

## Your question

Do these folds close the r4 findings without opening new ones?
- Is the patch-borne tier resolution correct for BOTH transitions
  (a number → null "all", and null → a number)? Does `!== undefined`
  handle them where `??` would not?
- Does deriving in the component body actually reach all five sites
  once the three named seams pass `gated`? Any site still stranded?
- Are the carve-out rationales accurate against source?
- Does any `source` / `unlock.tier` / wrapper residue remain
  anywhere in the artifact?
- Any new hole.

Everything else was approved at r3/r4 — do not re-litigate.
Return exactly one verdict (APPROVED / APPROVED_WITH_NITS /
NEEDS_REWORK / BLOCKED) with line-cited findings.
