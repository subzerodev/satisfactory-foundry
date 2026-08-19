# Design review r2 — #135 split the schematic (Stage 23)

**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry`
**Artifact:** `features/schematic-split/brainstorm-spec.md` (design r2)
**Ticket:** #135 · **Epic:** #136 · design stage, no `src/` file modified.

r1's verdicts and the full disposition are at #135 comment 24699. **r2 is a
rework, not a fold** — both reviewers found the same two BLOCKERs and both were
confirmed by arithmetic.

## What changed in r2 — spend your effort here

1. **Re-anchored on the non-band path.** r1 built the split around `MachineBand`,
   which does not run at Michael's N: `bandMode` is `912/N < 8`, so N = 106 gives
   `8.60` → `band === false`. **Verify that**, and verify r2's corroboration that
   the screenshot's every-third-index labels match the non-band `labelStep(106) = 3`
   (`layout.ts:297-300`). Does r2 now specify the primary path correctly, and does
   it handle N > 114 too?

2. **The machine axis is now DRAWN, not retained** — r1's "the ticks stay" was
   impossible because the non-band branch has no tick lines (`Schematic.tsx:516-537`
   emits a `<rect>` + conditional `<text>` only). r2 specifies a **12px ruler**:
   baseline + a tick per labelled index + the existing labels, with the index source
   differing by mode. **Is that the right shape? Is 12px workable? At N = 20 every
   machine gets a tick (`labelStep = 1`) — is that a smear by another name?** At
   N = 106 it is ~37 ticks; judge whether that reads as a scale or as clutter.

3. **The 40px is now owned as a `layout.ts` change.** `computeLayout` takes an
   explicit `machineRowH`; r1's claim that CSS could reclaim it, and its "no new
   layout math", are both withdrawn. Consequences r2 accepts: output lanes move up
   28px, and the r1 criterion "output breakouts pixel-unchanged" is withdrawn as
   unachievable. **Verify the consequence set is complete** — what else keys off
   `machineTop`/`outputTop`/`height`, and does the parameter reach the four literal
   `40`s (`Schematic.tsx:382`, `:393`, `:522`, `:553`)?

4. **Four existing smoke tests are enumerated and re-pointed** rather than deleted
   (`smoke.test.tsx:204`, `:330-332`, `:371-375`, `:446-448`). Check the landing
   assignments are right and that no fifth test breaks.

5. **r1's leak tripwire is retired** because `layout.test.ts:49-59` derives its
   expectation from `LAYOUT.machineH` and so cannot detect that constant shrinking.
   r2 replaces it with explicit literal pins at both heights. **Is that sufficient?**

6. **Label crowding is explicitly NOT fixed** and is pushed to #138. Michael's
   complaint names the colliding number strip, and the axis inherits it. **Is that a
   legitimate boundary, or does it mean this ticket ships without addressing half
   the report?** Say plainly which.

## Anchors

`src/ui/Schematic.tsx` (`:78-90`, `:96-343`, `:356-411`, `:413-573`, `:479-482`,
`:507-537`, `:539-561`, and the `40` literals at `:382`, `:393`, `:522`, `:553`);
`src/ui/layout.ts` (`:21`, `:30`, `:32-88`, `:100-102`, `:114-169`, `:190-211`,
`:275-342`, esp. `:289-300`, `:307`, `:314-326`);
`src/ui/layout.test.ts` (`:46-60`, `:124-134`);
`src/ui/smoke.test.tsx` (`:204`, `:330-332`, `:371-375`, `:446-448`);
`src/ui/App.tsx` (`:66`, `:158`, `:426-469`); `src/ui/app.css` (`:684-692`, `:850-853`);
`docs/master-plan.md` Stages 12-16.

## Also check

- Every `file:line`, against live source, and every arithmetic claim.
- Any ledger row marked **Verified** that is not. One row is deliberately marked
  *Judgement, not measurement* — check the rest earn their label.
- Whether r2 is bigger than it needs to be. r1 was judged **smaller** than it needed
  to be; do not let the correction overshoot.

## Verdict contract

Return exactly one of `APPROVED` / `APPROVED_WITH_NITS` / `NEEDS_REWORK` /
`BLOCKED` **in your final message**, severity-tagged, citing verified source. If a
nested check does not report, state the finding marked unconfirmed and
source-derived — do not withhold it and do not wait.

Approve if a determined attack finds nothing real. Be explicit about severity; if
what you find is cosmetic, say so and approve.
