# Review request — #152 P2 design (r2)

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/game-mechanics-rework/p2-brainstorm-spec.md` (uncommitted, r2)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `88a87d2`)
**Stage:** design re-review after fold. r1 verdicts: code-reviewer NEEDS_REWORK (2 IMPORTANT + 3 NITs), adversarial NEEDS_REWORK (2 HIGH + 2 MEDIUM + 2 LOW). All folded; one split resolved (the adversarial cleared the terminal rule by misreading the spec's actual text — the code-reviewer's reading governed the fold).

## The r1 → r2 delta to verify (scope to this)

1. **The reshaped terminal rule (D1/D2):** ribbon thickness = carried flow everywhere; terminal tapers to RIBBON_MIN; endpoint reads "0"; surplus textual only (tooltip + card). Is the invariant now coherent with the D6 legend ("trunk carry") for every stretch including terminal and starved lanes, with no remaining channel that renders surplus as flow?
2. **The one-baseline endpoint layout (D2):** entry start-anchored at x1+3, hand-off end-anchored at x2−3, both at busY − RIBBON_MAX − 4, no text below busY. Check the geometry against live layout math: is busY − 13 clear of the feed arrows (track.y+16 → busY) and the feed-group-count tokens (track.y + 29)? A feed lane's busY = track.y + 48; the label baseline lands at track.y + 35 — do glyphs (10px mono, ~8px ascent) collide with the group-count row at +29 or the arrow lines they overlay? Adjudicate whether label-on-arrow overlay is acceptable SVG layering or a real legibility defect needing an offset.
3. **The corrected D7 derivation:** residue-in = `seg.entryFlow − belts[seg.beltIndex].capacity` — verify the algebra against manifold.ts (entryFlow = survivedIn + capacity, post-override) and that the new empty-span counter-case test would genuinely discriminate it from the broken segments[j-1] form.
4. **The scoped "peak" gate + exemptions** — now satisfiable against live source? Any exempt site missed or wrongly exempted?
5. **The feed-only seam growth** — coherent with the shared seam-drawing code path (Schematic.tsx:155-164 is one map for both sides; the spec implies a side-conditional — is that stated clearly enough for the implementer)?
6. **Corrected citations** (format.test.ts:121/:133; smoke :535/:549; normal-mode 8px wording; zero-x-width no-polygon; empty-span entry-number semantics).

Settled in r1 (do not re-litigate): the taper linearity for machine-bearing stretches, the pipe connector's c24770 consistency + no-absence-pin grep, the bus-seg selector survival, decision conformance (no per-gap numbers, hardware in tables, Level-1 boundary, P3 untouched), the site-plan data thread availability (layoutFeedLane receives the lane).

This is round two. If the delta is faithful and no NEW defect exists in it, an honest APPROVED ends the loop — do not manufacture.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
