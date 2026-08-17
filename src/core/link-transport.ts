import { DRONE_FUEL_SPEED_MS, type DroneFuel } from "./transport-facts.ts";

/** Raw per-link transport intent. Numeric text is parsed only at derive time. */
export type LinkTransport =
  | { mode: "belt" }
  | { mode: "pipe"; deratePercentText?: string }
  | {
      mode: "truck" | "tractor" | "explorer" | "fluid-truck";
      trip:
        | { kind: "measured"; roundTripSecondsText: string }
        | { kind: "estimated"; distanceText: string };
    }
  | {
      mode: "train";
      trip:
        | { kind: "measured"; roundTripSecondsText: string }
        | { kind: "estimated"; distanceText: string };
      sharedEnds?: { from?: true; to?: true };
    }
  | {
      mode: "drone";
      fuel: DroneFuel;
      trip:
        | {
            kind: "measured";
            roundTripSecondsText: string;
            flightMetersText?: string;
          }
        | { kind: "estimated"; flightMetersText: string };
    };

export type TransportMode = LinkTransport["mode"];

export interface PackagingInterstep {
  /** Canonical key; the reverse recipe is discovered from catalog IO. */
  packageRecipeId: string;
  /** Shared Packager clock for both route ends, raw user text in (0,250]. */
  clockPercentText: string;
  /** Independent empty-container route; physical link-side semantics persist. */
  returnTransport: LinkTransport;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonicalizeVehicleTrip(
  value: unknown,
):
  | { kind: "measured"; roundTripSecondsText: string }
  | { kind: "estimated"; distanceText: string }
  | null {
  if (!isRecord(value)) return null;
  if (
    value.kind === "measured" &&
    typeof value.roundTripSecondsText === "string"
  ) {
    return {
      kind: "measured",
      roundTripSecondsText: value.roundTripSecondsText,
    };
  }
  if (value.kind === "estimated" && typeof value.distanceText === "string") {
    return { kind: "estimated", distanceText: value.distanceText };
  }
  return null;
}

function canonicalizeDroneTrip(value: unknown):
  | {
      kind: "measured";
      roundTripSecondsText: string;
      flightMetersText?: string;
    }
  | { kind: "estimated"; flightMetersText: string }
  | null {
  if (!isRecord(value)) return null;
  if (
    value.kind === "measured" &&
    typeof value.roundTripSecondsText === "string" &&
    (value.flightMetersText === undefined ||
      typeof value.flightMetersText === "string")
  ) {
    return {
      kind: "measured",
      roundTripSecondsText: value.roundTripSecondsText,
      ...(value.flightMetersText !== undefined
        ? { flightMetersText: value.flightMetersText }
        : {}),
    };
  }
  if (
    value.kind === "estimated" &&
    typeof value.flightMetersText === "string"
  ) {
    return { kind: "estimated", flightMetersText: value.flightMetersText };
  }
  return null;
}

/** Rebuild caller-owned raw intent into the exact persisted transport shape. */
export function canonicalizeLinkTransport(
  value: unknown,
): LinkTransport | null {
  if (!isRecord(value)) return null;
  switch (value.mode) {
    case "belt":
      return { mode: "belt" };
    case "pipe":
      if (
        value.deratePercentText !== undefined &&
        typeof value.deratePercentText !== "string"
      ) {
        return null;
      }
      return {
        mode: "pipe",
        ...(value.deratePercentText !== undefined
          ? { deratePercentText: value.deratePercentText }
          : {}),
      };
    case "truck":
    case "tractor":
    case "explorer":
    case "fluid-truck": {
      const trip = canonicalizeVehicleTrip(value.trip);
      return trip === null ? null : { mode: value.mode, trip };
    }
    case "train": {
      const trip = canonicalizeVehicleTrip(value.trip);
      if (trip === null) return null;
      if (value.sharedEnds === undefined) return { mode: "train", trip };
      if (!isRecord(value.sharedEnds)) return null;
      if (
        (value.sharedEnds.from !== undefined &&
          value.sharedEnds.from !== true) ||
        (value.sharedEnds.to !== undefined && value.sharedEnds.to !== true)
      ) {
        return null;
      }
      return {
        mode: "train",
        trip,
        sharedEnds: {
          ...(value.sharedEnds.from === true ? { from: true } : {}),
          ...(value.sharedEnds.to === true ? { to: true } : {}),
        },
      };
    }
    case "drone": {
      if (
        typeof value.fuel !== "string" ||
        !Object.hasOwn(DRONE_FUEL_SPEED_MS, value.fuel)
      ) {
        return null;
      }
      const trip = canonicalizeDroneTrip(value.trip);
      return trip === null
        ? null
        : { mode: "drone", fuel: value.fuel as DroneFuel, trip };
    }
    default:
      return null;
  }
}

/** Rebuild type-erased interstep intent and canonicalize its nested route. */
export function canonicalizePackagingInterstep(
  value: unknown,
): PackagingInterstep | null {
  if (
    !isRecord(value) ||
    typeof value.packageRecipeId !== "string" ||
    typeof value.clockPercentText !== "string"
  ) {
    return null;
  }
  const returnTransport = canonicalizeLinkTransport(value.returnTransport);
  if (
    returnTransport === null ||
    returnTransport.mode === "pipe" ||
    returnTransport.mode === "fluid-truck"
  ) {
    return null;
  }
  return {
    packageRecipeId: value.packageRecipeId,
    clockPercentText: value.clockPercentText,
    returnTransport,
  };
}
