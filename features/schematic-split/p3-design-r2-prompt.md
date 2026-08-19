# Review request — #135 P3 design (r2)

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/schematic-split/p3-brainstorm-spec.md` (uncommitted, P3-r2)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `8bb34b5`)
**Stage:** design re-review after fold. r1 verdicts: code-reviewer APPROVED_WITH_NITS (3 citation NITs, folded); adversarial NEEDS_REWORK (1 HIGH — the un-parameterized output-arrow anchor at Schematic.tsx:735; 1 LOW; 1 NIT — all folded).

## The r1 → r2 delta to verify (scope to this)

1. **The :735 parameterization (the HIGH's fold):** D1 now prescribes `machineTopY + machineRowH` for the output-lane anchor, explains the coincidence trap (the risen outputTop EQUALS the old literal, so arrows would silently float inside the lane), and adds the y1-register pin. Verify the prescription is complete and correct against Schematic.tsx:735/:467-468 — and hunt for any OTHER surviving hardcoded machine-region literal in the build-view render path the fold still misses (the r1 adversarial cleared :575/:584/:710 as dying-or-moving; re-confirm).
2. **D4's output-motion enumeration** — the four movers (outputTop, track.y/busY, the name baseline, the arrow anchor) complete and consistent with D1?
3. **The two flip-pin citations** (layout.test.ts:132-135 flips, :256-260 holds) — correct as now stated.
4. **The citation fixes** (:291 ternary head, :106-171, :291-297).

Settled in r1 (do not re-litigate): the register guarantee, the un-gated significant's purity and threshold arithmetic, the label-baseline y-map, the machines-view sizing, ruler readability at the threshold edge, the ~23 default-safe call sites, decision conformance, the five smoke relocations.

This is round two; the delta is one prescription + three precision fixes. If it is faithful and no NEW defect exists in it, an honest APPROVED ends the loop — do not manufacture.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
