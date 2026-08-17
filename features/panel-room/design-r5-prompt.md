# Design review r5 — #134 extraction panel room (Stage 23)

**Worktree (absolute):** `/home/subzerodev/workspace/satisfactory-foundry`
**Artifact under review:** `features/panel-room/brainstorm-spec.md` (design r5)
**Stage:** design (no production code written; no `src/` file modified)
**Ticket:** #134 · **Epic:** #136 · **Milestone:** 94 · **Tier:** 2

Fifth design round. r1–r3 were killed for asserting rendered layout from CSS
source. **r4 cleared both reviewers with zero BLOCKERs** but was rejected because
both reviewers, independently, observed that it never questioned its own premise:
it inflated the React Flow panel wrapper to a fixed height, which forced a
`pointer-events` rule and a rebinding of the browser gate's collision assertions.

**r5 adopts the alternative shape those reviewers proposed — and which both
explicitly flagged as CSS-derived and unmeasured — after measuring it.** Verdict
relays: #134 comments 24648 (r3) and 24649 (r4). The artifact's
`## Revision history` records the disposition of every r4 finding; hold me to it.

The prior round's artifacts are now committed (`git log` → `fb93c00`), so the
probes and logs are readable in-tree rather than untracked.

---

## A. Current-state anchors (verify against these)

1. **`src/ui/app.css`** — `.graph-canvas` (`:1237-1253`), the wrapper rule
   `.graph-canvas .react-flow__panel.top.right` (`:1278-1280`),
   `.graph-top-right-stack` (`:1282-1290`), `.extraction-panel` (`:1292+`), the
   `@media (max-width: 720px)` block (`:1566-1583`), `.graph-chain-power`
   (`:1586-1597`).
2. **`scripts/extraction-panel-browser-check.mjs`** — the checked-in gate. Note
   `:122` (binds `stack` to the wrapper), `:141-143` (the three collision
   assertions), `:148` (`content` → `.graph-top-right-stack`), `:150`, `:151-155`,
   `:163-171`, and `pointerFocusControl` at `:47-93` (especially the
   `scrollIntoView` at `:55` preceding the containment computation at `:63`).
3. **`src/ui/extraction-panel-browser-harness.tsx`** — geometry mode pins the
   canvas to 340; interaction mode inherits 560.
4. **`node_modules/@xyflow/react/dist/style.css`** + **`dist/esm/index.js`** —
   panel margin/z-index rules and the runtime `wrapperStyle`. **`rg` is
   gitignore-aware and silently skips `node_modules`** (an r1 failure) — use
   `rg --no-ignore` or Read directly.
5. **`features/panel-room/probe-r5.mjs`** + **`probe-r5.log`** — the measurement
   the design rests on. See section C. `probe-r4.mjs` / `probe-r4.log` are the
   previous round's, kept for comparison.
6. **Issue #136 (epic)** — the gate must be **re-derived, not re-baselined**, and
   #134 is **layout only**.

---

## B. The proposal

Cap the **wrapper** with `max-height: calc(100% - 78px)` (narrow: `173px`), move
`overflow-y: auto` / `overscroll-behavior: contain` from the stack up to the
wrapper, and delete the stack's `max-height`. The wrapper stays `height: auto`, so
it shrink-wraps to `min(content, cap)`. Plus seven named gate changes.

Attack at least these:

1. **Does the percentage on the wrapper genuinely resolve, and against what?**
   The design claims `.react-flow` is a definite-height basis. Check the
   containing-block rule for an absolutely positioned box, and check whether
   `100%` here means what the derivation assumes.

2. **Is the wrapper really still shrink-wrapped in every state**, or only in the
   ones the probe sampled? The whole argument that r5 avoids r4's regressions
   rests on this. Name a state that would break it if one exists.

3. **Are 78 and 173 derived or fitted?** The derivation is
   `top inset + furniture inset + 6px clearance − 2px border`. Re-derive
   independently, at canvas heights the probe never sampled.

4. **Is the 6px clearance the right call**, or does it spend margin the content
   needs? The design says narrow ends with 5px of content margin and calls the
   split deliberate. Is that the right split, and is 5px enough to ship?

5. **Gate change 4 and 5 move the scroll/clip box** from the stack to the wrapper
   across four sites. Is that complete? Is any remaining reference to
   `.graph-top-right-stack` in the gate now measuring the wrong box — or newly
   tautological because the stack is unclipped at full content height?

6. **For every proposed assertion, name the world-state that makes it FAIL.**
   Three rounds shipped an assertion that could not fail; r4 proposed a fourth
   (the dead content-exceeds-cap guard) and was caught. Verify each claim rather
   than accepting it. Pay particular attention to gate change 3's
   `min(content, expectedCap)` equality.

7. **Does r5 actually keep `:141-143` unmodified**, as it claims and as #136
   requires — or does some other change make them pass for a new reason?

8. **Citation accuracy**, including every line of the Revision history.

---

## C. Attack the probe specifically

`features/panel-room/probe-r5.mjs` → `probe-r5.log`. The design is only as good as
this instrument.

- **Does the injected CSS represent the CSS the design ships?** It cannot *delete*
  the stack's shipped `max-height` / `overflow-y`, so it overrides them with
  `none` / `visible` as a stand-in, and guards that the override computed. Is that
  substitution faithful, or does it differ observably from a real deletion?
- **Can the probe produce a healthy log while the candidate did nothing?** It has
  three inertness guards. Find the silent-no-op path they miss.
- **Are the clearance numbers meaningful?** `clearance.toControls` is a 1-D
  vertical measure; at desktop widths the controls are horizontally disjoint from
  the wrapper, so the number goes negative while `overlap` is correctly false.
  Does the artifact ever read that number as if it meant proximity?
- **Are the four `elementFromPoint` samples valid**, and does the artifact's
  scoping of them ("samples, not a proof of coverage") match what they support?
- **The probe drives the mix open** by setting a `<select>` via the native value
  setter plus a synthetic `change`. r4's reviewers accepted this as faithful and
  independently corroborated the 380px figure; re-check if you disagree.
- **Does the log actually support each number quoted in the artifact's results
  table and ledger?** Check the counts (24 rows / 12 contexts) and the clearance
  figures against the file.

---

## Verdict contract

Return exactly one of `APPROVED` / `APPROVED_WITH_NITS` / `NEEDS_REWORK` /
`BLOCKED`, with severity-tagged findings each citing verified source. **Approve if
a determined attack finds nothing real** — four rounds of rework is not a reason to
manufacture a fifth, nor a reason to wave this through. If a claim is right for
the wrong reason, say so; that has happened in every round of this ticket.
