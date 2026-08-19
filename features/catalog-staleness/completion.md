# #144 — completion note

**Landed:** merge f008454 on develop (fix b15e474, focused test 01e29a0,
spec dfaeae3). Pushed.

**What landed:** bundled-catalog users self-heal onto a refreshed bundle.
A detached, set-first staleness check (200-byte provenance fetch, new seam)
compares steamBuilds on bundled hits; a mismatch applies a background
refresh like a live upload (one set + full re-derive + save), protected by
an apply-time never-evict guard AND a module-level catalogSaveQueue that
serializes all three catalog-save sites so a user upload wins the IDB row
on every interleaving. Fast path gains zero network wait; offline boots
unchanged; user rows never consulted.

**What the reviewers caught (design, five rounds):** the fall-through that
would have produced needs-upload{"hit"}; the unspecified refresh ordering;
the upload race; the save-vs-save race (BLOCKER — guard alone insufficient);
the missing re-derive that would have left stages solved against the old
catalog. Diff gate: zero findings from either reviewer; simplify APPROVED
at both stages (await-first alternative refuted from source; test
duplication ruled correct at two copies).

**Verification honesty:** the integration race pin proved a NO-OP mutant
against the queue bypass; replaced with a focused delayed-save test that
kills the mutation 3/3 (r2-verification.log §3/§3b). The log also records
the git-checkout-on-uncommitted-work incident and the post-commit redo
(memory: commit-before-mutating).

**Acceptance criteria:** all five hold on the merged trunk (1154 tests +
lint green). Follow-up per spec: re-run scripts/update-bundled-docs.mjs to
bring the bundle to the current game build — the mechanism now carries it
to existing users.
