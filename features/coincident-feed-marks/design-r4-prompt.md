# Forgejo #123 design review r4

Review `features/coincident-feed-marks/brainstorm-spec.md` v4 in:
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s22-123-coincident-feed-marks`.

R3 returned `NEEDS_REWORK` / `NEEDS_REWORK` with two concrete defects:

1. Per-group placement did not prevent two nearby groups from choosing
   overlapping inward-facing labels. V4 makes placement lane-global and
   deterministic: increasing-anchor order, right then left, with lane-edge,
   other-anchor, and previously reserved-label interval checks. It adds the
   reviewer's reachable `N=115,d=30,B=480`, overrides
   `[3300,0,300,null,null,null,null,null]` facing-group fixture.
2. The touch claim was false when a token was suppressed. V4 explicitly focuses
   the group glyph on touch `pointerup`, reusing the existing focus-tooltip path,
   and pins activation and dismissal in jsdom. No second tooltip or expansion
   state is introduced.

Recheck the full design against #123/#120 and current source, especially the
interval-reservation algorithm, the reachability and expected anchors of the
new fixture, reliable touch focus behavior in SVG/jsdom/browser, bounded
semantics, and unchanged solver/layout/output contracts.

Return severity-tagged exact file:line findings and exactly one verdict:
`APPROVED`, `APPROVED_WITH_NITS`, `NEEDS_REWORK`, or `BLOCKED`.
