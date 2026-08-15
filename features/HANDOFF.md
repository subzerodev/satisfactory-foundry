# HANDOFF — satisfactory-foundry, 2026-08-15

Written for a fresh agent picking up mid-arc. Read this, then `git log`, then the
board. **The forge board is the source of truth, not this file** — if they
disagree, the board wins and this file is stale.

Board: `sudohworks/satisfactory-foundry` on the sudohworks Forgejo, project #21.
Columns: Backlog=68, To Do=69, In Progress=70, Done=71.
Repo-local MCP is `mcp__forgejo-satisfactory-foundry__*` (bound via `.mcp.json`).

---

## STOP — read these constraints before doing anything

1. **Reviewer roster for this pickup:** copy the existing Claude reviewer agent
   definitions into fresh Codex sub-agents; do not invoke the Claude CLI. The
   correctness pair is `code-reviewer` + `adversarial-reviewer` (both hard-gate);
   the parsimony lens follows `claude-simplify-reviewer`, once, post-convergence.
   Relay every verdict tagged `(degraded: same-vendor, third-party reviewer
   unavailable)`.
2. **The GitHub mirror is deploy-only and needs Michael's EXPLICIT approval,
   every time.** `github` remote → `https://github.com/subzerodev/satisfactory-foundry.git`,
   HTTP+broker, **never SSH**, and **only `main`**. Do not push it because a
   phase finished. See `CLAUDE.md` for the runbook.
3. **The deploy run's verdict is the "Verify the site serves this build" step.**
   The `deploy-pages` step is ADVISORY and its 10-minute cap shows red while the
   deploy still lands. Never react to that step alone
   (`docs/postmortems/2026-08-06-pages-deploy-false-failures.md`).
4. **Verify test counts on trunk only, with no worktree mounted.** A root `npm
   test` also collects `.worktrees/**` suites and double-counts.
5. **New work gets its OWN ticket immediately** — never parked in prose or in a
   comment on another ticket.

Current trunk (`develop`) test count: **912**, all green.

---

## Where things stand

### Stage 21 arc (epic #108, milestone 92) — 3 of 4 phases resolved

| Phase | Ticket | State |
|---|---|---|
| P0 ore constrained-vs-natural | #104 | **DONE**, merged |
| P1 retire `candidateRecipesFor` | #103 | **DONE**, merge `0805af0` |
| P2 branded `GatedCatalog` | #106 | **won't-do, GATE NOT FINISHED** — see below |
| P3 explicit byproduct routing | #105 | **NOT STARTED** — the arc's largest design |

Also open, outside the arc's four: **#115** (AltCompare tier-locked labels),
**#111** (total output display), **#117** and **#118** (new, see below).

### IMMEDIATE: `feature/s21-p2-wontdo` is committed but NOT reviewed-clean

**This branch is NOT merged and must NOT be merged as-is.** The original
diff-stage r2 run was stopped mid-flight, so those verdicts did not exist. The
fresh Codex-subagent reruns have since happened: r2a folded stale handoff
wording; r2b found the count still missed five `repropose(catalog, ...)` callers.
Those five are now in the harness as R0-R4, with R4 red and R0-R3 split to #118.

**To finish it:**

1. `git checkout feature/s21-p2-wontdo`
2. Dispatch `code-reviewer` + `adversarial-reviewer` in parallel on
   `features/branded-gated-catalog/diff-r2-prompt.md` (already written, already
   delta-scoped to the r1/r2 folds).
3. Fold or reject-with-counter-evidence; re-run the pair until both are
   APPROVED / APPROVED_WITH_NITS.
4. Then `claude-simplify-reviewer` once, disposition its findings.
5. Merge `--no-ff` to `develop`, close #106 with a `done` audit comment, move the
   card to Done (issue id **1193**, column **71**).
6. **No changelog entry** — there is no behaviour change. (`docs/foundry-changelog.md`
   is deploy-facing prose for Michael to paste; a doc-comment change earns nothing.)

**Beware:** the headline count in that comment has been **wrong three times** and
reviewers caught it every time. It currently claims *fifteen value-passing places*
in `ChainBuilder.tsx` where the gated/ungated swap compiles and *nine* that turn
`ChainBuilder.gating.test.tsx` red. Re-sweep it yourself; do not trust the
harness rows or this file.

### What #106 concluded, and why

Short version: **the measured five-seam brand would close nothing the test suite
misses**, and a broader `recipeLabel` narrowing would close only #117 while
leaving #118 untouched. The ticket closes won't-do and ships one `gateCatalog`
doc comment recording the measurement.

Full report + reproducible harness: `features/branded-gated-catalog/`.
- `brainstorm-spec.md` — the report (v6), including the review rounds and every
  refuted claim. The wrong turns are the reusable part; do not delete them.
- `seam-detection.sh` — applies each one-token slip, runs `tsc -b` + the full
  suite, restores. Run it before trusting any claim in the report.
- `brand-probe.patch` — the five-seam brand, so the harness's BRAND column is
  reproducible.

**The one thing worth knowing if you touch tier-gating:** a negative brand does
NOT reject `preview?.gated ?? catalog` — TypeScript subtype-reduces that union to
plain `Catalog`. Measured. That kills the obvious "just brand it" fix.

### #117 / #118 — untested gaps found by the #106 measurement

`ChainBuilder.tsx` renders the constrained-recovery `<select>` options via
`recipeLabel(preview.gated, …)`. Swap that to the ungated `catalog` and **all 912
tests still pass**. Nothing in the suite selects `.chain-builder-constrained
select` or its options.

Unlike the `byproductSuggestions` slip (which is provably inert — it reads only
`items`, shared by reference, and recipes of stages the gated solve already
produced), **this one has no inertness argument**. Task 1 on #117 is to settle
whether it is reachable; "it turns out inert, close it with the trace recorded"
is a valid outcome, not a failure.

#117 is assigned to Stage 21, linked under #108, and queued before #118. A
`recipeLabel(catalog: GatedCatalog, ...)` type annotation could catch this one
slip, but #117 still starts by deciding reachability/inertness because a
pass-either-way label test is easy to write here.

#118 is already created, assigned to Stage 21, linked under #108, and queued
after #117. Its first task is the same shape: settle whether the four green
`repropose` slips are reachable or inert. The measured negative brand does not
catch them because `preview?.gated ?? catalog` launders back to plain `Catalog`.

**#115 still has no milestone** — assign it to Stage 21 when you pick it up.

---

## Suggested order

1. **Finish the #106 gate** (above). Small, and it is blocking a clean trunk.
2. **#117** — small, concrete, and it is a real untested path.
3. **#118** — same measurement family as #117; four green `repropose` slips.
4. **#115** — AltCompare tier-locked labels. Design is already sharp in the
   ticket body; the decision (label, never hide) is SETTLED, do not re-litigate.
   Its stated trap: `unlockedTier` defaults to `null`, so a test that does not
   explicitly set a tier passes whether the feature works or not.
5. **#111** — total output display.
6. **#105** — byproduct routing. The arc's largest design; budget a full Tier-3
   phase, not a quick pass.
7. **Then** the `develop → main` release PR — and the GitHub Pages deploy
   **only** on Michael's explicit approval.

Michael's standing instruction this session was *"I want everything completed"* —
meaning the whole queue above, not just the next item. He is fine with won't-do
outcomes when they are measured; he is not fine with silent stalls.

---

## Process notes that cost real time this session

- **A green mutant means one of two things, and they are opposite:** the tests
  miss it, or the mutation is a no-op. I read the second as the first and it
  killed a design at review. Before calling a surviving mutant a coverage gap,
  enumerate every expression in the function that reads the mutated input and
  show at least one can differ.
- **A mutation harness reporting "nothing detected" is a harness bug until
  proven otherwise.** Mine produced a false all-clear three ways in one session:
  line-addressed slips that silently failed to apply after an import shifted the
  lines; `vitest | grep -q` under `set -o pipefail` returning the pipeline's
  status and inverting every RED to green; and an absence-based read scoring a
  crashed run as green. All three now guarded in `seam-detection.sh`. Every false
  result looked like a real finding.
- **Absolute and uniqueness claims ("the only", "exactly N", "no other") are the
  highest-frequency defect in my docs here.** Five were caught by review on #106
  alone. Run the grep, or write the scoped version.
