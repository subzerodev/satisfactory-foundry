# Review request — #154 design (r1)

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/build-view-pan/brainstorm-spec.md` (uncommitted, v1)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `66f985a`)
**Stage:** first design review, Tier 2 (#154 — Michael's field report on the live release: the build view compresses instead of panning; the ruler is unexplained).

## A. Current-state anchors (verify against live source)

- `src/ui/layout.ts` — the pitch clamp + scrolled + width (:289-295), bandMode (:103-109), labeledSignificant/labelStep machinery, significant (un-gated, P3).
- `src/ui/Schematic.tsx` — the scroll container (:686), the Ruler's band/non-band label sources.
- `src/ui/Machines.tsx` — MachineBand usage (:102-142).
- `src/ui/Legend.tsx`, `app.css:693-700` (the scroll CSS).
- The tooltip plumbing in Schematic (pointer handlers on children — the grab-drag interaction risk surface).
- Decisions: #135 c24913 (the ruler — untouched by this), #154's scope; S12 P1's band decision (being superseded on Michael's directive — check the framing is honest).

## B. Claims to verify (the design's load-bearing spine)

1. **The root-cause arithmetic:** pitch floors at 8 for N in [92..114] WITHOUT scrolling (8·106=848<912) while N>114 scrolls at 8px; and with a 24px floor, N≤38 drawings are pixel-identical (floor(912/N) < 24 ⇔ N ≥ 39). Re-derive.
2. **The 24px choice:** does 24 genuinely separate 3-digit halo'd labels (measure the actual font/halo CSS), and does labelStep collapse to 1 at pitch ≥ 24 given labelPitch 20 (making the labelStep machinery dead as claimed)?
3. **The band-retirement blast radius:** grep `band|bandMode|labeledSignificant|labelStep|MachineBand` over src/ (source AND tests) — is the spec's deletion list complete, and does ANY consumer outside layout/Schematic/Machines read them (the ledger claims none — verify now, don't defer)? Does `significant` genuinely survive independent (the P3 ruler requirement)?
4. **The grab-drag design:** the Schematic container hosts hover tooltips on children (bus segments' onMouseEnter/Move) — does a pointerdown-drag on the background conflict with child interactions or text selection; is the 4px suppress-click threshold + background-only start the right minimal shape; anything in the existing codebase (Blueprint zoom? GraphCanvas?) that should be reused instead of a new hook (reuse-first)?
5. **The scrolled-semantics simplification** (`pitch·N > USABLE`) — equivalent to the old form under the new floor at every N? Any consumer of `scrolled`/`width` that changes behaviour (smoke pins on width 960 at mid N)?
6. **Width blowup sanity:** at very large N (say 1000 machines), width = 24·1000 ≈ 24k px — any SVG/browser limit or perf concern the design should bound (maxPitch interplay; does the drawing stay usable, or does the design need a cap it doesn't have)?
7. **The sweep enumeration** — re-grep the named pins (band threshold describes, the P3 flip pin surviving, labeledSignificant pins, ×161 smoke pins, literal 8/114 assertions) and hunt for missed ones (derived values of 912/8, the p2/p3 test fixtures keyed to pitch 8 at N=106 — the P2 collision-rule fixtures used 8px stretches!).
8. **Decision conformance:** the ruler itself (c24913) untouched; the S12 P1 supersession framed as Michael's-directive-supersedes, not silently.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
