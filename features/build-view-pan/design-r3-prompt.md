# Review request — #154 design (r3)

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/build-view-pan/brainstorm-spec.md` (uncommitted, r3)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `66f985a`)
**Stage:** design re-review after fold. r2 verdicts: both NEEDS_REWORK on the overlapping IMPORTANT (the sweep enumeration under-inclusive twice running) + one NIT (labelStep contradiction). Folded by INVERTING the sweep authority: the grep is now the gate (every hit dispositioned, zero undispositioned), the enumeration is the map with all reviewer-verified dispositions; labelStep definitively retires.

## The r2 → r3 delta to verify (scope to this)

1. **The inverted sweep gate:** is the grep token set (`band|bandMode|labeledSignificant|labelStep|machine-band|minPitch|114`) sufficient to surface every band-machinery site the r1/r2 rounds found (run it yourself over src/ and check nothing band-related escapes it), and is "every hit dispositioned" a reviewable gate (the diff review can verify it mechanically)?
2. **The map's new dispositions** — verify each against live source: layout.test.ts:5 (import), :178-187 (delete — cannot re-derive), :230-237 (de-band :232, keep the toEqual), :309, smoke.test.tsx:532-567 (delete), :569-614 (delete). Any of these wrongly dispositioned (e.g. is :309's host describe partially survivable)?
3. **The labelStep fix** — A4 and Changes now agree (retires); do the named readers (`layout.test.ts:22,:107,:109`) get a coherent instruction under the new Changes text?

Settled across r1-r2 (do not re-litigate): the 24px floor + all boundary arithmetic, the forcing geometry's existence, the ×N/#138 treatment, the four r1 NIT fixes, the grab-drag shape, the scrolled simplification, the p2-drawing fixture re-derivation instruction.

This is round three; the delta is the sweep-authority inversion + the map completion + one consistency fix. If it is faithful, an honest APPROVED ends the loop — do not manufacture.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
