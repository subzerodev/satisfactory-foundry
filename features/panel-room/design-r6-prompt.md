# Design review r6 — #134 extraction panel room (Stage 23)

**Worktree (absolute):** `/home/subzerodev/workspace/satisfactory-foundry`
**Artifact under review:** `features/panel-room/brainstorm-spec.md` (design r6)
**Stage:** design (no production code written; no `src/` file modified)
**Ticket:** #134 · **Epic:** #136 · **Milestone:** 94 · **Tier:** 2

Sixth design round. **The shape has not changed since r5**, which both reviewers
confirmed sound — they rejected r5 for its *justifications*, two of which were
contradicted by the log r5 itself cited. r6 corrects those and re-splits the
clearance budget.

Verdict relays: #134 comments 24648 (r3), 24649 (r4), 24651 (r5). The artifact's
`## Revision history` records the disposition of every r5 finding, including one
**rejected with counter-evidence**. Hold me to all of it.

**What is already twice-verified and should not be re-derived from scratch
unless you think a predecessor was wrong:** the percentage basis
(`.react-flow`'s padding box is definite); the constants being derived rather
than fitted; the wrapper staying `min(content, cap)`; `:141-143` remaining
unmodified and armed; the completeness of the stack→wrapper rebinding; and the
probe's `none`/`visible` stand-in for deletion being faithful. Spend your effort
on what changed.

---

## A. What changed in r6 — the highest-value targets

1. **`deadZone` replaces r5's false reachability argument.** The artifact now
   claims `deadZone = 0` in all 24 rows proves there is no *transparent* wrapper
   area to swallow canvas clicks. Check `probe-r6.mjs`'s `deadZone` computation
   and its logged values. **Is `deadZone` measuring what the claim needs?**
   Specifically: does `wrapper.height − min(stack.height, wrapper.height)` capture
   every way transparent area could arise — padding, borders, the gap between
   stack children, a stack narrower than the wrapper (note the claim is about
   *area*, but the measure is one-dimensional)?

2. **The clearance re-split, 6px desktop / 2px narrow.** Justified by content
   being ~12× more font-sensitive than the furniture. Is that ratio defensible,
   and is 2px of clearance enough given the gate's `overlap` is strict? Is the
   asymmetry principled or is it fitted to make narrow's numbers work?

3. **New gate change 5 — the `scrollIntoView`-before-containment fix.** r5's
   reviewers found `:164`→`:167` forces `contained` true. r6 proposes capturing
   `contained` before the scroll. Verify the tautology claim at the cited lines,
   and verify the proposed fix actually cures it rather than relocating it again.

4. **Gate change 7's corrected failure witness.** r6 says the *containment* half
   fails on the shipped build and the *overflow* half passes today. Verify both
   halves against `probe-r6.log`'s baseline rows.

5. **The `H`-independence of the clearance**, promoted from a reviewer's finding
   into the design's own reasoning as the justification for `:141-143` needing no
   560px counterpart. Is that reasoning sound?

6. **The narrow full-width premise is now measured** (wrapper `x9..351` at 360px).
   Does that measurement actually establish that the controls are the binding
   furniture at narrow widths?

---

## B. Anchors

1. **`src/ui/app.css`** — `.graph-canvas` (`:1237-1253`), the wrapper rule
   (`:1278-1280`), `.graph-top-right-stack` (`:1282-1290`, gap at `:1286`), the
   `@media (max-width: 720px)` block (`:1566-1583`), `.graph-chain-power`
   (`:1586-1597`).
2. **`scripts/extraction-panel-browser-check.mjs`** — `:53`, `:122`, `:141-143`,
   `:148`, `:150-155`, `:163-171`, `:326-338`, and `pointerFocusControl`
   (`:47-93`).
3. **`src/ui/extraction-panel-browser-harness.tsx`** — geometry pins 340;
   interaction inherits 560.
4. **`node_modules/@xyflow/react/dist/style.css`** + **`dist/esm/index.js`**.
   **`rg` is gitignore-aware and silently skips `node_modules`** — use
   `rg --no-ignore` or Read directly.
5. **`features/panel-room/probe-r6.mjs`** + **`probe-r6.log`** — the current
   evidence. `probe-r4` / `probe-r5` are prior rounds, kept for comparison.
6. **`features/extraction-planning/phase-1/brainstorm-spec.md:338-342`** — the
   grounding citation that gate change 9 must update. Check that the drift is
   real and that change 9 describes it correctly.
7. **Issue #136** — gate **re-derived, not re-baselined**; #134 is **layout only**.

---

## C. Attack the probe

- **Do the numbers the artifact quotes exist in `probe-r6.log`?** Counts (24 rows
  / 12 contexts), clearances (2/6/11/106), caps (169/260), `deadZone=0`,
  `insideWrapper=false`, the `PURE-NOSCROLL` rows, the baseline `overflowing=false`
  rows. An author-side counting error has appeared in two of the last three
  revisions.
- **Is the fixed-point `newlyCovered` sample (y = 239) well chosen**, and does the
  artifact's account of what it shows match the log?
- **Do the three inertness guards plus the new `overscroll` guard leave a
  silent-no-op path?**
- **Is `PURE-NOSCROLL` a fair demonstration** that containment is assertable
  without scrolling, or does the probe reach a state the gate could not?
- **Does the probe's injected CSS still match the CSS the design proposes**, now
  that the narrow constant changed to 169?

---

## Verdict contract

Return exactly one of `APPROVED` / `APPROVED_WITH_NITS` / `NEEDS_REWORK` /
`BLOCKED`, with severity-tagged findings each citing verified source.

**Return the verdict token in your final message.** A previous reviewer on this
ticket returned a status update while its own sub-verifiers were still running,
and that nearly got read as a gate result. If a nested check does not report,
state the finding anyway, marked unconfirmed and source-derived — do not withhold
it and do not wait.

**Approve if a determined attack finds nothing real.** Five rounds of rework is
neither a reason to manufacture a sixth finding nor a reason to wave this
through. If something is right for the wrong reason, say so — that has been the
outcome of three consecutive rounds and is exactly what r6 exists to fix.
