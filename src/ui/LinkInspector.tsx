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
import type {
  LinkTransport,
  TransportMode,
  StageLink,
} from "../state/store.ts";
import type { DroneFuel } from "../core/transport-facts.ts";
import { formatRate } from "./format.ts";
import { linkRequiredRate, globalUnlockedTiers } from "./graph-flow.ts";
import {
  drawnDistanceDm,
  drawnMeters,
  applyDrawnDistance,
  isEstimatedLink,
} from "./chain-view.ts";
import { computeLinkTransport, legalModesFor } from "./transport-plan.ts";
import {
  MODE_LABEL,
  caveatFor,
  continuousLine,
  vehicleLine,
  vehicleStationLine,
  droneLine,
  droneBatteryLine,
  dronePortLine,
  trainRows,
  trainBeltFeedFootnote,
  trainEstimatedNote,
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
  const setLinkTransport = useAppStore((s) => s.setLinkTransport);
  const selectLink = useAppStore((s) => s.selectLink);

  if (selectedLinkId === null || catalog === null) return null;
  const link = links.find((l) => l.id === selectedLinkId);
  if (link === undefined) return null;

  const item = catalog.items[link.itemId];
  if (item === undefined) return null;

  const producer = stages[link.fromStageId];
  const consumer = stages[link.toStageId];
  const rate = linkRequiredRate(link, stages);

  const mode = currentMode(link);
  const legal = legalModesFor(item);
  // Hoist to a local so the discriminant narrowing below sticks (TS won't narrow
  // a repeated `link.transport` property access on its own).
  const transport = link.transport;

  const plan = computeLinkTransport(
    rate,
    transport,
    item,
    catalog.tiers,
    globalUnlockedTiers(catalog, stages),
  );

  // The combined-view drawn straight-line distance (Stage 7 / Phase 3, Axis 3):
  // null when either endpoint is unsolved (not placed in the chain). Estimated-
  // mode links get the "use drawn distance" action; measured links a readout
  // only (a measured time is better information — never downgraded).
  const distanceDm = drawnDistanceDm(
    link.id,
    catalog,
    stages,
    stageOrder,
    links,
    positions,
  );

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
        {stageName(producer)} → {stageName(consumer)} · {item.displayName}
        {rate !== null && <> · {formatRate(rate)}/min required</>}
      </p>

      <label className="link-inspector-mode">
        Mode{" "}
        <select
          value={mode}
          onChange={(e) =>
            setLinkTransport(
              link.id,
              defaultTransportFor(e.target.value as TransportMode),
            )
          }
        >
          {legal.map((m) => (
            <option key={m} value={m}>
              {MODE_LABEL[m]}
            </option>
          ))}
        </select>
      </label>

      {/* Trip inputs for the modes that take one (belt/pipe are trip-less). The
          discriminant check narrows link.transport to the trip-carrying arms. */}
      {isTripTransport(transport) && (
        <TripFields
          transport={transport}
          onChange={(t) => setLinkTransport(link.id, t)}
        />
      )}

      {/* Results (solved-only). An unsolved link shows the mode select but no
          fleet math; an errored config shows its message. */}
      <Results plan={plan} />

      {/* Measure feed (Stage 7 / Phase 3, Axis 3): the combined-view drawn
          straight-line distance. Estimated-mode links get a "use drawn distance"
          button; measured links a readout only. Absent when either endpoint is
          unsolved (no chain placement). */}
      {distanceDm !== null && (
        <MeasureFeed
          distanceDm={distanceDm}
          estimated={isEstimatedLink(link)}
          onApply={() => {
            const next = applyDrawnDistance(link, distanceDm);
            if (next !== null) setLinkTransport(link.id, next);
          }}
        />
      )}

      {caveatFor(mode) !== null && (
        <p className="link-inspector-caveat">{caveatFor(mode)}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trip fields — the measured/estimated toggle + the number field(s).
// ---------------------------------------------------------------------------

function TripFields({
  transport,
  onChange,
}: {
  transport: TripTransport;
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
          estimated
        </label>
        <label>
          <input
            type="radio"
            checked={kind === "measured"}
            onChange={() => onChange(toMeasured(transport))}
          />{" "}
          measured
        </label>
      </div>

      {isDrone && (
        <label className="link-inspector-fuel">
          Fuel{" "}
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
          {isDrone ? "round-trip flight distance (m)" : "one-way distance (m)"}{" "}
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
            round-trip time (s){" "}
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
              round-trip flight distance (m, optional){" "}
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
// Measure feed — the combined-view drawn distance (Stage 7 / Phase 3, Axis 3).
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
  onApply,
}: {
  distanceDm: number;
  estimated: boolean;
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
          use drawn distance
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Results — the fleet lines / train table / errors, dispatched by plan kind.
// ---------------------------------------------------------------------------

function Results({ plan }: { plan: ReturnType<typeof computeLinkTransport> }) {
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
      return <TrainTable plan={plan} />;
  }
}

function TrainTable({
  plan,
}: {
  plan: Extract<ReturnType<typeof computeLinkTransport>, { kind: "train" }>;
}) {
  const rows = trainRows(plan);
  const estimatedNote = trainEstimatedNote(plan);
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
      {estimatedNote !== null && (
        <p className="train-footnote">{estimatedNote}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trip-config editing helpers (pure — build the next LinkTransport from an edit).
// ---------------------------------------------------------------------------

/** The trip-carrying transport arms (road + train + drone) — belt/pipe excluded
 *  by the discriminant, matching the call-site narrowing exactly. */
type TripTransport = Exclude<LinkTransport, { mode: "belt" | "pipe" }>;

function toEstimated(t: TripTransport): LinkTransport {
  if (t.mode === "drone") {
    return {
      mode: "drone",
      fuel: t.fuel,
      trip: { kind: "estimated", flightMetersText: "" },
    };
  }
  return { mode: t.mode, trip: { kind: "estimated", distanceText: "" } };
}

function toMeasured(t: TripTransport): LinkTransport {
  if (t.mode === "drone") {
    return {
      mode: "drone",
      fuel: t.fuel,
      trip: { kind: "measured", roundTripSecondsText: "" },
    };
  }
  return { mode: t.mode, trip: { kind: "measured", roundTripSecondsText: "" } };
}

function estimatedText(t: TripTransport): string {
  if (t.trip.kind !== "estimated") return "";
  return t.mode === "drone" ? t.trip.flightMetersText : t.trip.distanceText;
}

function setEstimatedText(t: TripTransport, text: string): LinkTransport {
  if (t.mode === "drone") {
    return {
      mode: "drone",
      fuel: t.fuel,
      trip: { kind: "estimated", flightMetersText: text },
    };
  }
  return { mode: t.mode, trip: { kind: "estimated", distanceText: text } };
}

function measuredSecondsText(t: TripTransport): string {
  return t.trip.kind === "measured" ? t.trip.roundTripSecondsText : "";
}

function setMeasuredSeconds(t: TripTransport, text: string): LinkTransport {
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
  return {
    mode: t.mode,
    trip: { kind: "measured", roundTripSecondsText: text },
  };
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
// Small resolvers.
// ---------------------------------------------------------------------------

function stageName(stage: { name: string } | undefined): string {
  return stage?.name ?? "(removed)";
}
