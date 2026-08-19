# Review request — #152 P2 design (r3)

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/game-mechanics-rework/p2-brainstorm-spec.md` (uncommitted, r3)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `88a87d2`)
**Stage:** design re-review after fold. r2 verdicts: both NEEDS_REWORK — code-reviewer 2 IMPORTANT + 1 NIT, adversarial 2 IMPORTANT, one shared (the stale ledger). All folded.

## The r2 → r3 delta to verify (scope to this — four text folds)

1. **The corrected ledger entry** (subtraction form) — now consistent with D7's body and the counter-case test; no other stale copy of the rejected `segments[j-1]` form anywhere in the artifact (grep it).
2. **The halo fold** — `ribbon-endpoint` carries the paint-order/--bg idiom with a class pin; citation check (app.css:756-758, :779-782).
3. **The collision rule** — entry label pushes +20px past a co-located feed-group token; verify the trigger condition (placement `coordinate + 4` within 1px of `x1 + 3`) matches coincident-feed-marks.ts's actual placement candidates (including the LEFT candidate `coordinate − 32` — does the rule need to fire for that case too, or only the right-candidate? adjudicate), and the fixture pin.
4. **The two "peak" wording scopes** at the D3 sites.

Settled across r1-r2 (do not re-litigate): the terminal RIBBON_MIN rule (verified on seam/starved terminals), the taper linearity, the one-baseline layout's cross-lane safety, the subtraction algebra's override-invariance, the feed-only seam growth, the scoped gate + exemptions, the pipe connector, all citations verified in r2.

This is round three; the delta is four text folds. If they are faithful and no NEW defect exists in them, an honest APPROVED ends the loop — do not manufacture.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
