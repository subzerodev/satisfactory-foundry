/**
 * Raw-feed non-interactivity invariant (Stage 11 / Phase 1, ticket #57). Node
 * env, no DOM: RF's real onNodesChange can't fire headless, so the commit
 * decision was extracted into the pure `commitNodeChange` helper. These tests
 * pin the APP-LEVEL guard — a synthesized position/select change for a `raw:`
 * id must reach NEITHER setter — and prove it is meaningful (the identical
 * changes for a stage id DO reach the setters), so the skip is not vacuous.
 */

import { describe, it, expect, vi } from "vitest";
import type { NodeChange } from "@xyflow/react";
import { commitNodeChange } from "./GraphCanvas.tsx";

describe("commitNodeChange — raw-feed non-interactivity", () => {
  const setters = () => ({
    setStagePosition: vi.fn(),
    setActiveStage: vi.fn(),
  });

  it("drops a drag-END position change for a raw: id (reaches setStagePosition never)", () => {
    const s = setters();
    const change: NodeChange = {
      id: "raw:stage1:ore_iron",
      type: "position",
      position: { x: 10, y: 20 },
      dragging: false,
    };
    commitNodeChange(change, s);
    expect(s.setStagePosition).not.toHaveBeenCalled();
    expect(s.setActiveStage).not.toHaveBeenCalled();
  });

  it("drops a select change for a raw: id (reaches setActiveStage never)", () => {
    const s = setters();
    const change: NodeChange = {
      id: "raw:stage1:ore_iron",
      type: "select",
      selected: true,
    };
    commitNodeChange(change, s);
    expect(s.setActiveStage).not.toHaveBeenCalled();
    expect(s.setStagePosition).not.toHaveBeenCalled();
  });

  it("commits a drag-END position change for a STAGE id (guard is not vacuous)", () => {
    const s = setters();
    const change: NodeChange = {
      id: "stage1",
      type: "position",
      position: { x: 10, y: 20 },
      dragging: false,
    };
    commitNodeChange(change, s);
    expect(s.setStagePosition).toHaveBeenCalledWith("stage1", { x: 10, y: 20 });
  });

  it("commits a select change for a STAGE id (guard is not vacuous)", () => {
    const s = setters();
    const change: NodeChange = { id: "stage1", type: "select", selected: true };
    commitNodeChange(change, s);
    expect(s.setActiveStage).toHaveBeenCalledWith("stage1");
  });
});
