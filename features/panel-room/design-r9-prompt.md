# Design review r9 — #134 extraction panel room (Stage 23)

**Worktree (absolute):** `/home/subzerodev/workspace/satisfactory-foundry`
**Artifact:** `features/panel-room/brainstorm-spec.md` (design r9)
**Stage:** design (no `src/` file modified) · **Ticket:** #134 · **Epic:** #136

Ninth round, and **the artifact is a different shape than r8's.** On Michael's
decision (#134 comment 24661) it was cut from ~610 lines to ~343: the
round-by-round narration, the per-finding fold entries and the "error, recorded"
asides are gone. What remains is the specification — CSS, gate changes, measured
results, thresholds, acceptance criteria, assumptions ledger, one-line history.

Committed as `95a75cf`. `npm run check` clean, 1141 tests green. The probe was
**not** touched this round, so `probe-r6.log` remains in sync with
`probe-r6.mjs`.

**Why it was cut, because it should shape your review.** Eight rounds produced
zero findings against the three-line CSS change and roughly sixty against the
prose arguing for it. Five consecutive pairs confirmed the design. Each of the
last two repair rounds *introduced* new defects of the same class — a claim that
is true, cited to evidence that does not support it. The cut is a deliberate
reduction of claim surface.

## What this means for your review

**Judge the artifact that exists, not the one that was deleted.** Do not ask for
restored justification, narrative, or per-finding history — those were removed on
purpose and live in the #134 audit trail. A finding of the form "this claim is no
longer explained" is only valid if the missing explanation is needed to *build or
verify* the change correctly.

**Do apply full rigour to what remains.** Every retained claim is fair game, and
the recurring failure class is unchanged: check that each claim's cited evidence
actually supports it, and that measurements come from the world the claim is
about (`geometryCheck` runs only at a pinned 340px canvas; the interaction loop
only at 560px).

## Spend your effort here

1. **The transparent-area argument** (§ Transparent area, and the ledger row).
   Its premise is now scoped to *declarations* — "adds, removes or alters no
   width, padding, border or gap **declaration** on any child" — with rendered
   geometry explicitly allowed to differ through two named mechanisms. r8's
   version said the scrollbar "moves owner, not position", which the log
   falsified at 560px. **Is the rewritten version true, and is the
   declaration/rendered-geometry distinction doing honest work or hiding a gap?**
   Check the 340px and 560px spans it quotes against `probe-r6.log`.

2. **Gate change 3.** The assertion is
   `Math.abs(s.height - Math.min(rect(content).height, expectedCap)) <= 0.5` with
   the `state !== 'notice'` guard dropped. Verify the five-row world-state table
   cell by cell, including the new "stack cap not deleted" row. Is the
   `scrollHeight` rejection argument correct? Is the `content` non-null claim
   right (`check.mjs:151`, `GraphCanvas.tsx:283`)?

3. **Gate change 5.** r8 claimed `contained` at `:167` was "forced true" and then
   kept the loop because it can fire — a contradiction code-reviewer caught. r9
   states only the residual: `block:'nearest'` scrolls minimally, so a control
   larger than the scrollport leaves an edge outside and `:167` fires. **Is that
   now internally consistent, and is `avoidsChrome`'s characterisation as the
   weaker half correct?**

4. **Gate change 9 — doc drift.** It now names two files:
   `phase-1/brainstorm-spec.md:338-343` and `phase-2/brainstorm-spec.md:134-136`,
   and lists the hits it deliberately leaves alone (`FEATURE.md:211`,
   `phase-1:541-544`, `phase-1/implementation-plan.md:233`). **Sweep for a
   fifth.** Confirm the exclusions really are historical rather than normative,
   and that neither rewrite substitutes a new constant for an old one.

5. **Every remaining "Measured" label** in the ledger and body. Two rounds
   running, a true claim carried a label it had not earned (r7: the scrollbar
   gutter; r8: `.extraction-panel`'s 340px, and a fabricated "in both arms"
   citation). Check the label, not just the claim.

6. **Anything the cut broke.** A dangling cross-reference, a figure whose
   derivation left with the prose, a claim that now rests on nothing. This is the
   most likely class of new defect this round.

## Anchors

`src/ui/app.css` (`:1237-1253`, `:1267-1276`, `:1278-1290`, `:1292-1294`,
`:1566-1583`, `:1586-1597`);
`scripts/extraction-panel-browser-check.mjs` (`:47-93`, `:122`, `:129`, `:138`,
`:141-143`, `:148`, `:150-155`, `:163-171`, `:326-338`);
`src/ui/GraphCanvas.tsx`; `src/ui/extraction-panel-browser-harness.tsx`;
`features/panel-room/probe-r6.mjs` + `probe-r6.log`;
`features/extraction-planning/phase-1/brainstorm-spec.md:338-343`;
`features/extraction-planning/phase-2/brainstorm-spec.md:134-136`;
`features/extraction-planning/phase-2/completion-report.md:45-47`;
`node_modules/@xyflow/react/dist/style.css` + `dist/esm/index.js` — **`rg` skips
`node_modules`; use `rg --no-ignore` or Read directly.**

Epic #136: gate **re-derived, not re-baselined**; #134 is **layout only**.

## Verdict contract

Return exactly one of `APPROVED` / `APPROVED_WITH_NITS` / `NEEDS_REWORK` /
`BLOCKED` **in your final message**, with severity-tagged findings citing
verified source. If a nested check does not report, state the finding anyway
marked unconfirmed and source-derived — do not withhold it and do not wait.

**Approve if a determined attack finds nothing real.** Eight rounds is neither a
reason to manufacture a ninth finding nor a reason to wave this through. Be
explicit about severity: if what you find is cosmetic, say so and approve rather
than reaching for `NEEDS_REWORK`. This design has been blocked twice on defects
that were real and six times on prose, and the prose has now been deliberately
reduced.
