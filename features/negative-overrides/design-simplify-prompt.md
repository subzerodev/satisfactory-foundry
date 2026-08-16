# Simplify review - negative load override design (#121)

Worktree:
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s22-121-negative-overrides`

Artifact: `features/negative-overrides/brainstorm-spec.md`

The correctness pair converged APPROVED / APPROVED at r3. Run the one-shot
post-convergence parsimony lens. Ask only whether the target design is more
complex than necessary while preserving:

- store-level `bad-override` user feedback;
- independent pure-solver safety;
- lane-local sibling behavior;
- negative precedence over every lane early return;
- zero's existing feed/output semantics;
- discriminating tests required by correctness review.

Do not trade away a correctness requirement or invent cleanup. Findings are
advisory but must be concrete and cited. Return exactly one verdict token as
the final line.
