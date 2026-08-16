# Packaging Intersteps Brainstorm And Spec

**Ticket:** #113
**Status:** candidate for correctness review
**Date:** 2026-08-16

## Goal

Let the user mark a fluid/gas link as travelling in packaged form. The link
inspector then shows the exact Packagers and Unpackagers, power, packaged cargo
flow, empty-container return flow, forward transport plan, and return-lane
requirements before the factory is built.

## Approaches

1. **Link-attached interstep (selected).** Keep the material graph unchanged and
   attach package/unpackage intent to the link. This reuses the existing
   transport inspector without asking the cycle-guarded solver to infer a loop.
2. **Insert two real graph stages.** Visually literal, but package/unpackage forms
   a cycle through returned containers and would corrupt the material graph's
   single-item link invariant.
3. **Standalone calculator.** Easy, but detached from the link rate, transport,
   plan persistence, and selected route. It would make users re-enter facts.

## Data Discovery

Add a pure catalog helper that discovers reversible Packager pairs from recipe
IO, not display-name spelling. For a target fluid/gas item:

- package recipe: Packager machine, target in, one container-like solid in, one
  packaged solid out;
- unpackage recipe: packaged solid in, target out, the same container solid out;
- all required IO rates remain exact `Fraction`s.

Pairs that are ambiguous or incomplete are not offered. The bundled catalog
must yield the 12 measured pairs named on #113, including Nitrogen's gas
container. A catalog regression pins all pair identities and exact rates.

## Persisted Intent

`StageLink` gains optional:

```ts
interface PackagingInterstep {
  packageRecipeId: string;
  clockPercentText: string;
  returnTransport: LinkTransport;
}
```

The package recipe ID is the pair's canonical key; discovery derives its unique
unpackage recipe from the current catalog. An unknown key remains recoverable
stale intent, while inconsistent package/unpackage ID combinations are
unrepresentable. The clock is shared by both ends, raw text, and uses the existing `(0,250]`
parser/power model. The store exposes `setLinkInterstep(linkId, value|null)`.
Every call updates the link and recomputes cached reconciliation atomically;
enable, disable, pair, and clock edits cannot leave findings from the prior
intent behind. Lifecycle tests pin enable/disable and valid-to-invalid-to-valid
transitions.
Changing the pair keeps clock; disabling removes intent. `returnTransport`
configures the empty-container route independently and defaults to belt.
Removing a link removes it naturally.

Plan persistence bumps to v8. Plan v7 remains frozen. V7-to-v8 migration copies
links without intersteps but **canonicalizes each accepted legacy transport arm**:
it rebuilds the discriminated union from that arm's recognized fields and drops
historically tolerated unknown or arm-misplaced fields. V8 strictly validates
recipe-ID and clock fields as strings plus the return-transport structure; numeric
clock semantics remain deferred to derive. A link with an interstep must use solid-cargo modes for both
its forward `transport` and `returnTransport`; pipe and fluid-truck combinations
are rejected at the v8 boundary and guarded again by derive. Save/export/import/
bundle write v8. Old builds reject v8 rather than accepting and erasing intent.

V8 validates editable transport as **raw structural intent**: known mode/trip
kind/fuel literals, required arm fields, arm-specific field placement, and
`sharedEnds` absent-or-true structure remain strict. Only numeric text semantics
are relaxed: empty/non-positive trip text on either legal route, invalid/out-of-range
pipe `deratePercentText` on legal non-interstep forward pipe links, and interstep
clock text are accepted by persistence and rejected by existing derive-time parsers. It
prevents saving an in-progress train/drone/road edit from creating an unloadable
plan. Historical v7 keeps its existing validator; migration always yields canonical,
closed-world v8. Save/load/export/bundle tests cover empty and malformed-numeric trip/clock
text plus malformed, non-positive, and above-100 pipe derates followed by exact
derive errors. Unknown/misplaced structural fields remain rejected in v8, and
v7 retains its existing semantic rejections. A fixture accepted by v7 despite an
ignored arm-misplaced field must pass v7 load -> v8 save -> v8 reload with that
field removed and all recognized transport intent preserved.

## Exact Plan

For link fluid demand `D` and clock factor `c`:

```text
package machines   = ceil(D / (package fluid input rate * c))
packaged flow       = D * package packaged-output / package fluid-input
container return   = D * package container-input / package fluid-input
unpackage machines = ceil(D / (unpackage fluid-output rate * c))
```

The selected pair is valid only if the unpackage recipe consumes the same
packaged item and returns the same container at ratios that close the steady
state. A mismatch is an explicit error, never coerced.

Power uses the Packager machine's existing exact/estimated clock model for the
sum of both machine counts. One pure `deriveLinkPlan` boundary calls an
`effectiveLinkCargo` projection
accepts independently resolved producer supply and consumer demand, maps each
through the package ratio, and returns forward packaged item plus distinct
packaged supply/demand and the return container item/rate. Inspector results,
edge chips, reconciliation/train findings, and every transport consumer use
the resulting derived-link plan rather than independently reading the original fluid item/rate.
This preserves under/over-supply and is load-bearing for packaged Nitrogen at
`D/4`.

The derived-link plan is discriminated. `ready` carries effective cargo, optional
independently resolved supply/demand, machine math when demand is solved, and
both transport results. A missing solved endpoint remains a normal unsolved or
dangling reconciliation input; `computeLinkTransport` owns its existing
`unsolved` result. Each route also retains its own transport `error` for invalid
trip numeric text, without suppressing otherwise-valid cargo, counts, or the
other route.

`unavailable` carries one exact whole-interstep error for a stale/missing/
invalid pair, invalid clock, unsafe machine-count overflow, or a pipe/fluid-truck
mode on either packaged-cargo route. It has no counts, cargo, or transport
results. This boundary alone interprets projection failure and supplies the
surface-neutral problem state. Edge status, the one reconciliation finding,
and the inspector read that result; unavailable never falls through to an `ok`
fluid edge. The result is pure and recomputable, not a second persisted or
cached store state.

Forward and return each call `computeLinkTransport` with their own solid item,
rate, and transport config. Belt/truck/tractor/explorer/train/drone are legal on
both directions; pipe and fluid-truck are not. The separate return config is
required because sharing the forward route can deadlock and because vehicle/
train/drone capacity differs by the empty container's stack size.

`returnTransport.sharedEnds.from/to` always names the physical `StageLink`
sides, not cargo direction: `from` is the producer-side packaging station and
`to` is the consumer-side unpackaging station. Return cargo travels `to -> from`
but persisted keys do not invert. Return labels and station-power exclusions use
those physical names; both one-sided cases are pinned.

The result always advises:

- seed the loop with containers (capital cannot be derived without route
  inventory/length/timing);
- provide a separate return path;

Forward and return saturation is shown by their independently computed route
results rather than duplicated as a permanent warning. Advisories are not hard
refusals. A missing/invalid pair or clock is an error and suppresses stale counts.

## Inspector Interaction

For a fluid/gas link with at least one discovered pair, render a `Package for
transport` checkbox below identity. Also render it whenever saved intent exists,
even if catalog replacement makes the pair unavailable, so the user can always
disable/recover. Enabling selects the sole pair, or shows a pair menu when
several exist, defaults clock to 100, and defaults both routes to belt. The
existing Mode menu becomes `Forward mode`; a second `Empty return mode` uses the
same solid-mode controls and trip editors. Disabling restores the normal
fluid-mode path (pipe default).

The interstep block shows package/unpackage machine counts separately, total
power, packaged/min forward, and empty containers/min return. Forward and return
transport results render separately from the canonical projection. All controls
are labeled and keyboard reachable.

No Propose changes are made. No graph stages are inserted. No container capital
count is guessed.

## Verification

- Pure pair discovery for all 12 bundled fluids/gas and malformed ambiguity.
- Water 10,600/min at 100%: 177 package, 89 unpackage, 10,600 packaged/min,
  10,600 empties/min, 2,660 MW, 9 Mk6 forward plus 9 Mk6 return lanes.
- Nitric Acid/Heavy Oil Residue prove slower-unpackage cases.
- Clock scaling, invalid clock, safe-integer overflow, ratio mismatch.
- Forward transport uses packaged item/stack size; return uses container item.
- Store lifecycle and v8 save/load/import/export/bundle/migration/strictness.
- Imported packaging plus pipe/fluid-truck is rejected; derive repeats the guard.
- Inspector, edge chip, train findings, and both route results consume the same
  effective packaged/container projection, including Nitrogen's non-1:1 ratio.
- Nitrogen under/over-supply maps producer supply and consumer demand separately;
  stale intent renders a problem edge/finding/error and no transport results.
- Inspector enable/pair/clock/disable and legal-mode switching.
- Stale pair IDs still expose disable/recovery; forward and return solid modes
  configure independently.
- Chromium desktop/mobile interaction and containment with all prior gates.

## Assumptions Ledger

| Assumption | Grounding |
|---|---|
| Intersteps are user-directed | Settled #113/#114 board decision |
| Recipe IO identifies pairs | Bundled Docs parser already retains exact recipe inputs/outputs and machine IDs |
| Empty flow closes at steady state | Pair validator requires matching container identity and reciprocal ratios |
| Capital count is out of scope | Belt length and full vehicle inventory-in-flight are not uniformly available |
| Warnings, not refusals | The factory can run when correctly seeded/routed; lock-up is configuration risk |
| v8 is required | Older v7 validators would ignore a new link field and writers would erase it |

## Review Disposition

- **r1:** folded stale-intent recovery, strict forward/return solid-mode
  invariants, a canonical effective-cargo projection for all consumers, and a
  full independently configured return transport instead of belt-only sizing.
- **r2:** expanded the projection to preserve separate supply/demand, defined an
  explicit unavailable/problem path for every consumer, and fixed return train
  shared-end keys to physical link sides with both one-sided tests.
- **r3:** defined v8 transport/clock validation as raw structural intent so
  incomplete edits survive every persistence path and fail only at derive;
  historical v7 validation remains unchanged.
- **r4:** clarified that only numeric semantics relax in v8, added every pipe
  derate raw-text case, and kept discriminants/field placement structurally strict.
