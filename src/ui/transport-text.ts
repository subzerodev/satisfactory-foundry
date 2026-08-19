/**
 * Transport display wording (Stage 7 / Phase 2, frozen Axis 3) — a PURE,
 * testable sibling of advice.ts. It owns every rendered transport string: fleet
 * lines, the train option rows, the mode caveat sentences, and the estimated
 * "at top speed — optimistic" suffix, so the LinkInspector / edge components
 * stay thin. All numbers go through formatRate's EXACT boundary (no floats leak
 * here — the labeled-approximation boundary is advice.ts's alone; transport math
 * is exact Fractions/bigints end to end).
 *
 * Provable-claim wording only (the S6 precedent): each caveat is a fixed
 * sentence made from a P1 module-level invariant doc-comment; the estimated
 * suffix is a label, not a recomputation.
 */

import { Fraction } from "../core/fraction.ts";
import { BATTERY_ENERGY_MJ } from "../core/transport-facts.ts";
import type { TrainOption } from "../core/transport.ts";
import { formatRate } from "./format.ts";
import type { LinkTransport, TransportMode } from "../core/link-transport.ts";
import type { DerivedLinkPlan } from "../core/link-plan.ts";
import type {
  TransportPlan,
  TransportContinuous,
  TransportVehicle,
  TransportTrain,
  TransportDrone,
} from "../core/transport-plan.ts";

/** The optimistic suffix appended to every estimated-basis result (the tripBasis
 *  echo / train trip.kind drives it — a label, never a recomputation). */
export const ESTIMATED_SUFFIX = " at top speed — optimistic";

/** Human labels for each transport mode (used in the mode select + chips). */
export const MODE_LABEL: Record<string, string> = {
  belt: "Belt",
  pipe: "Pipe",
  truck: "Truck",
  tractor: "Tractor",
  explorer: "Explorer",
  "fluid-truck": "Fluid Truck",
  train: "Train",
  drone: "Drone",
};

/** The fixed per-mode caveat sentence (a P1 invariant doc-comment made words),
 *  or null for a mode that carries none. Pipe's caveat is PLAN-DEPENDENT (S8P2 —
 *  a derate replaces the static line), so the LinkInspector routes pipe through
 *  {@link pipeCaveat} instead; this keeps the static wording for the pipe test
 *  precedent and the other modes. */
export function caveatFor(mode: string): string | null {
  switch (mode) {
    case "pipe":
      return "nominal ceiling — manifolds can sustain less";
    case "truck":
    case "tractor":
    case "explorer":
    case "fluid-truck":
      return ">1 vehicle: station queueing not modeled";
    case "train":
      return "signal headway not modeled";
    case "drone":
      return "shared destination ports queue";
    default:
      return null; // belt has no caveat
  }
}

/**
 * The pipe-mode caveat, plan-aware (S8P2). With a derate active, the static
 * nominal-ceiling sentence is REPLACED by a line naming the derate's provenance
 * — it is the USER's own assumption, not a wiki-grounded game constant, so the
 * wording says so plainly. Without a derate, today's static caveat renders
 * unchanged. The percentage is formatted exactly off the parsed derive Fraction
 * (no re-parse — the single-parse invariant).
 */
export function pipeCaveat(plan: TransportContinuous): string {
  if (plan.deratePercent === null) {
    return "nominal ceiling — manifolds can sustain less";
  }
  return `derated to ${formatRate(plan.deratePercent)}% of nominal — your assumption, not a game constant`;
}

// ---------------------------------------------------------------------------
// Fleet lines per result kind.
// ---------------------------------------------------------------------------

/**
 * Exact rate when it terminates; otherwise the honest ≈ 1-dp approximation
 * (the advice.ts labeled-float discipline — a raw "4800000/5177" cell is
 * exact but unreadable; the ≈ prefix carries the honesty). Float math is
 * confined to this labeled display boundary.
 */
function formatRateOrApprox(f: Fraction): string {
  const exact = formatRate(f);
  if (!exact.includes("/")) return exact;
  const approx = Number(f.num) / Number(f.den);
  return `≈ ${approx.toFixed(1)}`;
}

/** "N belts sustain X/min" — continuous (belt/pipe) fleet line. */
export function continuousLine(plan: TransportContinuous): string {
  const { runs, laneRate } = plan.result;
  const lane = plan.mode === "belt" ? "belt" : "pipe";
  const noun = runs === 1n ? lane : `${lane}s`;
  return `${runs} ${noun} ${runs === 1n ? "sustains" : "sustain"} ${formatRateOrApprox(laneRate)}/min each`;
}

/** "3 trucks sustain 480/min over this trip" — road fleet line, with the
 *  optimistic suffix on an estimated trip (the tripBasis echo drives it). */
export function vehicleLine(plan: TransportVehicle): string {
  const { nVehicles, ratePerVehicle, tripBasis } = plan.result;
  const noun =
    nVehicles === 1n ? vehicleNoun(plan.mode) : vehicleNounPlural(plan.mode);
  const base = `${nVehicles} ${noun} ${nVehicles === 1n ? "sustains" : "sustain"} ${formatRateOrApprox(ratePerVehicle)}/min each over this trip`;
  return tripBasis === "estimated" ? base + ESTIMATED_SUFFIX : base;
}

/** The station power line for a road mode ("station power 40 MW · both ends"). */
export function vehicleStationLine(plan: TransportVehicle): string {
  return `station power ${formatRate(plan.stationPowerMw)} MW · both ends`;
}

/** "N drones sustain X/min" + the battery line (or the add-distance prompt). */
export function droneLine(plan: TransportDrone): string {
  const { nDrones, ratePerDrone, tripBasis } = plan.result;
  const noun = nDrones === 1n ? "drone" : "drones";
  const base = `${nDrones} ${noun} ${nDrones === 1n ? "sustains" : "sustain"} ${formatRateOrApprox(ratePerDrone)}/min each`;
  return tripBasis === "estimated" ? base + ESTIMATED_SUFFIX : base;
}

/** The drone energy line. "N batteries" is only an honest unit when battery IS
 *  the selected fuel; for any other fuel the per-item count is not P1-groundable
 *  (only BATTERY_ENERGY_MJ is a catalogue export), so the line renders the
 *  EXACT round-trip energy in MJ instead (batteriesPerTrip × 6000 — exact by
 *  construction). Null stays the honest prompt (measured without a distance). */
export function droneBatteryLine(plan: TransportDrone): string {
  const batteries = plan.result.batteriesPerTrip;
  if (batteries === null) {
    return plan.fuel === "battery"
      ? "add flight distance for battery cost"
      : "add flight distance for energy cost";
  }
  if (plan.fuel === "battery") {
    return `${formatRate(batteries)} batteries per round trip`;
  }
  const mj = batteries.mul(BATTERY_ENERGY_MJ);
  return `round-trip energy ${formatRate(mj)} MJ`;
}

/** The drone home-port power line (100 MW per drone, always-on). */
export function dronePortLine(plan: TransportDrone): string {
  return `port power ${formatRate(plan.result.portPowerMw)} MW per drone · always on`;
}

// ---------------------------------------------------------------------------
// Train comparison table rows.
// ---------------------------------------------------------------------------

/** One row of the train cars-vs-trains comparison (Axis 3): cars, trains,
 *  station MW (for the counted ends — both by default; a shared-end override
 *  drops an end, named in the asymmetry footnote), sustained rate, and the
 *  "station-limited" marker on a `ceilingBound` row. platforms/end ≡ cars (a
 *  footnote, not a column). */
export interface TrainRow {
  cars: number;
  trains: number;
  stationMw: string;
  sustainedRate: string;
  stationLimited: boolean;
}

/** Build the comparison rows for a train plan (all rows shown — comparable
 *  options, no "best"). The sustained rate is the per-platform ceiling × cars
 *  (the whole-consist ceiling), formatted exactly. */
export function trainRows(plan: TransportTrain): TrainRow[] {
  return plan.options.map((opt) => trainRow(opt));
}

function trainRow(opt: TrainOption): TrainRow {
  return {
    cars: opt.carsPerTrain,
    trains: opt.nTrains,
    stationMw: formatRate(opt.stationPowerMw),
    sustainedRate: formatRateOrApprox(opt.throughput),
    stationLimited: opt.ceilingBound,
  };
}

/** The train belt-feed footnote line ("belt feed: Mk4 × 2 = 960/min per
 *  platform"), naming the tier the dual feed came from. */
export function trainBeltFeedFootnote(plan: TransportTrain): string {
  return `belt feed: Mk${plan.beltTierIndex} × 2 = ${formatRate(plan.beltFeed)}/min per platform`;
}

/** The one-platform-per-car footnote (platforms/end is not a table column). */
export const TRAIN_PLATFORM_FOOTNOTE = "1 platform per car per end";

/** The train optimistic-basis note, shown when the trip is estimated. */
export function trainEstimatedNote(plan: TransportTrain): string | null {
  return plan.tripBasis === "estimated"
    ? "round trip estimated" + ESTIMATED_SUFFIX
    : null;
}

/**
 * The per-end asymmetry footnote (S8P2), shown ONLY when a shared-end override is
 * active — it names the flagged end(s) and states they are excluded from the
 * station MW column. `fromName`/`toName` are the producer/consumer stage names
 * (the `sharedEnds` from/to keys ARE those ends, the StageLink's own direction);
 * cheap to pass since the inspector already renders both on the identity line.
 * ONE parameterized string, not three hand-written variants (the simplify fold).
 * Returns null when no end is flagged (the default symmetric station set).
 */
export function trainSharedEndsFootnote(
  plan: TransportTrain,
  fromName: string,
  toName: string,
): string | null {
  const shared = plan.sharedEnds;
  const names: string[] = [];
  if (shared?.from) names.push(fromName);
  if (shared?.to) names.push(toName);
  if (names.length === 0) return null;
  const ends = names.join(" and ");
  const verb = names.length === 1 ? "end shared" : "ends shared";
  return `${ends} ${verb} — excluded from station MW`;
}

// ---------------------------------------------------------------------------
// Edge-label chip — the compact per-link summary.
// ---------------------------------------------------------------------------

/**
 * The compact edge-label chip for a configured link ("· 9 belts", "· 3 trucks",
 * "· 2×4-car trains", "· 5 drones"), with a leading "≈" when the basis is
 * estimated. Returns null for an unsolved link (no count yet) or an
 * errored/parse-failed config (the chip carries only counts, never error prose —
 * the inspector shows the error).
 *
 * The train chip picks the SMALLEST-consist row (cars 1) as the representative
 * count — a stable, single summary for the many comparable options.
 */
export function edgeChip(plan: TransportPlan): string | null {
  switch (plan.kind) {
    case "continuous":
      // Belt and pipe both show their lane count (runs), the count the solver
      // already computed for every continuous plan (#157).
      return chip(
        plan.mode === "belt"
          ? `${plan.result.runs} ${plan.result.runs === 1n ? "belt" : "belts"}`
          : `${plan.result.runs} ${plan.result.runs === 1n ? "pipe" : "pipes"}`,
        false,
      );
    case "vehicle": {
      const n = plan.result.nVehicles;
      const noun =
        n === 1n ? vehicleNoun(plan.mode) : vehicleNounPlural(plan.mode);
      return chip(`${n} ${noun}`, plan.result.tripBasis === "estimated");
    }
    case "train": {
      const first = plan.options[0];
      if (first === undefined) return null;
      const carLabel = `${first.carsPerTrain}-car`;
      const noun = first.nTrains === 1 ? "train" : "trains";
      return chip(
        `${first.nTrains}×${carLabel} ${noun}`,
        plan.tripBasis === "estimated",
      );
    }
    case "drone": {
      const n = plan.result.nDrones;
      const noun = n === 1n ? "drone" : "drones";
      return chip(`${n} ${noun}`, plan.result.tripBasis === "estimated");
    }
    default:
      // unsolved | error — no count to summarize.
      return null;
  }
}

/** Label an interstep route while preserving edgeChip's count and estimate rules. */
export function routeEdgeChip(
  route: "forward" | "empty return",
  plan: TransportPlan,
): string | null {
  const summary = edgeChip(plan);
  return summary === null ? null : `· ${route} ${summary.slice(2)}`;
}

/** Prefix a chip body with "· " (and "≈" when estimated). */
function chip(body: string, estimated: boolean): string {
  return estimated ? `· ≈ ${body}` : `· ${body}`;
}

// ---------------------------------------------------------------------------
// Mode nouns.
// ---------------------------------------------------------------------------

function vehicleNoun(mode: string): string {
  switch (mode) {
    case "truck":
      return "truck";
    case "tractor":
      return "tractor";
    case "explorer":
      return "explorer";
    case "fluid-truck":
      return "fluid truck";
    default:
      return "vehicle";
  }
}

function vehicleNounPlural(mode: string): string {
  const one = vehicleNoun(mode);
  return one + "s";
}

// ---------------------------------------------------------------------------
// The transport-rate-unsustainable finding predicate + hint (Axis 4).
// ---------------------------------------------------------------------------

/**
 * Whether a train link's required rate exceeds what one station pair can sustain
 * at ANY enumerated consist size — the sole new finding's predicate, evaluated
 * on the max-car row in EXPOSED P1 fields only:
 *   `rate > perPlatformCeiling × maxCars`
 * on that row (per-platform ceiling × platform count, one platform per car).
 * Both ceiling terms are c-independent, so the max-car row maximizes the pair
 * ceiling (the frozen predicate arithmetic). Returns the binding row (for the
 * hint's ceilingBound gate) or null when the rate is sustainable.
 */
export function unsustainableTrainRow(
  rate: Fraction,
  options: TrainOption[],
): TrainOption | null {
  if (options.length === 0) return null;
  const maxRow = options[options.length - 1]!;
  const pairCeiling = maxRow.perPlatformCeiling.mul(
    Fraction.from(maxRow.carsPerTrain),
  );
  return rate.gt(pairCeiling) ? maxRow : null;
}

/**
 * The unsustainable-train finding sentence + its belt-feed hint. The hint is
 * gated DIRECTLY on the binding row's `ceilingBound` (its documented meaning IS
 * "the belt-feed arm binds") — no UI-side recomputation of the min() arms.
 */
export function unsustainableTrainText(
  itemName: string,
  rate: Fraction,
  row: TrainOption,
): string {
  const ceiling = formatRateOrApprox(
    row.perPlatformCeiling.mul(Fraction.from(row.carsPerTrain)),
  );
  const base = `${itemName}: ${formatRateOrApprox(rate)}/min exceeds what one station pair sustains at any consist size (max ${ceiling}/min at ${row.carsPerTrain} cars).`;
  return row.ceilingBound
    ? base + " A faster belt feed would raise the station ceiling."
    : base;
}

/** The default LinkTransport shape for a freshly selected mode — shared by the
 *  link inspector and the extraction packaging panel (P4 dedup). */
export function defaultTransportFor(mode: TransportMode): LinkTransport {
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

/** Exact vs approximate MW rendering for a ready packaging plan's power. */
export function packagingPowerText(
  power: NonNullable<Extract<DerivedLinkPlan, { status: "ready" }>["power"]>,
): string {
  if (power.kind === "exact") return `${formatRate(power.mw)} MW`;
  return `≈ ${Number(power.mw.toFixed(1))} MW`;
}
