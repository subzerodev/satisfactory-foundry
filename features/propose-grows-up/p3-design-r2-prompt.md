# Design review r2 — S20 P3 (#102): persistence + gating

Review `features/propose-grows-up/p3-brainstorm.md` (v2) in the repo at
`/home/subzerodev/workspace/satisfactory-foundry` (develop). This is
r2: both r1 reviewers returned NEEDS_REWORK; every finding is folded
(see the v2 revision-history entry for the disposition of each).

## A. Current-state anchors (verify against live source)

Same as r1 (`p3-design-r1-prompt.md` §A) PLUS the r1-corrected facts:
- `docs-loader.ts:126, 261-270` — recipe ids are
  `normalizeClassName(className, "Recipe_")` (`Recipe_IronPlate_C` →
  `iron_plate`).
- `catalog-store.ts:103, 154-165, 16-19` — no stored raw text (hash
  only); mismatch → `stale`; uploaded-Docs users fall back to bundled
  + re-upload once (recorded precedent).
- `AltCompare.tsx:80, 90, 120-121` — compare reads the ungated store
  catalog; `candidateRowsFor` hardcodes EXCLUDED_MACHINE_IDS (#103).
- `ChainBuilder.tsx:417-456` — the current constrained-recovery
  branches.

## B. The v2 deltas to verify (the r1 folds)

1. **Keying**: Axis 3/spec-2 now mandate `normalizeClassName(seg,
   "Recipe_")` + unmatched-ref skip + a raw-key-must-not-match test.
   Is the fold complete and implementable as written?
2. **Threading redesign** (Axis 4): `unlockedTier` rides the options
   bag (like P2's clock); the ADAPTER gates internally so both worlds
   are available. causeOf: hasAnyProducer on UNGATED, constrained ⇔
   ungated-has-producer ∧ effectiveDefaultRecipe(gated, exclusions)
   = null; null-tier ⇒ byte-identical P1 classification. Attack the
   split for coherence with the P1 frozen classifier.
3. **Lever matrix**: inline-picker recovery first (gated
   producerRecipesFor non-empty, P1 unchanged); else
   tierAlone/machineAlone/joint predicates word the line
   (machine / tier / both). Is the matrix total — every constrained
   item gets exactly one honest recovery, no false lever hints,
   alternate-only case unchanged? Check the compound cell
   specifically (machine-excluded producer whose recipe is ALSO
   tier-gated).
4. **Compare carve-out**: AltCompare stays ungated with the
   applied-graph rationale; tier-awareness recorded on #103; the
   "one consistent world" claim re-scoped to propose surfaces. Sound?
5. **Bump-cost disclosure**: stale semantics now stated truthfully;
   uploaded-Docs fallback disclosed as accepted cost. Accurate against
   source?
6. **mType measurement**: all 8 types enumerated; the
   zero-under-gating measurement recorded in the ledger. Are the
   claims labeled with their provenance (measured this session)?
7. Everything else (Axes 1-2 persistence home/seed-mirror, hydration
   order, spec/tests/walk) was reviewed at r1 with no findings beyond
   the folded ones — re-verify only if a v2 edit touched it.

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS /
NEEDS_REWORK / BLOCKED) with severity-tagged, line-cited findings.
