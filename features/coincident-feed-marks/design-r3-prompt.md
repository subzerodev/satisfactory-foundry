# Forgejo #123 design review r3

Review `features/coincident-feed-marks/brainstorm-spec.md` v3 in:
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s22-123-coincident-feed-marks`.

R2 returned `NEEDS_REWORK` / `NEEDS_REWORK` on the same defect: Schematic's
count marker remained unbounded and could cover an adjacent arrow at 8px pitch.

V3 always draws a fixed-width double-stem group glyph. It uses the bounded
`xN`/`x99+` token only when a pure helper finds 28px text plus 4px gap to the
right or left; otherwise text is suppressed while exact tooltip/ARIA content
remains. A real `N=115,d=480,B=480` zero-first-override fixture pins the 8px
adjacent case, plus helper rows pin right, left, suppressed, and x99+ behavior.

Recheck the full design against #123/#120 and current source, especially visible
group disclosure when text is suppressed, collision safety in both views,
bounded semantics, keyboard/touch/nonvisual behavior, and unchanged data/output
contracts.

Return severity-tagged exact file:line findings and exactly one verdict:
`APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
