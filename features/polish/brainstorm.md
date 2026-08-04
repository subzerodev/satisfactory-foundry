# Stage 5 brainstorm — the polish batch (ticket #14)

Date: 2026-08-04
Status: v5 FROZEN — correctness converged (r3); simplify dispositioned
Inputs: the pinned item list (#14 pickup audit), live src/ui (Schematic.tsx
native `<title>` at :94/:124; App.tsx re-upload `<input type="file">` at
:146; UploadScreen.tsx; app.css `:root` variable palette at :1; colors.ts;
Blueprint.tsx lane rendering; layout.ts LaneTrack labels), the S4-recorded
pipes-distinction deferral, the S3P2-declined cycle indicator.

## Already settled — do NOT re-litigate

1. Sequential directive; all-Claude roster; opus implementer; batch
   boundary review (one cumulative gate per the #14 ticket, not per-item).
2. The pinned item list (pickup audit): tooltips, drag-drop upload, dark
   mode, large-N labels + pipes distinction. Cycle indicator stays
   DECLINED.
3. Core/layout/state purity boundaries; UI-thin discipline; no jsdom.
4. All items are presentation-layer: NO store fields except where a
   preference must persist (dark mode — argued below); NO core/, layout/,
   or state/ changes at all (r1: the decluttering sub-item that would
   have touched ui/layout.ts was dropped as already-implemented).

## Item 1 — Styled tooltips (schematic)

- Replace the two native `<title>` usages (bus segments :94, belt arrows
  :124) with a shared `.tooltip` div: component-local `useState<{text,
  x, y} | null>` in Schematic, set on `onMouseEnter/onMouseMove`
  (positioned from the mouse event, clamped to the container), cleared
  on `onMouseLeave`. Pure presentation; the EXISTING label strings
  (seg.peakFlow titles, beltLabel) move verbatim into the tooltip text —
  zero wording changes (test impact per the r1 fold below).
- No library; one absolutely-positioned div + CSS. Keyboard/touch: out
  of scope (hover-only parity with today's native titles — honest).
  CSS-only :hover was considered and REJECTED (simplify fold): the
  tooltips anchor to SVG line children, which have no positioned HTML
  ancestor for pseudo-element tooltips, and segment tooltips must track
  the cursor along a long bus.
- **Testing correction (r1+r2 folds — THREE title-sourced smoke rows
  break, not two):** the label strings live only inside static `<title>`
  markup today. Affected rows enumerated exhaustively (r2): smoke:155
  (the beltLabel feed string, from the belt-arrow title at :124) is
  DELETED — its coverage already exists verbatim at format.test.ts:54-56;
  smoke:156 and :177 (bus-segment strings) are REWRITTEN as
  function-level assertions on the exported `segTooltip(seg, …)` (new
  export alongside the already-tested `beltLabel`), and the segTooltip
  test CONSUMES A REAL-SOLVE seg (r2 adversarial note — the layout-level
  peakFlow pin at layout.test.ts:85-94 holds the data invariant; feeding
  a real solve keeps the render-binding half meaningful). One new smoke
  row asserts no `<title>` element remains in the schematic markup.

## Item 2 — Drag-and-drop Docs.json upload

- A window-level drag surface: `dragover`/`drop` listeners registered by
  App (the sole store importer) in a `useEffect` (dragover calls
  preventDefault — required for drop to fire); a drop with a file routes
  through the EXISTING decode path — **`decodeBytes(new Uint8Array(await
  file.arrayBuffer()))` then `uploadDocsText`, exactly the two file
  inputs' pipeline (App.tsx:133, UploadScreen.tsx:24). NEVER
  `file.text()` (r1 fold — the adversarial caught it: text() decodes
  UTF-8 unconditionally and would garble the real UTF-16LE Docs.json;
  decode.ts exists precisely to BOM-sniff).** The DECODE is EXTRACTED
  into a shared helper with a decode-and-delegate shape — e.g.
  `fileToDocsText(file) → Promise<string>`, each site supplying its own
  upload sink (App/drop → uploadDocsText; UploadScreen → its existing
  onUpload prop, staying store-free — r3 fold: a one-arg
  readAndUpload-that-calls-the-store would breach the sole-store-importer
  pin). All three sites — App's re-upload input, UploadScreen's input,
  and the drop handler — consume it (r2 fold: two verbatim inline copies
  exist today; a third would be drift, so the batch consolidates). The #5
  treatment and all error surfaces are then genuinely unchanged.
- Visual affordance: a `.drop-overlay` ("Drop Docs.json to load") shown
  while a file drag is over the window (dragenter/dragleave counter —
  the flicker-free idiom), on BOTH the upload screen and the ready
  surface. **The overlay is affordance-only (simplify fold): drop
  functions without it — the spec may drop it cheaply if the round runs
  hot.** (Re-upload works today via the header input; drop = same
  semantics.)
- Non-file drags ignored; multiple files → first file (matching the
  input's single-file posture).

## Item 3 — Dark mode

- The palette already flows through `:root` CSS variables (app.css:1) —
  dark mode = a second variable block. Mechanism:
  `:root[data-theme="dark"] { …overrides… }` + a
  `@media (prefers-color-scheme: dark)` block applying the same
  overrides when NO explicit choice is set.
- Manual toggle (a ☾/☀ button in the header) — justified over
  media-query-only (simplify fold): long planning sessions want an
  app-level choice independent of the OS setting (dark factory
  planning on a light desktop and vice versa); a dark mode without an
  in-app switch fails the polish item's intent. Three-state is
  over-design — the toggle flips between explicit "light"/"dark",
  initialized from the media query, persisted in `localStorage`
  DIRECTLY (a UI preference, not app state: no store field, no zustand
  persist — the store's persistence is for solver-relevant state
  (tiers); theme never affects a solve. Precedent: view toggle is
  component-local; theme additionally persists, and localStorage-direct
  is the minimal honest home).
- SVG surfaces (Schematic, Blueprint) already use palette vars/classes —
  the dark block restyles them for free; colors.ts belt-capacity colors
  are data-driven fills that stay as-is (readable on both; the walk
  verifies).
- React Flow: the canvas gets `colorMode` — VERIFIED in the installed
  12.11.2 types (component-props.d.ts:634-636, ColorMode =
  "system"|"light"|"dark"; r1 fold — hedge dropped). GraphCanvas takes
  ZERO props today (fully store-wired); the theme becomes its first
  prop, passed by App from the same theme state.
- CSS cascade note for the spec stage (r1): the media-query fallback
  must be guarded `:root:not([data-theme])` — a bare @media block plus
  the data-theme block would both apply and leave the outcome to
  cascade order.

## Item 4 — Pipes distinction (large-N decluttering DROPPED — r1 fold)

- **Large-N decluttering is ALREADY IMPLEMENTED (r1 grounding
  correction, both reviewers):** ui/layout.ts:136-147 computes
  `labelStep` (ceil rule, labelPitch 20) with endpoint inclusion
  (`i === 1 || i === N || i % labelStep === 0`), rendered conditionally
  by Schematic and pinned by layout.test.ts:104-111. The v1 premise
  ("today every machine gets a label") was false. The item is REMOVED
  from this batch; the browser walk verifies the shipped rule visually
  at N=100 and N=2000, and if it shows a genuine readability defect, a
  refinement gets ITS OWN ticket with the layout.test.ts change
  enumerated — never a silent churn of a tested invariant.
- **Pipes distinction** (the S4 deferral — verified genuinely NOT done:
  no pipe-lane styling exists in colors.ts/Legend/app.css): schematic
  lane tracks and blueprint buses for `kind === "pipe"` get a distinct
  treatment — CSS class (`.lane-pipe` / `.bp-bus-pipe`), desaturated
  blue with a dashed edge (exact styling implementer discretion, per
  the S4P2 precedent). Schematic already knows lane kind. Blueprint
  reads `solve.feeds[f].kind` / `solve.outputs[o].kind` for the CLASS
  only — a deliberate, narrow exception to the frozen S4P2 pin
  "Blueprint … never re-reads kind (its only use of solve is as the
  layoutStage input)" (features/physical-layout/phase-2/brainstorm.md,
  Axis 2 lane-labels bullet — r1 fold: the superseded text is now
  CITED); label-string ownership stays with App unchanged.

## Testing posture

- Tooltips: smoke:155 DELETED (covered at format.test.ts:54-56);
  smoke:156/:177 REWRITTEN as segTooltip function-level assertions fed a
  real solve (r2); one new row asserts no `<title>` remains.
- Drag-drop: `fileFromDrop(dataTransfer) → File | null` node-tested with
  a stub shape; the shared `readAndUpload` helper is the consolidation of
  an already-tested pipeline (its decode is decode.test.ts territory,
  already covered — the helper adds routing, not logic).
- Dark mode: `resolveInitialTheme(stored, mediaDark) → "light"|"dark"`
  table-tested; CSS untestable headless (walk).
- Pipes: class presence in smoke rows (schematic + blueprint fixtures
  with a pipe lane).
- Browser walk: hover tooltips, drop a REAL UTF-16LE Docs.json, toggle
  dark mode (canvas + SVGs legible), the SHIPPED labelStep rule at
  N=100/2000 (verification, not new work), pipe recipe distinct in both
  views.

## Assumptions ledger

1. Native-title sites exactly two (Schematic.tsx:94,:124) — grounded.
2. The upload path accepts text and owns all validation (uploadDocsText;
   file inputs at App.tsx:146 + UploadScreen) — grounded.
3. The palette is fully variable-driven at :root (app.css:1) — grounded;
   any hardcoded color found at implementation gets migrated INTO a
   variable as part of item 3 (in-scope, enumerated in the diff).
4. RF12 ReactFlow accepts a colorMode prop — grounded (RF12 release
   notes/docs; the implementer verifies the exact prop name against the
   installed 12.11.2 types before use).
5. ui/layout.ts is UI-side view math (not the src/layout package) —
   grounded; its existing tests live in src/ui/layout.test.ts.

## Revision history

- **r1 correctness (2026-08-04):** code-reviewer NEEDS_REWORK (1 BLOCKER
  + 2 IMPORTANT + 3 NIT); adversarial NEEDS_REWORK (2 HIGH + 1 MEDIUM).
  Folded in v2:
  1. **Large-N decluttering DROPPED** (the BLOCKER, found independently
     by both): ui/layout.ts already ships labelStep with endpoint
     inclusion, tested — the v1 premise was false. The walk verifies the
     shipped rule; any refinement becomes its own ticket.
  2. **Drag-drop decodes via decodeBytes/arrayBuffer** (adversarial
     HIGH): file.text() would garble UTF-16LE Docs.json — the drop
     handler now routes the existing BOM-sniffing pipeline verbatim.
  3. **Tooltip testing redesigned** (adversarial HIGH): the two
     title-markup smoke rows are enumerated as REWRITTEN to
     function-level assertions on exported tooltip-text functions; the
     self-contradiction (keep-passing + no-title) resolved.
  4. **Kind-exception now CITES the frozen S4P2 text it supersedes**
     (code-reviewer IMPORTANT).
  5. colorMode hedge dropped (verified in installed types); GraphCanvas
     zero-props prose cleaned; :root:not([data-theme]) cascade guard
     noted for spec stage.
  Refuted-and-held r1: pipes distinction genuinely not done; RF
  colorMode grounded; localStorage-direct theme coherent; no existing
  dark CSS.
- **r2 correctness (2026-08-04):** code-reviewer NEEDS_REWORK (1
  IMPORTANT); adversarial APPROVED (2 spec-stage notes). Folded in v3:
  1. **Three affected smoke rows, not two** (code-reviewer): :155
     (beltLabel string) DELETED with coverage cited at
     format.test.ts:54-56; :156/:177 rewritten.
  2. **segTooltip's test consumes a real-solve seg** (adversarial note —
     keeps the render-binding pin meaningful; the data pin already lives
     at layout.test.ts:85-94).
  3. **Shared readAndUpload(file) helper pinned** (adversarial note —
     consolidates the two existing inline decode copies + the new drop
     site; three copies would be drift).
  Refuted-and-held r2: N=2000 walk genuinely reachable (no input max, no
  store ceiling); the S4P2 kind-quote verbatim-faithful; large-N drop
  clean with no residuals.
- **r3 correctness (2026-08-04): CONVERGED** — code-reviewer APPROVED
  (0); adversarial APPROVED (0 defects, 1 note). Folded in v4: the
  shared helper pinned as decode-and-delegate (fileToDocsText + per-site
  sinks) so UploadScreen keeps its onUpload prop and never imports the
  store. Refuted-and-held r3: the :155/format.test equivalence is
  non-coincidental (mirrored fixtures); no wording drift.
- **Simplify pass (2026-08-04, one-shot): APPROVED_WITH_NITS (3 NIT,
  all record-the-rejected-alternative prose).** Dispositions: all three
  FOLDED — the dark toggle's product justification stated (app-level
  choice independent of the OS; media-only fails the item's intent);
  the CSS-only tooltip rejection recorded (SVG anchoring + cursor
  tracking); the drop overlay marked affordance-only/droppable.
  Affirmed already-simple: fileToDocsText (de-dup of two verbatim
  copies), fileFromDrop (testable seam), resolveInitialTheme (2-input
  table function), the smoke enumeration (mandated set + one honest
  structural row). Prose-only folds — no correctness re-run.
- **v5 FROZEN (2026-08-04).**
