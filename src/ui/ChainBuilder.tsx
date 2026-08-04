/**
 * Build-chain panel (Stage 8 / Phase 3, ticket #39). Pick a target item + a
 * rate, Propose → a component-local PREVIEW (one row per proposed stage + the
 * raw-inputs / byproducts lines), then Apply (bulk store action) or discard.
 *
 * The proposal is ephemeral — component-local state, no store field (the store
 * only gains the apply action). Apply clears the preview, so a double-apply is
 * an explicit re-propose (frozen Axis 6). Solver runs are a synchronous
 * catalog-sized DFS. Frozen design Axis 6.
 */

import { useState } from "react";

import { Fraction } from "../core/fraction.ts";
import type { ChainProposal } from "../core/chain-builder.ts";
import { useAppStore } from "../state/store.ts";
import {
  proposeChainForCatalog,
  toProposalPreview,
  previewRowText,
  itemRateLineText,
} from "./chain-builder-adapter.ts";
import type { ProposalPreview } from "./chain-builder-adapter.ts";

/**
 * Parse the raw rate text into a positive Fraction, or a labeled error (the
 * Selection idiom — raw text, parsed at propose time). Pure + exported so the
 * node-env suite can pin the error wording without rendering the component.
 */
export function parseRateText(
  text: string,
): { ok: true; value: Fraction } | { ok: false; error: string } {
  let value: Fraction;
  try {
    value = Fraction.parse(text);
  } catch {
    return { ok: false, error: "rate must be a positive number" };
  }
  if (value.lte(Fraction.from(0))) {
    return { ok: false, error: "rate must be greater than 0" };
  }
  return { ok: true, value };
}

/** The preview + the proposal it came from (Apply hands the proposal to the store). */
interface Preview {
  proposal: ChainProposal;
  view: ProposalPreview;
}

export function ChainBuilder() {
  const catalog = useAppStore((s) =>
    s.catalog.status === "ready" ? s.catalog.catalog : null,
  );
  const applyChainProposal = useAppStore((s) => s.applyChainProposal);

  const [targetItemId, setTargetItemId] = useState("");
  const [rateText, setRateText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  if (catalog === null) return null;

  // All catalog items, sorted by display name (the select's option list).
  const items = Object.values(catalog.items).sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );

  function onPropose() {
    setError(null);
    setPreview(null);
    if (catalog === null) return;
    if (targetItemId === "") {
      setError("pick a target item");
      return;
    }
    const parsed = parseRateText(rateText);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    const proposal = proposeChainForCatalog(
      catalog,
      targetItemId,
      parsed.value,
    );
    setPreview({ proposal, view: toProposalPreview(proposal, catalog) });
  }

  function onApply() {
    if (preview === null) return;
    applyChainProposal(preview.proposal);
    // Clear the preview so a double-apply is an explicit re-propose (Axis 6).
    setPreview(null);
  }

  return (
    <div className="chain-builder">
      <div className="chain-builder-controls">
        <label>
          Build chain
          <select
            value={targetItemId}
            onChange={(e) => setTargetItemId(e.target.value)}
          >
            <option value="">— pick a target item —</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Rate /min
          <input
            type="text"
            inputMode="decimal"
            value={rateText}
            onChange={(e) => setRateText(e.target.value)}
          />
        </label>
        <button type="button" onClick={onPropose}>
          Propose
        </button>
      </div>
      {error !== null && <p className="chain-builder-error">{error}</p>}
      {preview !== null && (
        <div className="chain-builder-preview">
          {preview.view.isEmpty ? (
            <p className="chain-builder-empty">
              Nothing to build — the target is a raw input.
            </p>
          ) : (
            <ul className="chain-builder-rows">
              {preview.view.rows.map((row) => (
                <li key={row.itemName}>{previewRowText(row)}</li>
              ))}
            </ul>
          )}
          {preview.view.rawInputs.length > 0 && (
            <p className="chain-builder-raw">
              Raw inputs: {itemRateLineText(preview.view.rawInputs)}
            </p>
          )}
          {preview.view.byproducts.length > 0 && (
            <p className="chain-builder-byproducts">
              Byproducts: {itemRateLineText(preview.view.byproducts)}
            </p>
          )}
          <div className="chain-builder-actions">
            <button
              type="button"
              onClick={onApply}
              disabled={preview.view.isEmpty}
            >
              Apply
            </button>
            <button type="button" onClick={() => setPreview(null)}>
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
