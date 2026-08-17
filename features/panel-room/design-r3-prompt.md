# Design review r3 — #134 extraction panel room (Stage 23)

**Worktree (absolute):** `/home/subzerodev/workspace/satisfactory-foundry`
**Artifact under review:** `features/panel-room/brainstorm-spec.md` (design r3)
**Stage:** design (no code has been written yet)
**Ticket:** #134 · **Epic:** #136 · **Milestone:** 94 · **Tier:** 2

This is the **third** design round. r1 and r2 both returned `NEEDS_REWORK` from
both reviewers. r3 is a rewrite, not a patch. Read the artifact in full, then
verify every claim in it against live source in the worktree.

---

## A. Current-state anchors (verify the artifact against these — do not take my word for any of it)

Read these yourself. Every path below is relative to the worktree root.

1. **`src/ui/app.css`** — the rules the design proposes to change:
   - `.graph-canvas` sets `height: 560px; min-height: 340px; max-height: 85vh; resize: vertical; overflow: hidden`.
   - `.graph-canvas .react-flow__panel.top.right` sets only `max-width: min(360px, calc(100% - 32px))`.
   - `.graph-top-right-stack` sets `box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; max-height: 260px; overflow-y: auto; overscroll-behavior: contain`.
   - `.extraction-panel` sets `width: 340px; max-width: 100%`, no height.
   - The `@media (max-width: 720px)` block overrides `.react-flow__panel.top.right` with `top: 48px; right: 8px; left: 8px; max-width: none; margin: 0`, and `.graph-top-right-stack` with `width: 100%; max-height: 170px`.

2. **`scripts/extraction-panel-browser-check.mjs`** — the checked-in browser gate.
   The `geometryCheck` string holds the assertions; `main()` runs a **geometry**
   loop (widths 360/720/1280 × states notice/extraction/combined) and an
   **interaction** loop (widths 360/720/1280). Pay attention to:
   - the three `overlap(...)` collision assertions (stack vs top-left controls, vs bottom-left `.react-flow__controls`, vs bottom-right `.graph-chain-power` panel);
   - `const expectedCap = innerWidth <= 720 ? 170 : 260;`
   - the `scrollable` computation and the assertion `state !== 'notice' && !scrollable` → `'expanded extraction stack is not internally scrollable'`;
   - the assertion `Math.abs(s.height - expectedCap) > 0.5` → `'expanded extraction stack does not reach its responsive height cap'`;
   - `Math.abs(c.height - 340) > 0.5` → `'canvas height is not 340px'`;
   - `pointerFocusControl()` — it calls `scrollIntoView` **before** measuring, and reports `scrollTop` of `.graph-top-right-stack` **after** that scroll. The interaction loop's PASS line prints `extractor scroll N, toggle N, Pure N` from those measurements.
   - the interaction loop navigates with viewport height **700**; the geometry loop uses the default **520**.

3. **`src/ui/extraction-panel-browser-harness.tsx`** — geometry mode pins the
   canvas inline to `height: 340, minHeight: 340, maxHeight: 340`; interaction
   mode does **not** pin it, so it inherits `.graph-canvas`'s CSS height.

4. **`features/extraction-planning/phase-1/brainstorm-spec.md`** and
   **`features/extraction-planning/phase-1/r2-verification.log`** — the artifact
   claims these show *why* the 260/170 caps exist (canvas furniture collision).
   Verify that claim; the artifact's whole diagnosis rests on it.

5. **`node_modules/@xyflow/react/dist/esm/index.js`** — the artifact claims React
   Flow applies `position: relative; height: 100%` to `.react-flow` at runtime
   from an inline style constant. **`rg` skips `node_modules` by default** (a
   documented failure from r1); use `rg --no-ignore` or read the file directly.

6. **Issue #136 (the epic) records two binding decisions and a set of
   constraints.** The ones that bind this ticket:
   - *"#134 must not simply re-baseline its gate. `scripts/extraction-panel-browser-check.mjs` currently asserts the Pure input needs 112px of scrolling — it encodes the defect as expected behaviour. New rows must prove the mix controls are reachable without scrolling, not record a new scroll distance."*
   - Out of scope: any change to what the panel computes. Layout only.

---

## B. What to verify in the artifact

Read `features/panel-room/brainstorm-spec.md`. It proposes:

- `.extraction-panel` gains `height: calc(100% - 30px)`;
- `.graph-top-right-stack`'s `max-height: 260px` becomes `calc(100% - 74px)`;
- the narrow-screen `max-height: 170px` becomes `calc(100% - 169px)`;
- `overflow-y: auto` and `overscroll-behavior: contain` stay on the stack;
- a set of named gate changes.

Specific things worth your scepticism, in addition to anything you find yourself:

1. **Does the design actually resolve?** The artifact says a percentage
   `max-height` on the stack only resolves if the panel has a definite height,
   and reports a runtime probe (variant A vs variant B) to settle it. Is the
   reasoning about CSS percentage-height resolution correct for **this** box tree
   (`.graph-canvas` → `.react-flow` → `.react-flow__panel.top.right` →
   `.graph-top-right-stack` → `.extraction-panel`)? Note the artifact's own r1/r2
   history: three readers previously got this chain wrong from CSS alone.

2. **Are the magic numbers derived or fitted?** `- 74px`, `- 169px`, `- 30px`.
   The artifact derives 74 and 169 from measured furniture positions and claims
   the formula reproduces the existing 260/170 caps at a 340px canvas. Check the
   arithmetic and check whether the derivation holds at canvas heights **other
   than** 340 and 560 — the canvas is user-resizable between `min-height: 340px`
   and `max-height: 85vh`, so intermediate and much larger heights are reachable.
   Where does `- 30px` come from, and is it justified anywhere?

3. **Does the proposed gate change prove the fix, or merely permit it?** For each
   proposed assertion, ask: *what state of the world would make this FAIL?* The
   artifact concedes r1 and r2 both nominated an assertion that could not fail.
   In particular, if the percentage cap silently computed to `none` (the design's
   own named failure mode), which proposed assertion would catch it, and at which
   canvas height?

4. **Is the interaction-loop gate row well-founded?** It is proposed at a real
   560px canvas. The artifact's assumptions ledger flags one open item: content
   height 380px was measured in `?mode=geometry` only, never confirmed in
   `?mode=interaction`. Is anything else in the design load-bearing on a number
   measured in the wrong mode?

5. **Citation accuracy.** Verify every file:line citation in the artifact
   resolves to what it claims — including the ones in the assumptions ledger and
   in the "what r1 and r2 got wrong" section. At least one citation in the
   artifact names a file that may not contain the cited line.

6. **Scope and the epic's constraints.** Does the design stay layout-only? Does
   it re-litigate anything already settled? Does it satisfy #136's "prove
   reachable without scrolling, do not re-baseline" constraint, or does it
   quietly re-baseline?

7. **The narrow-screen case.** The narrow rule repositions the panel
   (`top: 48px`, `left/right: 8px`, `margin: 0`). r1 was caught assuming the
   desktop inset applied there. Does r3 handle narrow correctly, including the
   `-169px` derivation and whether the mix is reachable on a phone-height
   viewport?

---

## Verdict contract

Return exactly one of `APPROVED` / `APPROVED_WITH_NITS` / `NEEDS_REWORK` /
`BLOCKED`, with severity-tagged findings, each citing the source you verified it
against. If you find nothing real, approve — do not manufacture findings. If a
claim in the artifact is right for the wrong reason, say so; that has already
happened twice on this ticket.
