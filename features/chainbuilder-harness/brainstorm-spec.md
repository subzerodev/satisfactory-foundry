# Shared ChainBuilder jsdom harness (#109)

Status: Frozen after correctness convergence and one-shot simplify disposition.

## Purpose

Four jsdom suites now duplicate the same ChainBuilder mount, DOM event, query,
proposal, and teardown mechanics:

- `ChainBuilder.gating.test.tsx` (758 lines);
- `ChainBuilder.rawtarget.test.tsx` (200 lines);
- `ChainBuilder.output.test.tsx` (127 lines);
- `ChainBuilder.byproduct-routing.test.tsx` (503 lines).

The original ticket deferred extraction while only two copies existed. Output
and byproduct-routing have since crossed the explicit third-copy trigger. The
four local harness regions total roughly 300 lines including suite-specific
state setup; measurement indicates about 100-140 net lines should be removable
after retaining those differences and each file's hoisted storage stub.

This is test infrastructure only. Production behavior, existing assertions,
existing test names, catalog fixtures, and suite boundaries must not change.
Harness-only contract tests may be added for rollback and idempotent cleanup.

## Settled constraints

- Keep every `vi.hoisted` `localStorage` stub in its test file. Hoisted code runs
  before imported bindings initialize; an imported helper cannot safely be
  called there, and a global Vitest setup would alter unrelated node suites.
- Keep the four test files separate. Their fixtures and behavioral subjects are
  intentionally different.
- Migrate all four live jsdom copies, not only the original gating/raw-target
  pair; leaving output or byproduct-routing local would preserve the coupling.
- Reuse React's real DOM/event path. Do not replace interaction tests with direct
  state calls or implementation-detail component hooks.

## Options

### A. Global Vitest setup

Install storage and DOM helpers through `vite.config.ts` setup files.

Rejected. It broadens a local refactor across all 35 test files, changes the
node-suite storage environment, and still does not provide a mounted component
handle without shared mutable state.

### B. Shared singleton harness

Export module-level `container`/`root` plus global query helpers.

Rejected. Hidden mutable state makes cleanup ordering implicit and prevents two
mounts from coexisting safely.

### C. Stateless mounted handle

Add `src/ui/ChainBuilder.harness.tsx`. Each suite performs its own state setup,
then parameterless `mountChainBuilder()` mounts the real component and returns
a handle whose methods close over that mount.

Chosen. It removes mechanics while leaving fixture/state ownership in each
suite and makes teardown explicit.

## Harness contract

```ts
export interface MountedChainBuilder {
  readonly container: HTMLDivElement;
  query<T extends Element>(selector: string): T;
  queryAll<T extends Element>(selector: string): T[];
  chooseOption(element: HTMLSelectElement, value: string): void;
  typeInto(element: HTMLInputElement, value: string): void;
  click(element: HTMLElement): void;
  propose(itemId: string, rate: string): void;
  cleanup(): void;
}

export function mountChainBuilder(): MountedChainBuilder;
```

Implementation rules:

- the module sets `IS_REACT_ACT_ENVIRONMENT` once;
- each suite's local `mount` wrapper remains responsible for `appStore` state,
  catalog, prefs, and any fresh-store reset before calling the shared mount;
- all writes/clicks are wrapped in `act`;
- `typeInto` uses the native `HTMLInputElement.prototype.value` setter so React's
  value tracker observes the change;
- `propose` selects the first target select, types the first rate input, and
  privately finds/clicks the exact `Propose` text button, matching all four
  existing suites;
- `query` preserves the current fail-fast non-null posture;
- `cleanup` unmounts under `act`, removes the container, and is idempotent;
- mounting is transactional: after appending the container, wrap `createRoot`
  and the initial `act(root.render(...))` in `try/catch`. If either throws,
  unmount any created root under `act` on a best-effort basis, always remove the
  container, then rethrow the original error. No partial DOM/root can escape
  before the caller receives its handle;
- the handle owns no storage or app-state reset. Each suite clears its own
  hoisted stub after cleanup.

Suite-specific helpers such as exact-text `Apply`, tier selection, metric lookup,
exclusion toggles, stage pickers, route controls, and fixed target/rate wrappers
remain local but compose `query*`, `click`, and the other generic handle methods.

## Migration

Each suite keeps a nullable local handle:

```ts
let harness: MountedChainBuilder | null = null;

afterEach(() => {
  harness?.cleanup();
  harness = null;
  storage.clear();
});
```

Its `mount` wrapper performs its existing store/catalog setup, then assigns
`mountChainBuilder()`. Existing `container` reads become `harness.container` or
`harness.query*`; event mechanics delegate to the handle. No assertion or
fixture rewrite is in scope.

## Verification

1. Record baseline test names/counts for all four files.
2. Migrate one suite at a time and keep its focused tests green.
3. Run all four together and confirm the same 35 existing tests and names pass;
   run the separate harness contract tests in addition.
4. Mutation evidence: temporarily remove the shared `propose` click, capture
   genuine Vitest failures from every migrated suite's preview-dependent tests,
   restore, and rerun green. Record this in
   `features/chainbuilder-harness/r2-verification.log` even though no production
   code or new tests trigger the global bidirectionality rule.
5. Run full tests, `npm run check`, and `npm run build`.
6. Measure final line delta and report the actual net reduction; do not claim
   the estimate as the result.
7. Failure-path verification forces the initial render to throw, asserts the
   original error escapes and no container remains, then calls successful-handle
   cleanup, asserts `harness.container.isConnected === false`, calls cleanup a
   second time, and asserts the second call is a no-op.

## Acceptance criteria

- All four jsdom suites use `ChainBuilder.harness.tsx` for shared mount, query,
  event, proposal, and cleanup mechanics.
- Hoisted storage remains local and executes before `store.ts` evaluation.
- Suite-specific setup, fixtures, assertions, names, and behavior stay intact.
- No shared mutable singleton or global test-environment change is introduced.
- The four migrated files retain their baseline 35 tests/names, harness contract
  tests pin rollback/idempotence, mutation evidence proves the shared proposal
  path is live, and the full suite/check/build pass.
- The completion note records measured net line reduction.

## Assumptions ledger

- `vi.hoisted` import-order constraint is grounded in the current inline
  rationale and Zustand's eager `createJSONStorage` use, not inferred from line
  similarity alone.
- The first target select/rate input and exact `Propose` button are shared by all
  four current suites, verified against live source before specifying `propose`.
- A mounted handle is the smallest abstraction that removes mechanics without
  taking ownership of catalog/store fixtures.
- This refactor adds no production behavior. New tests are limited to the shared
  harness's cleanup contract; the mutation log separately guards against
  weakening the 35 migrated behavior tests.

## Revision history

- **v1 correctness r1:** both reviewers `NEEDS_REWORK`; folded transactional
  rollback for create/render failure and explicit rollback/idempotence
  verification so a handle that has not returned cannot leak its partial mount.
- **v2 correctness r2:** code-reviewer `APPROVED`; adversarial-reviewer
  `APPROVED_WITH_NITS`. Folded the explicit post-cleanup `isConnected === false`
  assertion so idempotence cannot mask an attached-container leak.
- **v3 simplify (one-shot):** `APPROVED_WITH_NITS`; folded both findings by
  removing the setup callback and public `clickText`. Suite-owned setup remains
  in local wrappers; shared `propose` owns its private exact-text lookup and the
  byproduct suite keeps its local command helper.
