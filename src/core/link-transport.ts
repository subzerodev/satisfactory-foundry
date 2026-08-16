import type { DroneFuel } from "./transport-facts.ts";

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
