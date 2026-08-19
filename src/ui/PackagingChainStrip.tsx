/**
 * The shared packaging-chain visual (#156): a compact SVG strip drawing the
 * packager → unpackager loop for BOTH intersteps — the extraction panel's
 * raw-feed packaging and the LinkInspector's stage-to-stage link. It is purely
 * presentational: every figure arrives resolved on `ReadyLinkPlan`, every
 * display name / endpoint label / route text arrives as a prop (the call sites
 * own `catalog` and the lifted `routeSummary`). It never re-derives and never
 * invents numbers — an unsized plan (null counts/rates) renders "—".
 *
 * Layout (left → right): the left endpoint (extractor bank / from-stage), a
 * left-entering feed label (the fluid at its demand rate), the Packager node,
 * the forward edge (cargo rate · packaged name · route), the Unpackager node, a
 * right-exiting delivered-fluid label, the right endpoint (to-stage). Under the
 * forward edge, a dashed return-loop path runs right → left carrying the empty
 * container's return (rate · container name · route).
 *
 * The SVG designs to ~320px inner width via a fixed viewBox + `width: 100%`, so
 * it scales to the panel while keeping stroke/text proportions. All colour comes
 * from the panel's existing CSS vars (--fg / --fg-muted / --border / --accent)
 * via `currentColor` + class hooks in app.css — no new colour system.
 */

import type { ReadyLinkPlan } from "../core/link-plan.ts";
import { formatRate } from "./format.ts";

export interface PackagingChainStripProps {
  plan: ReadyLinkPlan;
  /** Left endpoint label (extraction: the extractor bank; link: the from-stage). */
  leftLabel: string;
  /** Right endpoint label (extraction: the delivery; link: the to-stage). */
  rightLabel: string;
  /** Display name of the fluid entering the packager (the feed). */
  feedName: string;
  /** Display name of the packaged cargo travelling the forward edge. */
  packagedName: string;
  /** Display name of the fluid delivered by the unpackager. */
  deliveredName: string;
  /** Display name of the empty container returning on the loop. */
  containerName: string;
  /** Forward-route text (belt count / vehicle chip), derived via routeSummary. */
  forwardRouteText: string;
  /** Empty-return-route text, derived via routeSummary. */
  returnRouteText: string;
}

/** "—" when the figure is unsized; else the exact per-minute rate. */
function rateText(rate: ReadyLinkPlan["cargoDemand"]): string {
  return rate === null ? "—" : `${formatRate(rate)}/min`;
}

/** "—" when unsized; else the machine count. */
function countText(count: number | null): string {
  return count === null ? "—" : String(count);
}

export function PackagingChainStrip({
  plan,
  leftLabel,
  rightLabel,
  feedName,
  packagedName,
  deliveredName,
  containerName,
  forwardRouteText,
  returnRouteText,
}: PackagingChainStripProps) {
  const feedLabel = `${rateText(plan.materialDemand)} ${feedName}`;
  const forwardLabel = `${rateText(plan.cargoDemand)} ${packagedName} · ${forwardRouteText}`;
  const returnLabel = `${rateText(plan.containerReturnRate)} ${containerName} · ${returnRouteText}`;

  return (
    <div className="packaging-chain-strip">
      <svg
        className="packaging-chain-strip-svg"
        viewBox="0 0 320 128"
        width="100%"
        role="img"
        aria-label={`Packaging chain: ${countText(plan.packageMachines)} Packager, ${countText(plan.unpackageMachines)} Unpackager`}
      >
        {/* Endpoint labels flanking the chain. */}
        <text className="pcs-endpoint" x="4" y="18">
          {leftLabel}
        </text>
        <text className="pcs-endpoint" x="316" y="18" textAnchor="end">
          {rightLabel}
        </text>

        {/* The left-entering feed label. */}
        <text className="pcs-feed" x="4" y="46">
          {feedLabel}
        </text>

        {/* Packager node box. */}
        <rect
          className="pcs-node"
          x="4"
          y="54"
          width="120"
          height="34"
          rx="2"
        />
        <text className="pcs-node-count" x="64" y="70" textAnchor="middle">
          {countText(plan.packageMachines)} ×
        </text>
        <text className="pcs-node-role" x="64" y="83" textAnchor="middle">
          Packager
        </text>

        {/* Unpackager node box. */}
        <rect
          className="pcs-node"
          x="196"
          y="54"
          width="120"
          height="34"
          rx="2"
        />
        <text className="pcs-node-count" x="256" y="70" textAnchor="middle">
          {countText(plan.unpackageMachines)} ×
        </text>
        <text className="pcs-node-role" x="256" y="83" textAnchor="middle">
          Unpackager
        </text>

        {/* Forward edge: packager → unpackager, arrowed. */}
        <line className="pcs-edge" x1="124" y1="71" x2="192" y2="71" />
        <polygon className="pcs-arrow" points="192,71 184,67 184,75" />
        <text className="pcs-edge-label" x="160" y="64" textAnchor="middle">
          {forwardLabel}
        </text>

        {/* Right-exiting delivered-fluid label. */}
        <text className="pcs-delivered" x="316" y="46" textAnchor="end">
          {rateText(plan.materialDemand)} {deliveredName}
        </text>

        {/* Return loop: dashed under-path right → left, arrowed at the left. */}
        <path
          className="pcs-return"
          d="M256 88 L256 108 L64 108 L64 92"
          fill="none"
        />
        <polygon className="pcs-arrow" points="64,88 60,96 68,96" />
        <text className="pcs-return-label" x="160" y="124" textAnchor="middle">
          {returnLabel}
        </text>
      </svg>
    </div>
  );
}
