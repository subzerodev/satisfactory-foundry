import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Background, Controls, Panel, ReactFlow } from "@xyflow/react";
import { Fraction } from "../core/fraction.ts";
import type { Catalog } from "../data/types.ts";
import type { ExtractionSelection, StageNode } from "../state/store.ts";
import { appStore } from "../state/store.ts";
import type { RawFlowNode } from "./graph-flow.ts";
import {
  ExtractionPanel,
  GraphCanvas,
  GraphTopRightStack,
} from "./GraphCanvas.tsx";
import "./app.css";

const F = Fraction.from;

function catalog(): Catalog {
  const power = {
    mw: F(45),
    variable: false as const,
    exponent: Fraction.of(1321929, 1000000),
  };
  return {
    items: {
      stone: {
        id: "stone",
        displayName: "Limestone",
        isFluid: false,
        stackSize: F(100),
        isRawResource: true,
      },
    },
    machines: {
      miner_mk3: { id: "miner_mk3", displayName: "Miner Mk.3", power },
    },
    recipes: {},
    tiers: {
      belt: [60, 120, 270, 480, 780, 1200].map(F),
      pipe: [300, 600].map(F),
    },
    recipeUnlocks: {},
    extractors: {
      miner_mk3: {
        machineId: "miner_mk3",
        topology: "standalone",
        normalRate: F(240),
        itemIds: ["stone"],
      },
    },
  };
}

const stage: StageNode = {
  id: "s",
  name: "Concrete",
  selection: {
    recipeId: null,
    machineCount: 1,
    clockPercentText: "100",
    unlockedTiers: { belt: 4, pipe: 2 },
    overrides: { feeds: {}, outputs: {} },
  },
  solve: { status: "idle" },
};

const rawNode: RawFlowNode = {
  id: "raw:s:stone",
  type: "rawFeed",
  position: { x: 0, y: 0 },
  width: 150,
  height: 44,
  handles: [],
  data: {
    stageId: "s",
    itemId: "stone",
    demand: F(12720),
    itemName: "Limestone",
    rateText: "12720/min",
  },
};

function GeometryHarness({ state }: { state: string }) {
  const [selection, setSelection] = useState<ExtractionSelection | null>({
    machineId: "miner_mk3",
    clockPercentText: "250",
    purityMix: { impure: "1", normal: "1", pure: "1" },
  });
  const showNotice = state !== "extraction";
  const showExtraction = state !== "notice";
  return (
    <main data-harness-ready="geometry">
      <div
        className="graph-canvas"
        data-browser-canvas
        style={{
          height: 340,
          minHeight: 340,
          maxHeight: 340,
          resize: "none",
        }}
      >
        <ReactFlow nodes={[]} edges={[]}>
          <Background />
          <Controls />
          <Panel position="top-left">
            <button className="graph-add-stage">+ stage</button>
            <button className="graph-add-stage">FLOW L→R</button>
          </Panel>
          <Panel position="bottom-right">
            <p className="graph-chain-power">Σ ≈ 3180 MW</p>
          </Panel>
          <Panel position="top-right">
            <GraphTopRightStack
              notice={
                showNotice
                  ? "those stages share no item - the producer makes nothing the consumer needs"
                  : null
              }
              extraction={
                showExtraction ? (
                  <ExtractionPanel
                    catalog={catalog()}
                    rawNode={rawNode}
                    stage={stage}
                    selection={selection}
                    onSetSelection={setSelection}
                    onClose={() => undefined}
                  />
                ) : null
              }
            />
          </Panel>
        </ReactFlow>
      </div>
    </main>
  );
}

const INTERACTION_DOCS = JSON.stringify([
  {
    NativeClass:
      "/Script/CoreUObject.Class'/Script/FactoryGame.FGResourceDescriptor'",
    Classes: [
      {
        ClassName: "Desc_Stone_C",
        mDisplayName: "Limestone",
        mForm: "RF_SOLID",
        mStackSize: "SS_MEDIUM",
      },
      {
        ClassName: "Desc_Water_C",
        mDisplayName: "Water",
        mForm: "RF_LIQUID",
        mStackSize: "SS_FLUID",
      },
      {
        ClassName: "Desc_LiquidOil_C",
        mDisplayName: "Crude Oil",
        mForm: "RF_LIQUID",
        mStackSize: "SS_FLUID",
      },
      {
        ClassName: "Desc_NitrogenGas_C",
        mDisplayName: "Nitrogen Gas",
        mForm: "RF_GAS",
        mStackSize: "SS_FLUID",
      },
    ],
  },
  {
    NativeClass:
      "/Script/CoreUObject.Class'/Script/FactoryGame.FGItemDescriptor'",
    Classes: [
      {
        ClassName: "Desc_Concrete_C",
        mDisplayName: "Concrete",
        mForm: "RF_SOLID",
        mStackSize: "SS_BIG",
      },
    ],
  },
  {
    NativeClass:
      "/Script/CoreUObject.Class'/Script/FactoryGame.FGBuildableWaterPump'",
    Classes: [
      {
        ClassName: "Build_WaterPump_C",
        mDisplayName: "Water Extractor",
        mItemsPerCycle: "2000",
        mExtractCycleTime: "1",
        mAllowedResourceForms: "(RF_LIQUID)",
        mOnlyAllowCertainResources: "True",
        mAllowedResources: '("/Game/FactoryGame/Desc_Water.Desc_Water_C\'")',
        mPowerConsumption: "20",
        mPowerConsumptionExponent: "1.321929",
      },
    ],
  },
  {
    NativeClass:
      "/Script/CoreUObject.Class'/Script/FactoryGame.FGBuildableResourceExtractor'",
    Classes: [
      {
        ClassName: "Build_MinerMk3_C",
        mDisplayName: "Miner Mk.3",
        mItemsPerCycle: "1",
        mExtractCycleTime: "0.25",
        mAllowedResourceForms: "(RF_SOLID)",
        mOnlyAllowCertainResources: "False",
        mAllowedResources: "",
        mPowerConsumption: "45",
        mPowerConsumptionExponent: "1.321929",
      },
    ],
  },
  {
    NativeClass:
      "/Script/CoreUObject.Class'/Script/FactoryGame.FGBuildableResourceExtractor'",
    Classes: [
      {
        ClassName: "Build_OilPump_C",
        mDisplayName: "Oil Extractor",
        mItemsPerCycle: "2000",
        mExtractCycleTime: "1",
        mAllowedResourceForms: "(RF_LIQUID)",
        mOnlyAllowCertainResources: "True",
        mAllowedResources:
          '("/Game/FactoryGame/Desc_LiquidOil.Desc_LiquidOil_C\'")',
        mPowerConsumption: "40",
        mPowerConsumptionExponent: "1.321929",
      },
    ],
  },
  {
    NativeClass:
      "/Script/CoreUObject.Class'/Script/FactoryGame.FGBuildableFrackingExtractor'",
    Classes: [
      {
        ClassName: "Build_FrackingExtractor_C",
        mDisplayName: "Resource Well Extractor",
        mItemsPerCycle: "1000",
        mExtractCycleTime: "1",
        mAllowedResourceForms: "(RF_LIQUID,RF_GAS)",
        mOnlyAllowCertainResources: "True",
        mAllowedResources:
          '("/Game/FactoryGame/Desc_LiquidOil.Desc_LiquidOil_C\'","/Game/FactoryGame/Desc_NitrogenGas.Desc_NitrogenGas_C\'")',
        mPowerConsumption: "0",
        mPowerConsumptionExponent: "1.321929",
      },
    ],
  },
  {
    NativeClass:
      "/Script/CoreUObject.Class'/Script/FactoryGame.FGBuildableManufacturer'",
    Classes: [
      {
        ClassName: "Build_ConstructorMk1_C",
        mDisplayName: "Constructor",
        mPowerConsumption: "4",
      },
    ],
  },
  {
    NativeClass: "/Script/CoreUObject.Class'/Script/FactoryGame.FGRecipe'",
    Classes: [
      {
        ClassName: "Recipe_Concrete_C",
        mDisplayName: "Concrete",
        mIngredients:
          "((ItemClass=BlueprintGeneratedClass'\"/Game/Path/Desc_Stone_C\"',Amount=10),(ItemClass=BlueprintGeneratedClass'\"/Game/Path/Desc_Water_C\"',Amount=3000),(ItemClass=BlueprintGeneratedClass'\"/Game/Path/Desc_LiquidOil_C\"',Amount=3000),(ItemClass=BlueprintGeneratedClass'\"/Game/Path/Desc_NitrogenGas_C\"',Amount=3000))",
        mProduct:
          "((ItemClass=BlueprintGeneratedClass'\"/Game/Path/Desc_Concrete_C\"',Amount=1))",
        mManufactoringDuration: "12",
        mProducedIn: "/Game/Path/Build_ConstructorMk1_C",
      },
    ],
  },
]);

function InteractionHarness() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void (async () => {
      await appStore.getState().uploadDocsText(INTERACTION_DOCS);
      appStore.getState().selectRecipe("concrete");
      appStore.getState().setMachineCount(20);
      const browserWindow = window as typeof window & {
        __setMachineCount: (count: number) => void;
        __suppressRaw: (itemId: string) => void;
        __extractionSelection: (itemId: string) => unknown;
      };
      browserWindow.__setMachineCount = (count) =>
        appStore.getState().setMachineCount(count);
      browserWindow.__suppressRaw = (itemId) => {
        const state = appStore.getState();
        appStore.setState({
          links: [
            ...state.links,
            {
              id: `browser-suppress-${itemId}`,
              fromStageId: "missing-browser-producer",
              toStageId: state.activeStageId,
              itemId,
            },
          ],
        });
      };
      browserWindow.__extractionSelection = (itemId) => {
        const state = appStore.getState();
        return state.stages[state.activeStageId]?.extraction?.[itemId];
      };
      setReady(true);
    })();
  }, []);
  return (
    <main data-harness-ready={ready ? "interaction" : "loading"}>
      {ready && <GraphCanvas colorMode="light" />}
    </main>
  );
}

const params = new URLSearchParams(location.search);
const mode = params.get("mode") ?? "geometry";
const state = params.get("state") ?? "combined";
createRoot(document.getElementById("root")!).render(
  mode === "interaction" ? (
    <InteractionHarness />
  ) : (
    <GeometryHarness state={state} />
  ),
);
