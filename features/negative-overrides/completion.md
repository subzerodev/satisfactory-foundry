# Completion - negative override validation (#121)

Merged to `develop` at `9a1a9ca`.

## Landed

- Store-entered negative feed/output overrides route to `bad-override` with
  exact lane and one-based slot detail.
- Direct manifold callers receive a lane-local `negative-override` finding
  before degenerate, infeasible, or override-count exits.
- Zero-load feed and output behavior is explicitly characterized and preserved.
- Bidirectional evidence proves the new tests fail when each production guard
  is removed and pass after restoration.

## Review

- Design correctness converged and its simplify pass was dispositioned.
- Diff correctness converged `APPROVED` / `APPROVED`; the one-shot simplify
  review returned `APPROVED` with no findings.
- Final verification: 955 tests, `npm run check`, and `npm run build` passed.
