import { describe, it, expect } from "vitest";
import { MARK_LABEL_DY } from "./Blueprint.tsx";

/**
 * Mark-label clearance geometry (#69) — the NON-OPTIONAL guard on the tight
 * margins Axis B introduces. The rate labels are lifted off the lane band so
 * they never cross the drawing ink. This test pins that the label's bbox band
 * clears the junction rects on BOTH sides; because the margins are deliberately
 * tight (the output side clears the junction bottom by only ~2dm), any drift in
 * MARK_LABEL_DY that re-crosses the ink fails HERE, not in a browser walk.
 *
 * Ground truth (verified against src/layout/layout.ts + footprints.ts):
 *  - Marks always sit ON the lane band: mk.at.y === busY (layout emits marks at
 *    the lane's bus y for both feed and output).
 *  - Junction rects are 40×40 (SPLITTER/MERGER footprints) centred on busY, so
 *    they span exactly [busY−20, busY+20].
 *  - The rate glyphs are a 10dm font with NO descenders, so the label's bbox is
 *    [baseline−10, baseline] — the baseline itself is the bbox bottom.
 */

/** Junction rects span ±20 about busY (40×40 footprints centred on the bus). */
const JUNCTION_HALF = 20;
/** Rate-label glyph height in dm; no descenders → bbox is [baseline−FONT, baseline]. */
const LABEL_FONT = 10;

/** The label's bbox [top, bottom] for a mark at busY, given the side's baseline
 *  offset. Marks sit at busY, so baseline = busY + dy; bbox = [baseline−10, baseline]. */
function labelBand(busY: number, dy: number): { top: number; bottom: number } {
  const baseline = busY + dy;
  return { top: baseline - LABEL_FONT, bottom: baseline };
}

describe("mark-label clearance off the junction ink (#69)", () => {
  // busY is scale-invariant dm geometry, so ANY bus y proves the clearance;
  // the smelter's real values (feed −20, output 120) are used as the fixtures.
  const junctionTopAt = (busY: number) => busY - JUNCTION_HALF;
  const junctionBottomAt = (busY: number) => busY + JUNCTION_HALF;

  it("feed labels lift ABOVE the junction band (bbox bottom clears busY−20)", () => {
    const busY = -20; // smelter feed bus (up is −y)
    const band = labelBand(busY, MARK_LABEL_DY.feed);
    // Feed lifts UP: baseline = −20 + (−24) = −44, bbox = [−54, −44]. The whole
    // bbox must sit ABOVE the junction band [−40, 0], i.e. the bbox BOTTOM (its
    // largest y, −44) is at or above the junction TOP (−40). −44 ≤ −40 → clears
    // by 4dm. A drift toward the bus (e.g. −20) would push the bottom to −20,
    // deep inside the junction — this pin fails there.
    expect(band).toEqual({ top: -54, bottom: -44 });
    expect(band.bottom).toBeLessThanOrEqual(junctionTopAt(busY));
  });

  it("output labels drop BELOW the junction band (bbox top clears busY+20)", () => {
    const busY = 120; // smelter output bus
    const band = labelBand(busY, MARK_LABEL_DY.output);
    // Output mirrors DOWN: baseline = 120 + 32 = 152, bbox = [142, 152]. The
    // bbox TOP (142) must clear the junction BOTTOM (busY+20 = 140). 142 ≥ 140 →
    // the deliberately-tight ~2dm margin, held only because the rate glyphs have
    // no descenders. Any smaller dy re-crosses the junction ink; this pin guards it.
    expect(band).toEqual({ top: 142, bottom: 152 });
    expect(band.top).toBeGreaterThanOrEqual(junctionBottomAt(busY));
  });
});
