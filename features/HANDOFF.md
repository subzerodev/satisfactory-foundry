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

Current branch test count after #117/#118 rows: **917**, all green.

---

## Where things stand

### Stage 21 arc (epic #108, milestone 92) — 3 of 4 phases resolved

| Phase | Ticket | State |
|---|---|---|
| P0 ore constrained-vs-natural | #104 | **DONE**, merged |
| P1 retire `candidateRecipesFor` | #103 | **DONE**, merge `0805af0` |
| P2 branded `GatedCatalog` | #106 | **DONE / won't-do**, merge `8debe85` |
| P3 explicit byproduct routing | #105 | **NOT STARTED** — the arc's largest design |

Also open, outside the arc's four: **#115** (AltCompare tier-locked labels),
**#111** (total output display), and **#118** (in review, see below). #117 is
**DONE**, merge `867d6d4`.

### IMMEDIATE: `feature/s21-118-repropose-world` is in review

**This branch is NOT merged yet.** #118 has implementation + tests and has passed
correctness r1 as APPROVED + APPROVED_WITH_NITS. The NITs were stale handoff
lines, now folded. Next step is the one-shot simplify pass, then commit and
merge if it approves / findings are dispositioned.

**To finish it:**

1. Run `claude-simplify-reviewer` once on `/tmp/s21-118-current.diff`.
2. Disposition any simplify findings (or record APPROVED).
3. Commit `feature/s21-118-repropose-world`.
4. Merge `--no-ff` to `develop`, verify, close #118 with a `done` audit comment,
   and move the card to Done (issue id **1259**, column **71**).
5. No changelog entry — this is test/docs coverage, no behaviour change.

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

### #117 / #118 pinned after the #106 measurement

`ChainBuilder.tsx` renders the constrained-recovery `<select>` options via
`recipeLabel(preview.gated, …)`. #117 proved the ungated-label slip reachable
and pinned it: solve at tier 0 with Foundry excluded so Ingot is constrained,
make Rate invalid so re-propose stalls, then clear Foundry. The constrained row
keeps the solved cause while its recovery options use the live exclusions; the
correct label is `Bravo (default)`, and the ungated mutation loses the
`(default)` tag.

#118 proved the four green `repropose` slips reachable and pinned them with
stale-preview jsdom rows: solve at tier 0, stall a tier change to `all` with an
invalid Rate, restore Rate, then trigger each caller. Correct code starts from
the store catalog and restores Alpha/Smelter; the `preview?.gated ?? catalog`
mutations stay stuck in the tier-0 Foundry world.

**#115 still has no milestone** — assign it to Stage 21 when you pick it up.

---

## Suggested order

1. **#106** — DONE / won't-do, merged at `8debe85`.
2. **#117** — DONE, merged at `867d6d4`.
3. **#118** — pinned by `feature/s21-118-repropose-world`; merge/close once its
   review gate converges.
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
