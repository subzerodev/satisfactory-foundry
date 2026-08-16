/**
 * The LinkInspector (Stage 7 / Phase 2, frozen Axis 3) — the selected-edge side
 * panel that is the transport home. Opens when a link is selected on the canvas
 * (deselect closes); shows the link identity line, a phase-filtered mode select,
 * the trip inputs, the computed fleet / train comparison / drone battery lines,
 * and the fixed per-mode caveat. The FindingsPanel / SummaryCards visual idiom.
 *
 * The only file besides App/GraphCanvas that touches transport UI. All numbers
 * come pre-formatted from the pure transport-text helpers (thin component);
 * transport math + trip parsing live in transport-plan/transport-text.
 */

import { useAppStore } from "../state/store.ts";
import type { StageLink, StageNode } from "../state/store.ts";
import type { LinkTransport, TransportMode } from "../core/link-transport.ts";
import type { PackagingInterstep } from "../core/link-transport.ts";
import type { DroneFuel } from "../core/transport-facts.ts";
import type { LinkFinding } from "../core/reconcile.ts";
import type {
  PackagingCatalog,
  PackagingPair,
} from "../core/packaging-pair.ts";
import { discoverPackagingPairs } from "../data/packaging.ts";
import { deriveLinkPlan } from "../core/link-plan.ts";
import type { DerivedLinkPlan } from "../core/link-plan.ts";
import type { Catalog } from "../data/types.ts";
import { formatRate } from "./format.ts";
import {
  linkRequiredRate,
  planForLink,
  supplySuggestionFor,
} from "./graph-flow.ts";
import {
  drawnDistanceDm,
  drawnMeters,
  applyDrawnDistanceToTransport,
} from "./chain-view.ts";
import { computeLinkTransport, legalModesFor } from "../core/transport-plan.ts";
import {
  MODE_LABEL,
  caveatFor,
  pipeCaveat,
  continuousLine,
  vehicleLine,
  vehicleStationLine,
  droneLine,
  droneBatteryLine,
  dronePortLine,
  trainRows,
  trainBeltFeedFootnote,
  trainEstimatedNote,
  trainSharedEndsFootnote,
  TRAIN_PLATFORM_FOOTNOTE,
} from "./transport-text.ts";

const DRONE_FUELS: DroneFuel[] = [
  "battery",
  "packaged-fuel",
  "packaged-turbofuel",
  "packaged-rocket-fuel",
  "uranium-fuel-rod",
  "packaged-ionized-fuel",
  "plutonium-fuel-rod",
];

const FUEL_LABEL: Record<DroneFuel, string> = {
  battery: "Battery",
  "packaged-fuel": "Packaged Fuel",
  "packaged-turbofuel": "Packaged Turbofuel",
  "packaged-rocket-fuel": "Packaged Rocket Fuel",
  "uranium-fuel-rod": "Uranium Fuel Rod",
  "packaged-ionized-fuel": "Packaged Ionized Fuel",
  "plutonium-fuel-rod": "Plutonium Fuel Rod",
};

/**
 * A fresh transport config for a mode, seeded with an empty estimated trip (the
 * honest default — the user fills in a distance). Drones default to battery
 * fuel (the P1 default). belt/pipe are trip-less.
 */
function defaultTransportFor(mode: TransportMode): LinkTransport {
  if (mode === "belt" || mode === "pipe") return { mode };
  if (mode === "drone") {
    return {
      mode: "drone",
      fuel: "battery",
      trip: { kind: "estimated", flightMetersText: "" },
    };
  }
  return { mode, trip: { kind: "estimated", distanceText: "" } };
}

/** The current mode of a link (absent transport ⇒ belt default). */
function currentMode(link: StageLink): TransportMode {
  return link.transport?.mode ?? "belt";
}

export function packagingOptionsFor(
  catalog: PackagingCatalog,
  link: StageLink,
): { visible: boolean; pairs: PackagingPair[] } {
  const pairs = discoverPackagingPairs(catalog, link.itemId);
  return { visible: pairs.length > 0 || link.interstep !== undefined, pairs };
}

/** Type guard: a transport config that carries a trip (road + train + drone). */
function isTripTransport(t: LinkTransport | undefined): t is TripTransport {
  return t !== undefined && t.mode !== "belt" && t.mode !== "pipe";
}

export function LinkInspector() {
  const selectedLinkId = useAppStore((s) => s.selectedLinkId);
  const links = useAppStore((s) => s.links);
  const stages = useAppStore((s) => s.stages);
  const stageOrder = useAppStore((s) => s.stageOrder);
  const positions = useAppStore((s) => s.positions);
  const catalog = useAppStore((s) =>
    s.catalog.status === "ready" ? s.catalog.catalog : null,
  );
  const reconciliation = useAppStore((s) => s.reconciliation);
  const setLinkTransport = useAppStore((s) => s.setLinkTransport);
  const setLinkInterstep = useAppStore((s) => s.setLinkInterstep);
  const setStageMachineCount = useAppStore((s) => s.setStageMachineCount);
  const selectLink = useAppStore((s) => s.selectLink);

  if (selectedLinkId === null || catalog === null) return null;
  const link = links.find((l) => l.id === selectedLinkId);
  if (link === undefined) return null;

  const item = catalog.items[link.itemId];
  const packaging = packagingOptionsFor(catalog, link);
  if (item === undefined && link.interstep === undefined) return null;

  const producer = stages[link.fromStageId];
  const consumer = stages[link.toStageId];
  const rate = linkRequiredRate(link, stages);

  const mode = currentMode(link);
  const legal = item === undefined ? [] : legalModesFor(item);
  // Hoist to a local so the discriminant narrowing below sticks (TS won't narrow
  // a repeated `link.transport` property access on its own).
  const transport = link.transport;

  // #34: the resolve preamble folds to planForLink. planForLink returns null
  // ONLY for a missing item, which the early-return at the top already excluded,
  // so the plan is non-null here (the `!`). An unsolved rate flows through as
  // computeLinkTransport's { kind: "unsolved" } plan, preserving the rendered
  // "solve both stages to size the fleet" line.
  const plan = item === undefined ? null : planForLink(link, catalog, stages);
  const interstepPlan =
    link.interstep === undefined ? null : deriveLinkPlan(catalog, link, stages);

  // The drawn straight-line distance between the stages (Stage 7 / Phase 3, Axis 3):
  // null when either endpoint is unsolved (not placed in the chain). Estimated-
  // mode links get the "use drawn distance" action; measured links a readout
  // only (a measured time is better information — never downgraded).
  // Unmemoized by design: this component early-returns above (no-selection /
  // missing-link guards), so a hook here would violate the Rules of Hooks —
  // the browser walk caught exactly that when a memo was tried. Recomputing
  // per render matches this file's existing plan-computation idiom.
  const distanceDm = drawnDistanceDm(
    link.id,
    catalog,
    stages,
    stageOrder,
    links,
    positions,
  );

  // Apply affordance (Stage 8 / Phase 1): the one-click match for an
  // under-supplied link. The presence rule + payload live in the pure
  // applyBlockFor helper (tested directly); null for matched/over/unsolved.
  const applyBlock = applyBlockFor(link, reconciliation, stages, links);

  return (
    <div className="link-inspector">
      <header className="link-inspector-head">
        <span className="link-inspector-title">Transport</span>
        <button
          className="link-inspector-close"
          title="close"
          onClick={() => selectLink(null)}
        >
          ✕
        </button>
      </header>

      <p className="link-inspector-identity">
        {stageName(producer)} → {stageName(consumer)} ·{" "}
        {item?.displayName ?? link.itemId}
        {rate !== null && <> · {formatRate(rate)}/min required</>}
      </p>

      {packaging.visible && (
        <label className="link-inspector-package-toggle">
          <input
            type="checkbox"
            checked={link.interstep !== undefined}
            onChange={(event) => {
              if (!event.target.checked) {
                setLinkInterstep(link.id, null);
                return;
              }
              const pair = packaging.pairs[0];
              if (pair !== undefined) {
                setLinkInterstep(link.id, {
                  packageRecipeId: pair.packageRecipe.id,
                  clockPercentText: "100",
                  returnTransport: { mode: "belt" },
                });
              }
            }}
          />{" "}
          Package for transport
        </label>
      )}

      {link.interstep !== undefined ? (
        <InterstepEditor
          catalog={catalog}
          link={{ ...link, interstep: link.interstep }}
          pairs={packaging.pairs}
          plan={interstepPlan!}
          distanceDm={distanceDm}
          fromName={stageName(producer)}
          toName={stageName(consumer)}
          onIntentChange={(intent) => setLinkInterstep(link.id, intent)}
          onForwardChange={(next) => setLinkTransport(link.id, next)}
        />
      ) : (
        item !== undefined &&
        plan !== null && (
          <RouteEditor
            title="Mode"
            transport={transport ?? defaultTransportFor(mode)}
            legalModes={legal}
            plan={plan}
            distanceDm={distanceDm}
            fromName={stageName(producer)}
            toName={stageName(consumer)}
            onChange={(next) => setLinkTransport(link.id, next)}
          />
        )
      )}

      {/* Apply affordance (Stage 8 / Phase 1, Axis 1): the match-demand button
          for an under-supplied link with a solved producer. Renders ONLY when a
          suggestion exists (matched/over/unsolved links: no block). Applying
          sets the producer to ×N and re-derives; the block then disappears (the
          finding clears) — idempotent by construction. The MeasureFeed idiom. */}
      {applyBlock !== null && (
        <SupplyApply
          shortfall={applyBlock.shortfall}
          machines={applyBlock.machines}
          total={applyBlock.total}
          producerName={applyBlock.producerName}
          onApply={() =>
            setStageMachineCount(link.fromStageId, applyBlock.machines)
          }
        />
      )}
    </div>
  );
}

function InterstepEditor({
  catalog,
  link,
  pairs,
  plan,
  distanceDm,
  fromName,
  toName,
  onIntentChange,
  onForwardChange,
}: {
  catalog: Catalog;
  link: StageLink & { interstep: PackagingInterstep };
  pairs: PackagingPair[];
  plan: DerivedLinkPlan;
  distanceDm: number | null;
  fromName: string;
  toName: string;
  onIntentChange: (intent: PackagingInterstep) => void;
  onForwardChange: (transport: LinkTransport) => void;
}) {
  const intent = link.interstep;
  const selectedPairKnown = pairs.some(
    (pair) => pair.packageRecipe.id === intent.packageRecipeId,
  );

  return (
    <div className="link-inspector-interstep">
      {pairs.length > 1 && (
        <label className="link-inspector-field">
          Packaging pair{" "}
          <select
            value={intent.packageRecipeId}
            onChange={(event) =>
              onIntentChange({
                ...intent,
                packageRecipeId: event.target.value,
              })
            }
          >
            {!selectedPairKnown && (
              <option value={intent.packageRecipeId}>
                {intent.packageRecipeId} (unavailable)
              </option>
            )}
            {pairs.map((pair) => (
              <option key={pair.packageRecipe.id} value={pair.packageRecipe.id}>
                {catalog.recipes[pair.packageRecipe.id]?.displayName ??
                  pair.packageRecipe.id}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="link-inspector-field">
        Packager clock %{" "}
        <input
          type="text"
          inputMode="decimal"
          value={intent.clockPercentText}
          onChange={(event) =>
            onIntentChange({ ...intent, clockPercentText: event.target.value })
          }
        />
      </label>

      {plan.status === "unavailable" ? (
        <p className="link-inspector-error">{plan.error}</p>
      ) : (
        <>
          <div className="link-inspector-interstep-summary">
            {plan.packageMachines !== null &&
              plan.unpackageMachines !== null &&
              plan.power !== null && (
                <p>
                  {plan.packageMachines} package · {plan.unpackageMachines}{" "}
                  unpackage · {powerText(plan.power)}
                </p>
              )}
            {plan.cargoDemand !== null && plan.containerReturnRate !== null && (
              <p>
                {formatRate(plan.cargoDemand)}/min packaged ·{" "}
                {formatRate(plan.containerReturnRate)}/min empty containers
              </p>
            )}
          </div>

          <RouteEditor
            title="Forward mode"
            transport={link.transport ?? { mode: "belt" }}
            legalModes={legalModesFor(catalog.items[plan.packagedItemId]!)}
            plan={plan.forwardTransport}
            distanceDm={distanceDm}
            fromName={fromName}
            toName={toName}
            onChange={onForwardChange}
          />
          <RouteEditor
            title="Empty return mode"
            transport={intent.returnTransport}
            legalModes={legalModesFor(catalog.items[plan.containerItemId]!)}
            plan={plan.returnTransport}
            distanceDm={distanceDm}
            fromName={fromName}
            toName={toName}
            onChange={(returnTransport) =>
              onIntentChange({ ...intent, returnTransport })
            }
          />

          <div className="link-inspector-advisories">
            <p>seed the loop with containers</p>
            <p>provide a separate return path</p>
          </div>
        </>
      )}
    </div>
  );
}

function RouteEditor({
  title,
  transport,
  legalModes,
  plan,
  distanceDm,
  fromName,
  toName,
  onChange,
}: {
  title: string;
  transport: LinkTransport;
  legalModes: readonly TransportMode[];
  plan: ReturnType<typeof computeLinkTransport>;
  distanceDm: number | null;
  fromName: string;
  toName: string;
  onChange: (transport: LinkTransport) => void;
}) {
  return (
    <section className="link-inspector-route" aria-label={title}>
      {title !== "Mode" && <h3>{title.replace(/ mode$/, "")}</h3>}
      <label className="link-inspector-mode">
        {title}{" "}
        <select
          value={transport.mode}
          onChange={(event) =>
            onChange(defaultTransportFor(event.target.value as TransportMode))
          }
        >
          {legalModes.map((candidate) => (
            <option key={candidate} value={candidate}>
              {MODE_LABEL[candidate]}
            </option>
          ))}
        </select>
      </label>

      {isTripTransport(transport) && (
        <TripFields
          transport={transport}
          labelPrefix={title === "Mode" ? "" : title.replace(/ mode$/, "")}
          onChange={onChange}
        />
      )}
      {transport.mode === "pipe" && (
        <PipeDerateField
          transport={transport}
          labelPrefix={title === "Mode" ? "" : title.replace(/ mode$/, "")}
          onChange={onChange}
        />
      )}
      {transport.mode === "train" && (
        <TrainSharedEndsFields
          transport={transport}
          fromName={fromName}
          toName={toName}
          labelPrefix={title === "Mode" ? "" : title.replace(/ mode$/, "")}
          onChange={onChange}
        />
      )}

      <Results plan={plan} fromName={fromName} toName={toName} />

      {distanceDm !== null && (
        <MeasureFeed
          distanceDm={distanceDm}
          estimated={
            isTripTransport(transport) && transport.trip.kind === "estimated"
          }
          actionLabel={title === "Mode" ? "route" : title.replace(/ mode$/, "")}
          onApply={() => {
            const next = applyDrawnDistanceToTransport(transport, distanceDm);
            if (next !== null) onChange(next);
          }}
        />
      )}

      {caveatText(transport.mode, plan) !== null && (
        <p className="link-inspector-caveat">
          {caveatText(transport.mode, plan)}
        </p>
      )}
    </section>
  );
}

function powerText(
  power: NonNullable<Extract<DerivedLinkPlan, { status: "ready" }>["power"]>,
): string {
  if (power.kind === "exact") return `${formatRate(power.mw)} MW`;
  return `≈ ${Number(power.mw.toFixed(1))} MW`;
}

/**
 * The caveat sentence for a link: pipe routes through the plan-aware
 * {@link pipeCaveat} (a derate replaces the static line) when the plan resolved
 * to a continuous result; every other mode keeps the static {@link caveatFor}.
 * A pipe whose config errored (no continuous plan) falls back to the static
 * pipe caveat — the derate error is surfaced by Results, not the caveat line.
 */
function caveatText(
  mode: TransportMode,
  plan: ReturnType<typeof computeLinkTransport>,
): string | null {
  if (mode === "pipe" && plan.kind === "continuous") {
    return pipeCaveat(plan);
  }
  return caveatFor(mode);
}

// ---------------------------------------------------------------------------
// Supply apply — the under-supply match-demand action (Stage 8 / Phase 1).
// ---------------------------------------------------------------------------

/**
 * The under-supply readout + the "apply ×N to <producer>" action. Names the
 * producer and states the shortfall; the ×N is the fan-out-aggregated match
 * count (supplySuggestionFor). "×N total" when the producer fans the item out
 * to more than one consumer (the frozen fan-out wording, mirroring the edge
 * label). Mounted only for under-supplied links with a solved producer.
 */
function SupplyApply({
  shortfall,
  machines,
  total,
  producerName,
  onApply,
}: {
  shortfall: string;
  machines: number;
  total: boolean;
  producerName: string;
  onApply: () => void;
}) {
  return (
    <div className="link-inspector-supply">
      <p className="link-inspector-supply-readout">
        supply short {shortfall}/min
      </p>
      <button
        type="button"
        className="link-inspector-supply-apply"
        onClick={onApply}
      >
        apply ×{machines}
        {total ? " total" : ""} to {producerName}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trip fields — the measured/estimated toggle + the number field(s).
// ---------------------------------------------------------------------------

function TripFields({
  transport,
  labelPrefix,
  onChange,
}: {
  transport: TripTransport;
  labelPrefix: string;
  onChange: (t: LinkTransport) => void;
}) {
  const isDrone = transport.mode === "drone";
  const kind = transport.trip.kind;

  return (
    <div className="link-inspector-trip">
      <div className="link-inspector-basis">
        <label>
          <input
            type="radio"
            checked={kind === "estimated"}
            onChange={() => onChange(toEstimated(transport))}
          />{" "}
          {labelPrefix && `${labelPrefix} `}estimated
        </label>
        <label>
          <input
            type="radio"
            checked={kind === "measured"}
            onChange={() => onChange(toMeasured(transport))}
          />{" "}
          {labelPrefix && `${labelPrefix} `}measured
        </label>
      </div>

      {isDrone && (
        <label className="link-inspector-fuel">
          {labelPrefix && `${labelPrefix} `}Fuel{" "}
          <select
            value={transport.fuel}
            onChange={(e) =>
              onChange({ ...transport, fuel: e.target.value as DroneFuel })
            }
          >
            {DRONE_FUELS.map((f) => (
              <option key={f} value={f}>
                {FUEL_LABEL[f]}
              </option>
            ))}
          </select>
        </label>
      )}

      {kind === "estimated" ? (
        <label className="link-inspector-field">
          {labelPrefix && `${labelPrefix} `}
          {isDrone
            ? "round-trip flight distance (m)"
            : "one-way distance (m)"}{" "}
          <input
            type="text"
            inputMode="decimal"
            value={estimatedText(transport)}
            onChange={(e) =>
              onChange(setEstimatedText(transport, e.target.value))
            }
          />
        </label>
      ) : (
        <>
          <label className="link-inspector-field">
            {labelPrefix && `${labelPrefix} `}round-trip time (s){" "}
            <input
              type="text"
              inputMode="decimal"
              value={measuredSecondsText(transport)}
              onChange={(e) =>
                onChange(setMeasuredSeconds(transport, e.target.value))
              }
            />
          </label>
          {isDrone && (
            <label className="link-inspector-field">
              {labelPrefix && `${labelPrefix} `}round-trip flight distance (m,
              optional){" "}
              <input
                type="text"
                inputMode="decimal"
                value={droneMeasuredMeters(transport)}
                onChange={(e) =>
                  onChange(setDroneMeasuredMeters(transport, e.target.value))
                }
              />
            </label>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Measure feed — the drawn straight-line distance between stage sites (Stage 7 / Phase 3, Axis 3).
// ---------------------------------------------------------------------------

/**
 * The drawn straight-line distance readout + (estimated-mode only) the "use
 * drawn distance" action. The distance measures the DRAWN plan — a lower bound
 * on any real route — so it is labelled "optimistic". Measured-mode links show
 * the readout with no action (a measured time is better information than a drawn
 * line — never downgraded).
 */
function MeasureFeed({
  distanceDm,
  estimated,
  actionLabel,
  onApply,
}: {
  distanceDm: number;
  estimated: boolean;
  actionLabel: string;
  onApply: () => void;
}) {
  return (
    <div className="link-inspector-measure">
      <p className="link-inspector-measure-readout">
        drawn straight-line — optimistic · {drawnMeters(distanceDm)} m
      </p>
      {estimated && (
        <button
          type="button"
          className="link-inspector-measure-apply"
          onClick={onApply}
        >
          use drawn distance for {actionLabel}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Results — the fleet lines / train table / errors, dispatched by plan kind.
// ---------------------------------------------------------------------------

function Results({
  plan,
  fromName,
  toName,
}: {
  plan: ReturnType<typeof computeLinkTransport>;
  fromName: string;
  toName: string;
}) {
  switch (plan.kind) {
    case "unsolved":
      return (
        <p className="link-inspector-unsolved">
          solve both stages to size the fleet
        </p>
      );
    case "error":
      return <p className="link-inspector-error">{plan.message}</p>;
    case "continuous":
      return <p className="link-inspector-result">{continuousLine(plan)}</p>;
    case "vehicle":
      return (
        <div className="link-inspector-result">
          <p>{vehicleLine(plan)}</p>
          <p className="link-inspector-power">{vehicleStationLine(plan)}</p>
        </div>
      );
    case "drone":
      return (
        <div className="link-inspector-result">
          <p>{droneLine(plan)}</p>
          <p className="link-inspector-power">{droneBatteryLine(plan)}</p>
          <p className="link-inspector-power">{dronePortLine(plan)}</p>
        </div>
      );
    case "train":
      return <TrainTable plan={plan} fromName={fromName} toName={toName} />;
  }
}

function TrainTable({
  plan,
  fromName,
  toName,
}: {
  plan: Extract<ReturnType<typeof computeLinkTransport>, { kind: "train" }>;
  fromName: string;
  toName: string;
}) {
  const rows = trainRows(plan);
  const estimatedNote = trainEstimatedNote(plan);
  const sharedNote = trainSharedEndsFootnote(plan, fromName, toName);
  return (
    <div className="link-inspector-train">
      <table className="train-table">
        <thead>
          <tr>
            <th>cars</th>
            <th>trains</th>
            <th>station MW</th>
            <th>sustained /min</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.cars}>
              <td>{r.cars}</td>
              <td>{r.trains}</td>
              <td>{r.stationMw}</td>
              <td>{r.sustainedRate}</td>
              <td>{r.stationLimited ? "station-limited" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="train-footnote">{TRAIN_PLATFORM_FOOTNOTE}</p>
      <p className="train-footnote">{trainBeltFeedFootnote(plan)}</p>
      {sharedNote !== null && <p className="train-footnote">{sharedNote}</p>}
      {estimatedNote !== null && (
        <p className="train-footnote">{estimatedNote}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pipe derate field (S8P2) — an optional (0,100] percentage, empty ⇒ stripped.
// ---------------------------------------------------------------------------

function PipeDerateField({
  transport,
  labelPrefix,
  onChange,
}: {
  transport: Extract<LinkTransport, { mode: "pipe" }>;
  labelPrefix: string;
  onChange: (t: LinkTransport) => void;
}) {
  return (
    <label className="link-inspector-field link-inspector-derate">
      {labelPrefix && `${labelPrefix} `}derate %{" "}
      <input
        type="text"
        inputMode="decimal"
        value={transport.deratePercentText ?? ""}
        onChange={(e) => onChange(setPipeDerate(e.target.value))}
      />
    </label>
  );
}

/** Build the next pipe config from a derate-field edit: empty text STRIPS the
 *  key (the optional-field idiom — never store "" ), any other text carries it
 *  raw (validity is a derive-time concern, the clock-text precedent). */
export function setPipeDerate(text: string): LinkTransport {
  return text === ""
    ? { mode: "pipe" }
    : { mode: "pipe", deratePercentText: text };
}

// ---------------------------------------------------------------------------
// Train shared-end overrides (S8P2) — two checkboxes, absent-or-true stripping.
// ---------------------------------------------------------------------------

function TrainSharedEndsFields({
  transport,
  fromName,
  toName,
  labelPrefix,
  onChange,
}: {
  transport: Extract<LinkTransport, { mode: "train" }>;
  fromName: string;
  toName: string;
  labelPrefix: string;
  onChange: (t: LinkTransport) => void;
}) {
  const shared = transport.sharedEnds;
  return (
    <div className="link-inspector-shared-ends">
      <label>
        <input
          type="checkbox"
          checked={shared?.from === true}
          onChange={(e) =>
            onChange(setSharedEnd(transport, "from", e.target.checked))
          }
        />{" "}
        {labelPrefix && `${labelPrefix} `}station at {fromName} is shared
      </label>
      <label>
        <input
          type="checkbox"
          checked={shared?.to === true}
          onChange={(e) =>
            onChange(setSharedEnd(transport, "to", e.target.checked))
          }
        />{" "}
        {labelPrefix && `${labelPrefix} `}station at {toName} is shared
      </label>
    </div>
  );
}

/**
 * Build the next train config from a shared-end checkbox toggle (S8P2). The
 * absent-or-true idiom, applied at the write: checking sets the key to `true`;
 * UNCHECKING strips it; when the last flagged end is stripped, the whole
 * `sharedEnds` field is dropped (never a persisted `{}`), so an all-off train
 * config is byte-identical to today's (no override).
 */
export function setSharedEnd(
  transport: Extract<LinkTransport, { mode: "train" }>,
  end: "from" | "to",
  shared: boolean,
): LinkTransport {
  const next: { from?: true; to?: true } = { ...transport.sharedEnds };
  if (shared) {
    next[end] = true;
  } else {
    delete next[end];
  }
  // trainWithTrip is the single train-arm assembly point: passing undefined
  // when no flag survives keeps an all-off config byte-identical to today's
  // (no key, no empty {}); the trip carries verbatim.
  return trainWithTrip(transport.trip, next.from || next.to ? next : undefined);
}

// ---------------------------------------------------------------------------
// Trip-config editing helpers (pure — build the next LinkTransport from an edit).
// ---------------------------------------------------------------------------

/** The trip-carrying transport arms (road + train + drone) — belt/pipe excluded
 *  by the discriminant, matching the call-site narrowing exactly. */
type TripTransport = Exclude<LinkTransport, { mode: "belt" | "pipe" }>;

/** Rebuild a train config around a new trip, carrying `sharedEnds` through —
 *  a trip edit must not wipe the per-end override (boundary-review fold). */
function trainWithTrip(
  trip: Extract<LinkTransport, { mode: "train" }>["trip"],
  sharedEnds: { from?: true; to?: true } | undefined,
): LinkTransport {
  const base: LinkTransport = { mode: "train", trip };
  return sharedEnds !== undefined ? { ...base, sharedEnds } : base;
}

export function toEstimated(t: TripTransport): LinkTransport {
  if (t.mode === "drone") {
    return {
      mode: "drone",
      fuel: t.fuel,
      trip: { kind: "estimated", flightMetersText: "" },
    };
  }
  const trip = { kind: "estimated", distanceText: "" } as const;
  if (t.mode === "train") return trainWithTrip(trip, t.sharedEnds);
  return { mode: t.mode, trip };
}

export function toMeasured(t: TripTransport): LinkTransport {
  if (t.mode === "drone") {
    return {
      mode: "drone",
      fuel: t.fuel,
      trip: { kind: "measured", roundTripSecondsText: "" },
    };
  }
  const trip = { kind: "measured", roundTripSecondsText: "" } as const;
  if (t.mode === "train") return trainWithTrip(trip, t.sharedEnds);
  return { mode: t.mode, trip };
}

function estimatedText(t: TripTransport): string {
  if (t.trip.kind !== "estimated") return "";
  return t.mode === "drone" ? t.trip.flightMetersText : t.trip.distanceText;
}

export function setEstimatedText(
  t: TripTransport,
  text: string,
): LinkTransport {
  if (t.mode === "drone") {
    return {
      mode: "drone",
      fuel: t.fuel,
      trip: { kind: "estimated", flightMetersText: text },
    };
  }
  const trip = { kind: "estimated", distanceText: text } as const;
  if (t.mode === "train") return trainWithTrip(trip, t.sharedEnds);
  return { mode: t.mode, trip };
}

function measuredSecondsText(t: TripTransport): string {
  return t.trip.kind === "measured" ? t.trip.roundTripSecondsText : "";
}

export function setMeasuredSeconds(
  t: TripTransport,
  text: string,
): LinkTransport {
  if (t.mode === "drone") {
    const existingMeters =
      t.trip.kind === "measured" ? t.trip.flightMetersText : undefined;
    return {
      mode: "drone",
      fuel: t.fuel,
      trip: {
        kind: "measured",
        roundTripSecondsText: text,
        ...(existingMeters !== undefined && existingMeters !== ""
          ? { flightMetersText: existingMeters }
          : {}),
      },
    };
  }
  const trip = { kind: "measured", roundTripSecondsText: text } as const;
  if (t.mode === "train") return trainWithTrip(trip, t.sharedEnds);
  return { mode: t.mode, trip };
}

function droneMeasuredMeters(t: TripTransport): string {
  if (t.mode !== "drone" || t.trip.kind !== "measured") return "";
  return t.trip.flightMetersText ?? "";
}

function setDroneMeasuredMeters(t: TripTransport, text: string): LinkTransport {
  if (t.mode !== "drone" || t.trip.kind !== "measured") return t;
  return {
    mode: "drone",
    fuel: t.fuel,
    trip: {
      kind: "measured",
      roundTripSecondsText: t.trip.roundTripSecondsText,
      ...(text !== "" ? { flightMetersText: text } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Apply affordance — the pure presence-rule + payload for the supply block.
// ---------------------------------------------------------------------------

/** The rendered fields of the under-supply apply block: the shortfall readout,
 *  the match-demand count, whether the producer fans out (the "total" wording),
 *  and the producer's display name. */
export interface ApplyBlock {
  shortfall: string;
  machines: number;
  total: boolean;
  producerName: string;
}

/**
 * The apply block for a link, or null when it must not render (Stage 8 / Phase
 * 1, Axis 1). Gated on BOTH the SAME linkId-keyed under-supply finding the edge
 * label reads (no new detection math) AND a non-null supplySuggestionFor (solved
 * producer with an output lane). The ×N + fan-out wording come from the SAME
 * supplySuggestionFor data the edge label renders — one source, no drift. Null
 * for matched/over-supplied/unsolved links; idempotent by construction (once the
 * apply covers demand the finding clears, so this returns null on the next
 * render). Pure over the passed slice — no store, no DOM (tested directly).
 */
export function applyBlockFor(
  link: StageLink,
  reconciliation: LinkFinding[],
  stages: Record<string, StageNode>,
  links: StageLink[],
): ApplyBlock | null {
  const finding = reconciliation.find(
    (f): f is Extract<LinkFinding, { type: "under-supply" }> =>
      f.linkId === link.id && f.type === "under-supply",
  );
  if (finding === undefined) return null;
  const suggestion = supplySuggestionFor(
    link.fromStageId,
    link.itemId,
    stages,
    links,
  );
  if (suggestion === null) return null;
  return {
    shortfall: formatRate(finding.shortfall),
    machines: suggestion.machines,
    total: suggestion.fanOut,
    producerName: stageName(stages[link.fromStageId]),
  };
}

// ---------------------------------------------------------------------------
// Small resolvers.
// ---------------------------------------------------------------------------

function stageName(stage: { name: string } | undefined): string {
  return stage?.name ?? "(removed)";
}
