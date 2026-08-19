# P4 completion report — packaging for a raw input (#133, arc phase of #140)

**Merged:** `feature/phase-p4` → `develop`, `--no-ff`, 2026-08-19 (seven
commits `c4d5cbe..c0a545a`; 12 files, +1431/−151).
**Spec:** `brainstorm-spec.md` at r5 (`ceed250`) — five correctness rounds
across two sessions (r1/r2 gates pre-arc; the fresh r4 gate + post-arc
revalidation as P4) plus a zero-finding simplify pass on the design.
**Trunk after merge:** 1218 tests green, check clean, build green.

## What landed

- **The Wet Concrete answer:** a raw input's Extraction panel now carries
  "Package for transport" directly under the extractor plan (Michael's
  option-2 decision, #133 c24629). Enabling it reports Packagers,
  Unpackagers, power, packaged cargo rate, empty-container return rate,
  and both routes — a reporting layer, no Packager cycle in the graph.
- **One shared core:** `derivePackagingPlan(catalog, input)` extracted
  from `deriveLinkPlan`, which stays a signature-identical adapter (the
  early-return string pinned); the extraction path is a second thin
  adapter feeding top-level totalSupply + raw-feed demand.
- **Plan file v9:** `ExtractionSelectionV7` frozen, `PlanStageV8` /
  `PlanFileV9` / `isStageV8Shape` / `isPlanFileV9`; `migrateV8` REBUILDS
  field-by-field (a smuggled garbage `packaging` blob on a v8-headered
  file is stripped, never passed through), and `migrateV7`'s identical
  stage hole closed the same way. Fresh saves write v9; v1-v9 load; the
  two future-version rejection tests moved to 10.
- **The write canonicalizes:** the extraction packaging write routes
  through `canonicalizePackagingInterstep` exactly as the link path does
  (an illegal route drops the write); the panel seeds belt (the path has
  no self-heal — a spec-hardened requirement).
- **Preservation:** `setMachine` carries `packaging`; `copyExtractionSelection`
  deep-copies it; nitrogen_gas (no standalone extractor) correctly shows
  no control; a saved config stays visible/clearable when the catalog no
  longer resolves its pair.

## Review trail

- **Design:** the r4 spec's missing gate was detected via the audit trail
  (the r2 disposition said "r4 needs a fresh gate"; none ran — the
  #113-class trap) and run as P4's first act, doubled as post-arc
  revalidation: code-reviewer APPROVED_WITH_NITS + adversarial APPROVED;
  the third-instance hunt (the re-inversion class behind the r1/r2
  blockers) found the class closed at the `validatePlanFile` chokepoint.
  Folds → r5. Simplify: APPROVED, zero findings.
- **Diff:** code-reviewer APPROVED_WITH_NITS (stale v8 prose — eleven
  comments swept @ `4d82114`) + adversarial APPROVED (hand-traced the
  garbage-blob path through the live chain; every UI write path
  canonicalized; the adapter split behaviourally identical). Simplify:
  APPROVED_WITH_NITS — the two byte-identical UI helpers deduped into
  transport-text.ts (`c0a545a`), verified by a scoped correctness re-run
  (APPROVED + APPROVED); the panel-vs-LinkInspector sharing question
  adjudicated as correctly-not-shared.
- **Recorded INFO (no action):** `copyExtractionSelection` copies
  `returnTransport` one level but not its nested `trip` — unreachable as
  a defect (the sole caller passes post-canonicalize objects, which
  rebuild `trip` fresh); noted for any future non-canonicalizing caller.
- **Bidirectionality:** `r2-verification.log` — 7 compiling mutations
  across 5 behaviours; one first-attempt unapplied mutant was caught by
  the content-grep discipline and corrected before being trusted; no
  green mutants.

## Acceptance criteria

All met: the water case end-to-end (DOM-pinned), the gate's three
visibility states, extractor-change preservation, adapter parity pinned by
decorrelated + null-branch tests, v9 round-trip + loud old-build rejection,
malformed-blob rejection, test/check/build green, the log.
