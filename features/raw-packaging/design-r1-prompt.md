# Design review r1 — #133 packaging for a raw input (Stage 23)

**Worktree (absolute):** `/home/subzerodev/workspace/satisfactory-foundry`
**Artifact:** `features/raw-packaging/brainstorm-spec.md` (design r1)
**Stage:** design (no `src/` file modified) · **Ticket:** #133 · **Epic:** #136
**Committed as:** `08127e8`

Michael's field report: *"i dont see where to click to make the water be
packaged."* Stage 22 shipped packaging as an insertion on a **link**; the water
that motivated Stage 22 is a **raw feed**, which has no link.

## Settled — do not re-litigate, but DO check the design honours them

- **Packaging lives in the Extraction panel** (#133 comment 24629, Michael's
  choice of option 2), not a second transport surface on the raw card.
- **Do not widen `StageLink` to cover raw feeds** (epic #136) — plan v8
  persistence and the solver's cycle guard key off real links.
- Packaging is a reporting layer; it adds no Packager cycle to the solve.

## Spend your effort here

1. **The load-bearing claim is that reusing the packaging math does not touch
   `StageLink`.** The spec argues `LinkPlanLink` (`core/link-plan.ts:40-46`) is a
   standalone structural type, separate from `StageLink` (`state/store.ts:136-143`).
   **Verify that, and verify the blast radius** — is `LinkPlanLink` really
   referenced only in `link-plan.ts` and its test? Does anything else structurally
   depend on the two staying identical?

2. **The proposed refactor.** `deriveLinkPlan` is to be split into a pure
   `derivePackagingPlan(catalog, input)` plus a thin adapter that keeps the
   current signature. Read `link-plan.ts:95-195` and judge: is the split at the
   right seam? Does the adapter preserve behaviour **exactly**? Is
   `link-plan.test.ts` actually a sufficient pin on that, or does it leave a
   behaviour the refactor could silently change?

3. **"Supply is reported, never consumed."** The spec claims every computed
   figure depends on `materialDemand` only. Check `:145-170` and `:180-193`
   against that, and look for any path where `cargoSupply` or `materialSupply`
   reaches a number the user sees as a *derived* result rather than a reported
   input.

4. **Persistence.** The spec claims no `format_version` bump is needed because
   `state/store.ts:1976-1978` spreads `node.extraction` wholesale. **Trace the
   full round trip** — save, load, migrate — and look for any field-by-field copy
   on a reachable path that would silently drop `packaging`. Note
   `copyHistoricalExtraction` (`plan-store.ts:494-506`) is claimed to be
   pre-v5-only; verify that. Silent data loss is the worst outcome here.
   *(`src/data/plan-store.ts` was previously reported to contain a raw NUL byte
   that makes `grep` return nothing; a check this session found none, but if a
   search of that file returns suspiciously empty, read it directly.)*

5. **The validator tier.** Is following the `purityMix` precedent
   (`plan-store.ts:1091-1117`) correct here, and does the spec's plan actually
   reject a malformed `packaging` blob rather than admit it?

6. **UI gating.** Packaging shows only when `discoverPackagingPairs` is non-empty.
   Is that the right predicate, and does it behave for the Wet Concrete water case
   and for a solid ore?

## Anchors

`src/core/link-plan.ts` (`:21-46`, `:75-93`, `:95-195`, `:198-225`);
`src/core/link-transport.ts` (`:34-41`, `:167-191`);
`src/core/packaging-pair.ts` (`:20-32`, `:38-138`);
`src/ui/LinkInspector.tsx` (`:125-128`, `:194-216`);
`src/ui/GraphCanvas.tsx` (`:205-208`, `:299-589`);
`src/ui/extraction-plan.ts` (`:35-66`, `:78-84`, `:159-163`);
`src/ui/graph-flow.ts` (`:138-152`, `:594-672`);
`src/state/store.ts` (`:101-111`, `:136-143`, `:1968-1980`);
`src/data/plan-store.ts` (`:189-230`, `:302-322`, `:423`, `:494-506`, `:1062-1117`);
`src/core/link-plan.test.ts`.

## Also check

- Every `file:line` the spec cites, against live source. Two maps were produced
  for this ticket by search agents and **one of them overstated a constraint**
  ("the math requires two-site context") that direct reading disproved — treat
  cited facts as claims to verify, not as given.
- Any claim labelled **Verified** in the assumptions ledger that is not.
- Whether the design is bigger than it needs to be: is there a simpler shape that
  honours the settled decision and the `StageLink` constraint?

## Verdict contract

Return exactly one of `APPROVED` / `APPROVED_WITH_NITS` / `NEEDS_REWORK` /
`BLOCKED` **in your final message**, with severity-tagged findings citing
verified source. If a nested check does not report, state the finding anyway
marked unconfirmed and source-derived — do not withhold it and do not wait.

Approve if a determined attack finds nothing real. Be explicit about severity: if
what you find is cosmetic, say so and approve rather than reaching for
`NEEDS_REWORK`. This is a lean spec by deliberate choice — do not request restored
narrative or extra justification unless its absence would cause the change to be
built or verified incorrectly.
