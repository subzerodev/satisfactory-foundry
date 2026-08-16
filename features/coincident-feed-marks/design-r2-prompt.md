# Forgejo #123 design review r2

Review `features/coincident-feed-marks/brainstorm-spec.md` v2 in:
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s22-123-coincident-feed-marks`.

R1 returned code-reviewer `APPROVED` and adversarial-reviewer `NEEDS_REWORK`.
The accepted finding was a reachable Blueprint collision between the proposed
`x2 - total 480/min` group label and a singleton at the next 60dm boundary.

V2 renders only a bounded visible count token (`xN` through 99, then `x99+`),
with a fixed 12dm offset and <=28dm width. The exact range, count, total capacity,
and boundary remain in the accessible name/Schematic tooltip. A real
`N=5,d=250,B=480,overrides=[0,null,null]` fixture pins `[0,0,1]` boundaries and
the grouped-plus-adjacent presentation.

Recheck the full design against #123 and current source, especially collision
safety, exact semantic disclosure, singleton/output compatibility, #120 tooltip
reuse, dense counts, and absence of data-layer deduplication.

Return severity-tagged exact file:line findings and exactly one verdict:
`APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
