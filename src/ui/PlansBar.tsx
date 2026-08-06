import { useState } from "react";
import type { PlanListEntry } from "../data/plan-store.ts";

interface PlansBarProps {
  /** null = not-yet-listed, [] = listed-none; both render the same placeholder. */
  plans: PlanListEntry[] | null;
  planError: string | null;
  onSave(name: string): void;
  onLoad(id: string): void;
  onRename(id: string, name: string): void;
  onDelete(id: string): void;
  /** Export the selected plan (App turns it into a file download). */
  onExport(id: string): void;
  /** Export EVERY saved plan as one re-importable bundle (Stage 19 / #92). */
  onExportAll(): void;
  /** Import a plan from an uploaded file (App reads its text first). */
  onImport(file: File): void;
}

/** Render an ISO timestamp as a plain calendar date (locale-independent). */
function shortDate(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * The saved-plan control bar (presentational): a name input + Save, and a
 * select of saved plans + Load / Rename / Delete. Holds only its own transient
 * input text + selected-id; every mutation is a parent callback. `planError`
 * renders in the same muted-error banner idiom as the catalog uploadError.
 *
 * `plans === null` (not-yet-listed) and `[]` (listed, none) render the SAME
 * "— no saved plans —" placeholder: App refreshes on ready-mount, so null is
 * transient and needs no loading affordance.
 */
export function PlansBar({
  plans,
  planError,
  onSave,
  onLoad,
  onRename,
  onDelete,
  onExport,
  onExportAll,
  onImport,
}: PlansBarProps) {
  const [name, setName] = useState("");
  const [selectedId, setSelectedId] = useState("");

  const list = plans ?? [];
  const hasPlans = list.length > 0;
  // Keep the selection valid: if the selected id is gone (deleted/renamed away),
  // fall back to the first plan so Load/Rename/Delete always target a real row.
  const activeId =
    hasPlans && list.some((p) => p.id === selectedId)
      ? selectedId
      : (list[0]?.id ?? "");

  return (
    <div className="plans-bar">
      <div className="plans-save">
        <input
          type="text"
          placeholder="plan name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="button" onClick={() => onSave(name)}>
          Save
        </button>
      </div>

      <div className="plans-manage">
        {hasPlans ? (
          <>
            <select
              value={activeId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {list.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({shortDate(p.updatedAt)})
                </option>
              ))}
            </select>
            <button type="button" onClick={() => onLoad(activeId)}>
              Load
            </button>
            <button type="button" onClick={() => onRename(activeId, name)}>
              Rename
            </button>
            <button type="button" onClick={() => onExport(activeId)}>
              Export
            </button>
            {/* Export-all (Stage 19 / #92): the same plain-button idiom as its
                siblings, targeting no specific row — it backs up EVERY plan, so
                it's selection-independent and lives here where ≥1 plan exists. */}
            <button type="button" onClick={() => onExportAll()}>
              Export all
            </button>
            <button type="button" onClick={() => onDelete(activeId)}>
              Delete
            </button>
          </>
        ) : (
          <span className="plans-empty">— no saved plans —</span>
        )}
        {/* Import is always available (a plan can be imported into an empty
            list). Reset value after each pick so re-importing the same file
            re-fires onChange. */}
        <label className="plans-import">
          Import
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImport(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {planError !== null && <p className="plans-error">{planError}</p>}
    </div>
  );
}
