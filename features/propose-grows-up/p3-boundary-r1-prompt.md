# Boundary review r1 — S20 P3 (#102): persistence + tier gating

Review the CUMULATIVE diff against the frozen contract. Worktree:
`/home/subzerodev/workspace/satisfactory-foundry/.worktrees/s20-p3`
(branch feature/s20-p3, 10 commits over develop).

Diff (3455 lines, incl. a 530-line package-lock hunk):
`.../.worktrees/s20-p3/features/propose-grows-up/p3-boundary-r1.diff`
(or `git diff develop...HEAD` in the worktree)

## A. Contract anchors

- **Frozen contract:** `features/propose-grows-up/p3-brainstorm.md`.
  NOTE: the worktree's copy is **v9**; the authoritative v12 (with
  the spec-8 jsdom amendment and its two measured corrections) is on
  **develop** at commit `ca84a13`. Read the develop copy — the
  amendment materially changes spec item 8.
- Spec items 1-8 are the acceptance criteria (item 9, docs, is the
  team lead's). The revision history records EIGHT design rounds plus
  the amendment; several entries exist specifically to prevent a
  defect being re-introduced.

## B. Claims to verify

1. Every hunk against the contract — scope creep, dead code. Notably:
   AltCompare must stay UNTOUCHED except a tsc-forced fixture field;
   no routing (#105); no machine gating; no `GatedCatalog` (#106);
   `src/core/` untouched.
2. Implementer claims: 884/884 green + check clean (re-run if you
   have shell); baseline was 834 (+50).
3. **The traps the design already caught — verify each survived:**
   - schematic refs: quote-EXCLUDING capture + `normalizeClassName`
     (a whole ref yields `""` — silent total failure);
   - `recipeUnlocks` through ALL of `StoredCatalogData` +
     `serializeCatalog` + `reviveCatalog` + revive's shape guard
     (revive is tsc-forced, serialize is NOT — the asymmetry is the
     whole point), null-prototype maps everywhere incl. `gateCatalog`;
   - both non-tsc-forced fixtures hand-fixed
     (`catalog-store.test.ts` corrupted-shape row + `serializedSample`),
     revive NOT made tolerant;
   - `store.test.ts:588-598`'s assertion/comment/title updated,
     `partialize` NOT narrowed;
   - tier rides the `repropose` patch with `!== undefined` (NOT `??`);
   - TWO derivation sites; the memo above the null-catalog guard;
     the five gate-sensitive sites + three plumbing seams get `gated`;
     `excludableMachines` and `byproductSuggestions` stay UNGATED;
   - `Number.isInteger(v) && v >= 0 ? v : null`, no catalog-derived
     clamp;
   - causeOf's both-worlds split; the four-cell ALTERNATE-INCLUSIVE
     lever matrix;
   - identity-at-null: `gated === catalog` (same reference), and
     null-tier behaviour byte-identical to pre-P3.
4. **The jsdom seam file** (`ChainBuilder.gating.test.tsx`): does it
   genuinely pin what it claims? For each row, would it FAIL if that
   seam were reverted to the ungated catalog? Check especially that
   no row is the non-discriminating kind this spec has now produced
   four times. Also: `IS_REACT_ACT_ENVIRONMENT` set; the literal
   `@vitest-environment` pragma string appears in NO other file
   (vitest matches whole file content — a stray mention silently
   flips that file's env); the in-memory storage stand-in is
   `vi.hoisted`.
5. **The bidirectionality log** (`p3-r2-verification.log`): 37
   behaviors claimed, 35 pinned + 2 proven no-ops. Verify the FAILs
   are genuine and name the diff's tests; verify the 2 no-ops are
   the legitimately-unobservable ones (`:441` and the TIER value
   binding), NOT a place a real pin was dodged.
6. UI accessibility + theme-token discipline for the TIER control.

Return exactly one verdict (APPROVED / APPROVED_WITH_NITS /
NEEDS_REWORK / BLOCKED) with severity-tagged, line-cited findings.
Do NOT spawn nested verification agents.
