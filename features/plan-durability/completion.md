# Stage 19 completion — plan durability: persist() + export-all (#92)

**Merged:** 2026-08-06, `4e25718` (feature/plan-durability → develop,
--no-ff, 4 commits). 773/773 tests (764 + 9 new), `npm run check` clean —
verified in-worktree AND on trunk after worktree removal.

## What landed

- **`src/ui/persistence.ts`** — `requestPersistence()`: node-safe
  feature-detect, `navigator.storage.persist()` at App boot,
  fire-and-forget, console-only reporting, no UI.
- **`exportAllPlans()`** (store) — every plan in one enqueue slot (torn-
  snapshot-safe, commented divergence from exportPlan's no-enqueue) →
  bundle envelope `{kind: "foundry-plan-bundle", format_version: 1,
  exportedAt, plans: [v5 files]}` → App downloads
  `foundry-plans-<date>.foundry-plans.json`.
- **Bundle import arm** in `importPlan` — sniffs on `kind`; per-entry
  validation through the SAME `validatePlanFile`; shared
  `savePlanFromFile` helper with a per-entry-fresh collision view
  (within-bundle duplicates = last-entry-wins into one row, PINNED +
  test-enforced); skip-invalid with `imported N of M plans (K invalid
  skipped)`; zero-valid/empty → error, nothing written; no auto-load;
  single-file arm byte-identical.
- **EXPORT ALL** button in PlansBar (shown with ≥1 plan,
  selection-independent).

## Gate record

- Design r1: code-reviewer NEEDS_REWORK (IMPORTANT: within-bundle
  duplicate-name behavior unpinned) + adversarial APPROVED_WITH_NITS →
  v2 pinned the contract. r2 APPROVED+APPROVED (incl. IDB
  transaction-order analysis). Simplify: 1 NIT folded (rejected
  compose-in-App alternative recorded). r3 delta APPROVED+APPROVED.
- Implementation: 4 commits, zero functional drift (one spec-summary
  drift corrected: live "import failed: " error-string prefixes kept).
- Boundary r1 APPROVED+APPROVED (0); diff-simplify APPROVED (0);
  team lead re-ran 773/773 + check at runtime.
- Bidirectionality log (`r2-verification.log`): 4 real production
  breaks, each with genuine vitest FAILs naming the new tests.

## Walk evidence (dev server on the worktree)

- persist() logs `[persistence] persistent storage granted: false` at
  boot (headless preview denies; StrictMode dev double-call only —
  a suspected 60-call storm proved to be the log-capture tool
  multiplying every line ×6).
- Real UI flow: two plans saved → EXPORT ALL produced
  `foundry-plans-2026-08-06.foundry-plans.json` (captured via
  createObjectURL hook; envelope verified) → `satis_foundry` DB
  deleted + reload (list empty) → bundle re-imported through the
  `.plans-import` file input → both plans restored, no auto-load,
  input reset.
- Partial bundle ([valid, corrupt, valid-new-name]) → exact message
  "imported 2 of 3 plans (1 invalid skipped)", valid entries landed.
- Walk gotcha for the record: `document.querySelector('input[type="file"]')`
  grabs the Docs.json upload input — the plans import lives at
  `.plans-import input`. (Feeding the wrong input also demonstrated the
  catalog validator's honest rejection.)

## Acceptance

- [x] persist() requested at boot, silent, feature-detected
- [x] Export-all bundle + re-import through the existing Import
- [x] Full gate + bidirectionality log + walk
- [x] Live site update: rides the NEXT approved mirror push (policy)
