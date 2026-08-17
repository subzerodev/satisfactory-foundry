# Design review r8 — #134 extraction panel room (Stage 23)

**Worktree (absolute):** `/home/subzerodev/workspace/satisfactory-foundry`
**Artifact:** `features/panel-room/brainstorm-spec.md` (design r8)
**Stage:** design (no `src/` file modified) · **Ticket:** #134 · **Epic:** #136

Eighth round. **The CSS has not changed since r5** and has now been confirmed
sound by four consecutive reviewer pairs. r8 responds to r7's verdicts
(#134 comments 24655 / 24656, detail 24657).

Committed as `5314b82`. `npm run check` clean, 1141 tests green, and the probe
was re-run: its edits are comments only and `probe-r6.log` regenerates
**byte-identical**.

## What is settled — do not re-derive unless you believe a predecessor erred

The percentage basis; the constants being derived not fitted; the wrapper staying
`min(content, cap)`; `:141-143` remaining unmodified and armed; the completeness
of the stack→wrapper rebinding; the probe's `none`/`visible` stand-in for
deletion; the K arithmetic; the thresholds (460 / 551 / ~649); the y=296 table;
and the narrow 2px clearance derivation. Four pairs have verified these, and r7's
pair re-confirmed each independently.

## What changed in r8 — spend your effort here

1. **Gate change 3 was rebound, not reworded.** r7's
   `min(wrapper.scrollHeight, expectedCap)` was shown to be an identity whenever
   the wrapper is at or under its cap — it passes in r4's exact regression. r8
   asserts `Math.abs(s.height - Math.min(rect(content).height, expectedCap))
   <= 0.5` and drops the `state !== 'notice'` guard. **Check the four-row
   world-state table cell by cell, and look for a fifth world-state it misses.**
   Does `rect(content).height` behave as claimed once the stack carries no
   `max-height` and no `overflow-y`? Is 0.5px still the right tolerance now that
   both terms are fractional?

2. **The no-transparent-area claim is now structural, not enumerative.** r6 used
   a metric, r7 used a list that was short by one. r8 argues from the diff: no
   element added or removed, no `background` set or cleared, no child
   width/padding/border/gap changed, therefore every background-less box in the
   variant has a baseline counterpart, and only the wrapper's height and the
   scrollbar's owner can differ. **Is that argument actually valid, and is its
   premise true of the diff?** Is there a third way the two arms can differ that
   the premise misses? The three regions are now labelled spot-checks rather than
   proof — check that the document is consistent about that everywhere it makes
   the claim (body, acceptance criteria, assumptions ledger).

3. **The scrollbar gutter was demoted from measured to derived** after checking
   the log: `probe-r6.mjs:119-120` records `wrapperScroll` only, so the stack's
   scroll state is never captured in either arm, and baseline `content=170/170` /
   `260/260` is the *wrapper* reporting `scrollHeight === clientHeight`. **Is the
   demotion correct, or is there a row that does witness it directly?** Also
   confirm the related correction: all six `overflowing=true` rows are `VARIANT-D`,
   so that correlation is within-arm.

4. **`avoidsChrome` at `:168` is now argued to be implied**, not a live
   fail-witness: after gate change 4, `visible` is the wrapper's rect, which is
   `s`; `contained` ⟹ `r ⊆ s`; `:141-143` ⟹ `s` disjoint from `t`/`ctl`/`p`.
   **Is that implication airtight?** Consider specifically that `s` is captured
   at `:129` *before* `:164`'s `scrollIntoView` while `visible` is captured after
   — can that scroll move the wrapper's viewport rect and break the implication?
   The document claims both halves are redundant and keeps the loop for a stated
   residual; judge whether the residual is real.

5. **Gate change 6 now states that `pointerFocusControl` is a second post-scroll
   containment guard**, whose viewport half (`r.left >= 0 && r.right <=
   innerWidth …`) stays armed after the rebind. Verify both halves of that
   characterisation against `check.mjs:53-68`.

6. **Gate change 9 now de-constantises both halves** (`H − 80` and `H − 171`)
   and cites `phase-1/brainstorm-spec.md:338-343`. Verify the range and that
   neither replacement smuggles in a new constant.

7. **Naming.** The document now asserts `check.mjs` has no identifier named
   `wrapper` (the wrapper element is the const `stack` at `:122`, its rect `s`;
   the stack is `content` at `:148`). Confirm, and confirm changes 3 and 4 name
   only identifiers that exist and would compile.

## Anchors

`src/ui/app.css` (`:1237-1253`, `:1267-1276`, `:1278-1290`, `:1292-1294`,
`:1566-1583`, `:1586-1597`);
`scripts/extraction-panel-browser-check.mjs` (`:47-93`, `:122`, `:129`, `:138`,
`:141-143`, `:148`, `:150-155`, `:163-171`, `:326-338`);
`src/ui/extraction-panel-browser-harness.tsx`;
`features/panel-room/probe-r6.mjs` + `probe-r6.log`;
`features/extraction-planning/phase-1/brainstorm-spec.md:338-343`;
`features/extraction-planning/phase-2/completion-report.md:45-47`;
`node_modules/@xyflow/react/dist/style.css` + `dist/esm/index.js` — **`rg` skips
`node_modules`; use `rg --no-ignore` or Read directly.**

Epic #136: gate **re-derived, not re-baselined**; #134 is **layout only**.

## Also check

- Every number the artifact quotes, against `probe-r6.log`. The author has
  miscounted in three of the last five revisions.
- **Every claim labelled "measured".** Two rounds running, a claim that was true
  carried a "measured" label it had not earned. Check the label, not just the
  claim.
- For each proposed gate assertion, the world-state that makes it FAIL — and
  whether that world-state can actually occur in the mode the assertion runs in.
  `geometryCheck` runs only at a pinned 340px canvas; the interaction loop runs
  only at 560px. Evidence from one does not support a claim about the other.
- Any remaining absolute ("every", "no", "only", "cannot", "exhaustive") that is
  broader than what its evidence supports.

## Verdict contract

Return exactly one of `APPROVED` / `APPROVED_WITH_NITS` / `NEEDS_REWORK` /
`BLOCKED` **in your final message**, with severity-tagged findings citing
verified source. If a nested check does not report, state the finding anyway
marked unconfirmed and source-derived — do not withhold it and do not wait.

**Approve if a determined attack finds nothing real.** Seven rounds is neither a
reason to manufacture an eighth finding nor a reason to wave this through. The
recurring failure here has been claims that are true but supported by evidence
that does not support them — weight that class heavily, and say so plainly if you
find another. If the remaining findings are all cosmetic, say so and approve;
this design has been blocked twice on defects that were real and six times on
prose.
