import type { CatalogRecipe, CatalogMachine } from "../data/types.ts";
import type { Selection } from "../state/store.ts";
import { TIER_TABLE } from "../data/tiers.ts";

interface ControlsStripProps {
  recipes: CatalogRecipe[];
  machines: Record<string, CatalogMachine>;
  selection: Selection;
  hasOverrides: boolean;
  onSelectRecipe(id: string | null): void;
  onMachineCount(n: number): void;
  onClockText(t: string): void;
  onTiers(t: { belt: number; pipe: number }): void;
  onClearOverrides(): void;
}

function optionLabel(r: CatalogRecipe): string {
  return r.isAlternate ? `${r.displayName} (alt)` : r.displayName;
}

/** Toggle-row for one lane kind: buttons Mk1..Mk<max>, active iff k ≤ count. */
function TierToggles({
  kind,
  count,
  onCount,
}: {
  kind: "belt" | "pipe";
  count: number;
  onCount(k: number): void;
}) {
  const max = TIER_TABLE[kind].length;
  return (
    <div className="tier-toggles">
      {Array.from({ length: max }, (_, i) => i + 1).map((k) => (
        <button
          key={k}
          type="button"
          className={k <= count ? "tier-on" : "tier-off"}
          onClick={() => onCount(k)}
        >
          Mk{k}
        </button>
      ))}
    </div>
  );
}

export function ControlsStrip({
  recipes,
  machines,
  selection,
  hasOverrides,
  onSelectRecipe,
  onMachineCount,
  onClockText,
  onTiers,
  onClearOverrides,
}: ControlsStripProps) {
  const sorted = [...recipes].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );
  const selected =
    selection.recipeId === null
      ? null
      : (recipes.find((r) => r.id === selection.recipeId) ?? null);
  const machineName =
    selected === null
      ? null
      : (machines[selected.machineId]?.displayName ?? null);

  return (
    <div className="controls-strip">
      <label>
        Recipe
        <select
          value={selection.recipeId ?? ""}
          onChange={(e) =>
            onSelectRecipe(e.target.value === "" ? null : e.target.value)
          }
        >
          <option value="">— pick a recipe —</option>
          {sorted.map((r) => (
            <option key={r.id} value={r.id}>
              {optionLabel(r)}
            </option>
          ))}
        </select>
      </label>
      {machineName !== null && (
        <span className="machine-name">{machineName}</span>
      )}
      <label>
        Machines
        <input
          type="number"
          min={0}
          step={1}
          value={selection.machineCount}
          onChange={(e) => onMachineCount(e.target.valueAsNumber)}
        />
      </label>
      <label>
        Clock %
        <input
          type="text"
          inputMode="decimal"
          value={selection.clockPercentText}
          onChange={(e) => onClockText(e.target.value)}
        />
      </label>
      <div className="tier-controls">
        <span>Belts</span>
        <TierToggles
          kind="belt"
          count={selection.unlockedTiers.belt}
          onCount={(k) => onTiers({ ...selection.unlockedTiers, belt: k })}
        />
        <span>Pipes</span>
        <TierToggles
          kind="pipe"
          count={selection.unlockedTiers.pipe}
          onCount={(k) => onTiers({ ...selection.unlockedTiers, pipe: k })}
        />
      </div>
      <button
        type="button"
        className="clear-overrides"
        disabled={!hasOverrides}
        onClick={onClearOverrides}
      >
        Clear overrides
      </button>
    </div>
  );
}
