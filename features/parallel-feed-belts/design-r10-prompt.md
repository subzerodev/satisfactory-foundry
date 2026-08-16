# Design review r10 - bounded automatic parallel feed buses (#120)

Worktree: `/home/subzerodev/workspace/satisfactory-foundry`

Artifact: `features/parallel-feed-belts/brainstorm-spec.md` (v10)

## Delta from r9

R9 received `APPROVED` from code-reviewer and `NEEDS_REWORK` from
adversarial-reviewer. V10 folds both adversarial findings:

1. the focusable bundled SVG group uses `aria-label` and visible focus but no
   nested `<title>`, preserving the existing custom tooltip as the sole tooltip;
2. optional one-line upgrade selection scans all tiers above the unlocked top
   and chooses the first capacity that actually carries the relevant peak,
   skipping locked tiers that still require two lines.

All v9 math, rail coloring, empty-lane defaults, and explicit-override scope
remain unchanged. #122 and #123 remain separate existing-defect tickets.

## Review mandate

1. Confirm both r9 findings are fully and minimally resolved.
2. Check the focusable group remains usable by keyboard and nonvisual users
   without creating duplicate native/custom tooltips.
3. Check the upgrade scan for a Mk3 peak above Mk4 but below Mk5 selects Mk5,
   and Michael's 840/min Mk5 peak selects Mk6.
4. Revalidate the bounded exact-arithmetic invariant, independent rail color,
   no false finding, and preservation of oversized override/output behavior.
5. Apply a strong parsimony lens; reject any return of the v2-v7 inlet system.

Return severity-tagged, file/line-cited findings and exactly one final verdict:
`APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
