# Amendment review (delta-scoped) — S20 P3 (#102) spec item 8

Review the v10 AMENDMENT to `features/propose-grows-up/p3-brainstorm.md`
in `/home/subzerodev/workspace/satisfactory-foundry` (develop). You both
approved v9 at r8 (APPROVED_WITH_NITS ×2). This reviews ONE change made
after the freeze, at implementation time.

## What happened

The implementation agent's drift hunt found spec item 8's UI seam rows
UNIMPLEMENTABLE in this toolchain — a design-grounding failure that all
eight review rounds (mine and yours) missed. Verified independently by
the team lead:

- `vite.config.ts:46` sets `environment: 'node'` globally; there is no
  jsdom / happy-dom / testing-library anywhere in `package.json`.
- Every UI test is `renderToStaticMarkup` SSR smoke by deliberate
  posture (`ChainBuilder.test.tsx:2-6`: "Interactive
  propose→preview→apply is the browser walk").
- All five gate-sensitive sites live inside
  `{preview !== null && view !== null && …}` (`ChainBuilder.tsx:338`);
  `preview` is component-local state set only by the Propose click
  handler, so SSR renders initial state and never reaches them.

## The amendment (spec 8's new "HOW they are written" block)

Add `jsdom` as a devDependency, SCOPED to the new P3 seam-test file via
a per-file `@vitest-environment jsdom` pragma; drive React with
`createRoot` + `act` (both already available — no testing-library). The
global node env and every existing test file stay untouched; the new
file's docblock states why it departs.

Recorded as rejected, with reasons:
- extracting an exported pure `ChainPreview` — would relocate Axis 4's
  component-body derivation site, the exact thing r4/r5/r6 fought over
  (incl. r6's "memo above the null guard"), trading a design the gate
  approved for an unreviewed restructure;
- routing the rows to the browser walk — leaves them unenforced in CI,
  voiding the r5 finding the mechanism rests on.

Noted as a FUTURE ticket, deliberately not taken now: a branded
`GatedCatalog` return type would make wrong wiring a COMPILE error
rather than a tested one.

## Your question

- Is the diagnosis correct and complete? (Verify the toolchain and the
  preview-block claim yourself — do not take my word.)
- Is scoped-jsdom the right resolution, or is one of the rejected
  options actually better on grounds I have not weighed?
- Does the amendment leave spec 8's OTHER rows (cache round-trip,
  parse, null-tier regressions, the TIER-renders-"all" row) intact and
  still implementable as written?
- Is the per-file pragma genuinely isolating — can it affect any
  existing test?
- Does anything else in the frozen spec depend on the SSR-only
  assumption and now need revisiting?
- Is the `GatedCatalog` deferral right, or should it be done now
  instead of the jsdom work?

Do NOT re-litigate anything else in the frozen design. Do NOT spawn
nested verification agents. Return exactly one verdict (APPROVED /
APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED) with line-cited findings.
