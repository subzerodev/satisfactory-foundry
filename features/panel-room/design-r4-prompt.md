# Design review r4 — #134 extraction panel room (Stage 23)

**Worktree (absolute):** `/home/subzerodev/workspace/satisfactory-foundry`
**Artifact under review:** `features/panel-room/brainstorm-spec.md` (design r4)
**Stage:** design (no production code has been written; no `src/` file is modified)
**Ticket:** #134 · **Epic:** #136 · **Milestone:** 94 · **Tier:** 2

This is the **fourth** design round. r1, r2 and r3 each returned `NEEDS_REWORK`
from both reviewers. The r3 verdicts are relayed in full on #134 (comment 24648)
and their dispositions are recorded in the artifact's `## Revision history` —
read that section, and hold me to it.

**The single recurring failure across r1–r3: a layout claim asserted from CSS
source rather than measured.** r4's response is a checked-in CDP probe. Your most
valuable contribution is to attack the probe as hard as the prose.

---

## A. Current-state anchors (verify against these — take nothing on my word)

All paths relative to the worktree root.

1. **`src/ui/app.css`** — the rules the design changes:
   - `.graph-canvas` (`box-sizing: border-box`, `height: 560px`, `min-height: 340px`, `max-height: 85vh`, `resize: vertical`, `border: 1px`, `overflow: hidden`).
   - `.graph-canvas .react-flow__panel.top.right` — currently `max-width` only.
   - `.graph-top-right-stack` — `max-height: 260px`, `overflow-y: auto`, `overscroll-behavior: contain`.
   - the `@media (max-width: 720px)` block — `top: 48px; right: 8px; left: 8px; max-width: none; margin: 0` on the wrapper, `width: 100%; max-height: 170px` on the stack.

2. **`scripts/extraction-panel-browser-check.mjs`** — the checked-in gate. Note
   especially that `const stack = document.querySelector('.react-flow__panel.top.right')`
   binds a variable named `stack` to the **wrapper**, and that `pointerFocusControl`
   calls `scrollIntoView` before measuring containment.

3. **`src/ui/extraction-panel-browser-harness.tsx`** — geometry mode pins the
   canvas to 340 inline; interaction mode does not, so it inherits 560.

4. **`node_modules/@xyflow/react/dist/style.css`** and **`.../dist/esm/index.js`**
   — the panel margin/z-index rules and the runtime `wrapperStyle`.
   **`rg` is gitignore-aware and silently skips `node_modules`** — an r1 failure.
   Use `rg --no-ignore` or read the files directly.

5. **`features/panel-room/probe-r4.mjs`** and **`features/panel-room/probe-r4.log`**
   — the measurement the entire design rests on. See section C.

6. **Issue #136 (epic)** binds two constraints here: the gate must be
   **re-derived, not re-baselined** (new rows must prove the mix is reachable
   without scrolling, not record a smaller scroll distance); and #134 is
   **layout only** — no change to what the panel computes.

---

## B. The proposal

Three CSS rules (verbatim in the artifact's `## Design`): `bottom: 0` +
`pointer-events: none` on the wrapper; `max-height: calc(100% - 42px)` +
`pointer-events: auto` on the stack; narrow overrides `bottom: 8px` and
`max-height: calc(100% - 111px)`. Plus six named gate changes.

Attack at least these, and anything you find yourself:

1. **Is `bottom` actually sufficient to make the wrapper's height definite** for
   the child's percentage `max-height` to resolve — and is that true across the
   browsers this project targets, or only in the probe's headless Chromium?
   The artifact claims a measurement; measurement in one engine is not a spec
   guarantee. Say plainly which it is.

2. **Are 42 and 111 derived or fitted?** The artifact gives a derivation
   (furniture inset minus the wrapper's own bottom inset) *and* a measurement.
   Check the derivation independently. Check it at canvas heights the probe never
   sampled — the canvas is user-resizable between 340 and 85vh.

3. **The gate rebinding is the riskiest change.** Gate change 1 re-points the
   collision assertions from the wrapper to `.graph-top-right-stack`. Is that a
   legitimate re-derivation, or is it re-baselining a gate to make a change pass —
   which #136 forbids? Argue it either way, but decide.

4. **For every proposed assertion, name the world-state that makes it FAIL.**
   Three consecutive rounds nominated an assertion that could not fail. The
   artifact now claims a failing state for each. Verify those claims; if any
   assertion is still a tautology, that is a BLOCKER.

5. **Does the pointer-events change belong in a layout-only ticket at all?** It is
   a behavioural change introduced to neutralise a behavioural regression the
   sizing causes. Is that the right call, or should the design avoid inflating the
   wrapper in the first place? If there is a shape that gets the room without a
   definite-height wrapper, name it.

6. **Known bounds.** The artifact concedes narrow clears by only 11px, that the
   `combined` state (430px) still scrolls at narrow, and that a short phone
   viewport still scrolls. Are those bounds correctly computed, and is any of them
   severe enough to reject the design rather than document it?

7. **Citation accuracy**, including every line in the Revision history.

---

## C. Attack the probe specifically

`features/panel-room/probe-r4.mjs` produced `probe-r4.log`. The design is only as
good as this instrument. Ask:

- **Does it measure what it claims?** It reports `wrapper` and `stack` separately,
  canvas-local. Check the selectors and the arithmetic in `measure`.
- **Could it produce a passing-looking log while the candidate CSS did nothing?**
  It has two inertness guards (max-height must change; wrapper `pointer-events`
  must change) and a hard liveness gate on the three mix inputs rendering. Are
  those sufficient, or is there a silent-no-op path left?
- **Is the hit-test valid?** It calls `elementFromPoint` at a point inside the
  wrapper and below the stack, and only when that gap exceeds 12px. Does that
  prove what the artifact says it proves?
- **Is the `SIZE-ONLY` control arm a fair control** — i.e. does it isolate the
  pointer-events rule, or does arm ordering contaminate it?
- **Does the probe's injected CSS actually match the CSS the design proposes?**
  A probe that tests a different rule set than the one shipping is the worst
  possible outcome here. Diff them literally.
- The probe drives the mix open by setting a `<select>` via the native value
  setter and dispatching `change`. Is that a faithful stand-in for a user
  interaction, or could it produce a panel state a real user never reaches?

---

## Verdict contract

Return exactly one of `APPROVED` / `APPROVED_WITH_NITS` / `NEEDS_REWORK` /
`BLOCKED`, with severity-tagged findings each citing verified source. Approve if a
determined attack finds nothing real — do not manufacture findings to justify a
fourth round. If a claim is right for the wrong reason, say so; that has happened
in every round of this ticket so far.
