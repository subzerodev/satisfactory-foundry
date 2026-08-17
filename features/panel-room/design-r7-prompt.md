# Design review r7 — #134 extraction panel room (Stage 23)

**Worktree (absolute):** `/home/subzerodev/workspace/satisfactory-foundry`
**Artifact:** `features/panel-room/brainstorm-spec.md` (design r7)
**Stage:** design (no `src/` file modified) · **Ticket:** #134 · **Epic:** #136

Seventh round. **The CSS has not changed since r5** and has now been confirmed
sound by three consecutive reviewer pairs. r7 responds to r6's verdicts
(#134 comment 24653), where both reviewers independently returned the *same*
single BLOCKER.

Committed as `70d9253`; the probe and its log were regenerated together.

## What is settled — do not re-derive unless you believe a predecessor erred

The percentage basis (`.react-flow`'s padding box is definite); the constants
being derived not fitted; the wrapper staying `min(content, cap)`; `:141-143`
remaining unmodified and armed; the completeness of the stack→wrapper rebinding;
the probe's `none`/`visible` stand-in for deletion; and every count, clearance
and threshold figure. Three pairs have verified these.

## What changed in r7 — spend your effort here

1. **Gate change 5 was deleted, not repaired.** r6 proposed capturing containment
   before `check.mjs:164`'s `scrollIntoView`; both reviewers showed that fails the
   pinned-340 geometry matrix on the design's own intended overflow. r7 leaves
   `:163-171` post-scroll and documents it as a chrome-avoidance test, arguing
   that **no formulation of `:167` is both armed and green at 340px**, so
   containment belongs only at 560px (gate change 7). **Is that argument sound,
   and is the resulting gate still adequate?** If `:167` can never fail, is
   leaving it in place with a label the right call, or should it be removed?

2. **`deadZone = 0` was downgraded from an absolute to a comparative claim.** r7
   now enumerates two bare regions (narrow `notice` band; scrollbar gutter) and
   argues both are present identically in the shipped build, so the change adds
   no transparent area. **Verify both regions against `probe-r6.log`'s baseline
   AND variant rows.** Is the comparative claim fully supported, or is there a
   third region neither the metric nor the enumeration catches?

3. **A second fixed hit-sample at y=296** was added because y=239 sits inside the
   shipped desktop wrapper and witnessed nothing there. Check the new table in
   the artifact against the log, cell by cell.

4. **The narrow clearance derivation was rebuilt** from "the controls are
   fixed-pixel chrome, so 2px covers subpixel rounding" rather than from a
   font-sensitivity ratio. Is that derivation correct, and is 2px genuinely
   enough given `overlap`'s strict comparison?

5. **Gate change 9** now includes `phase-1:340`'s "capped at 260px" sentence.
   Verify the drift description is complete.

6. **Gate change 7's containment half** is now labelled source-derived rather
   than measured. Is that labelling accurate, and is the cited basis sufficient?

## Anchors

`src/ui/app.css` (`:1237-1253`, `:1269`, `:1278-1290`, `:1566-1583`, `:1586-1597`);
`scripts/extraction-panel-browser-check.mjs` (`:53`, `:122`, `:138`, `:141-143`,
`:148`, `:150-155`, `:163-171`, `:326-338`, `pointerFocusControl` `:47-93`);
`src/ui/extraction-panel-browser-harness.tsx`;
`features/panel-room/probe-r6.mjs` + `probe-r6.log`;
`features/extraction-planning/phase-1/brainstorm-spec.md:338-342`;
`features/extraction-planning/phase-2/completion-report.md:45-47`;
`node_modules/@xyflow/react/dist/style.css` + `dist/esm/index.js` — **`rg` skips
`node_modules`; use `rg --no-ignore` or Read directly.**

Epic #136: gate **re-derived, not re-baselined**; #134 is **layout only**.

## Also check

- Every number the artifact quotes, against `probe-r6.log`. The author has
  miscounted in two of the last four revisions.
- That the probe and its log are in sync (the probe was edited this round).
- For each proposed gate assertion, the world-state that makes it FAIL.

## Verdict contract

Return exactly one of `APPROVED` / `APPROVED_WITH_NITS` / `NEEDS_REWORK` /
`BLOCKED` **in your final message**, with severity-tagged findings citing
verified source. If a nested check does not report, state the finding anyway
marked unconfirmed and source-derived — do not withhold it and do not wait.

**Approve if a determined attack finds nothing real.** Six rounds is neither a
reason to manufacture a seventh finding nor a reason to wave this through. The
recurring failure here has been claims that are true but supported by evidence
that does not support them — weight that class heavily, and say so plainly if
you find another.
