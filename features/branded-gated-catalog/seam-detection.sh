#!/usr/bin/env bash
# S21 P2 (#106) — measure which tier-gating seams the EXISTING test suite
# detects, and which a branded `GatedCatalog` would add.
#
# For each seam: write the one-token slip into ChainBuilder.tsx, run `tsc -b`
# and the full vitest suite, record both, restore. Run once on plain `develop`
# (the TESTS column is then the answer) and once with the brand applied (the
# BRAND column).
#
# Slips are matched by CONTENT, not by line number, and each application
# asserts exactly one occurrence. An earlier line-numbered version silently
# failed to apply all seven slips after an added import shifted every line,
# and reported a clean "nothing detected" matrix — a false result that read
# like a finding. Never address a mutation by line number.
set -uo pipefail
cd /home/subzerodev/workspace/satisfactory-foundry
F=src/ui/ChainBuilder.tsx

git diff --quiet -- "$F" || { echo "FAIL: $F is dirty; refusing to run." >&2; exit 1; }
BAK=$(mktemp); cp "$F" "$BAK"
trap 'cp "$BAK" "$F"; rm -f "$BAK"' EXIT

apply() {
  python3 - "$F" "$1" "$2" <<'PY'
import sys
path, search, replace = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(path).read()
n = s.count(search)
assert n == 1, f"expected exactly 1 occurrence, found {n}: {search!r}"
open(path, "w").write(s.replace(search, replace, 1))
PY
}

run() {
  local name="$1"
  apply "$2" "$3" || { printf '%-38s %s\n' "$name" "APPLY FAILED"; return; }
  local brand tests tscout vitestout
  # Capture to a variable BEFORE grepping. Piping vitest straight into grep
  # under `pipefail` reports the PIPELINE status, which is vitest's non-zero
  # exit whenever tests fail — inverting every RED row to green. This harness
  # produced a false all-clear twice; both times it read like a real finding.
  tscout=$(npx tsc -b 2>&1)
  vitestout=$(npx vitest run --reporter=dot 2>&1)
  brand=$(grep -q gatedBrand <<<"$tscout" && echo CAUGHT || echo missed)
  # Positive liveness first. "no FAIL string" is not the same as "the suite ran
  # and passed" — a collect error, a crash, or an npx failure all produce output
  # with no summary line, which an absence-based read scores as green. Require
  # the summary to be present before believing either verdict.
  if ! grep -qE "Tests +[0-9]+ (failed|passed)" <<<"$vitestout"; then
    tests="HARNESS ERROR (no summary line)"
  elif grep -qE "Tests +[0-9]+ failed" <<<"$vitestout"; then
    tests="RED"
  else
    tests="green (UNDETECTED)"
  fi
  printf '%-38s %-8s %s\n' "$name" "$brand" "$tests"
  cp "$BAK" "$F"
}

printf '%-38s %-8s %s\n' "SEAM SLIP" "BRAND" "TESTS"
printf '%s\n' "---------------------------------------------------------------"

run "SOLVE proposeChainForCatalog" \
  "    const proposal = proposeChainForCatalog(
      gatedCat," \
  "    const proposal = proposeChainForCatalog(
      cat,"
run "S1 Preview.gated" "      gated: gatedCat," "      gated: cat,"
run "S2 RecipePicker prop" "catalog={preview.gated}" "catalog={catalog}"
run "S3 toProposalPreview" \
  "toProposalPreview(proposal, gatedCat, {" "toProposalPreview(proposal, cat, {"
run "S4 ungatedCatalog" "        ungatedCatalog: cat," "        ungatedCatalog: gatedCat,"
run "R0 repropose initial Propose" \
  "    repropose(catalog, {}, true);" \
  "    repropose(preview?.gated ?? catalog, {}, true);"
run "R1 repropose chooseRecipe" \
  "    repropose(catalog, { overrides: next });" \
  "    repropose(preview?.gated ?? catalog, { overrides: next });"
run "R2 repropose toggleRaw" \
  "    repropose(catalog, { rawItemIds: next });" \
  "    repropose(preview?.gated ?? catalog, { rawItemIds: next });"
run "R3 repropose toggleExclusion" \
  "    repropose(catalog, { excludedMachineIds: next });" \
  "    repropose(preview?.gated ?? catalog, { excludedMachineIds: next });"
run "R4 repropose onTierChange" \
  "    repropose(catalog, { unlockedTier: next });" \
  "    repropose(preview?.gated ?? catalog, { unlockedTier: next });"
run "S5 excludableMachines" \
  "excludableMachines(catalog);" "excludableMachines(preview?.gated ?? catalog);"
run "S7 effectiveDefaultRecipe" \
  "    const dflt = effectiveDefaultRecipe(
      preview.gated," \
  "    const dflt = effectiveDefaultRecipe(
      catalog,"
run "S8 recipeLabel (recovery select)" \
  "                          {recipeLabel(
                            preview.gated," \
  "                          {recipeLabel(
                            catalog,"
run "S6 byproductSuggestions" \
  "byproductSuggestions(preview.proposal, catalog)" \
  "byproductSuggestions(preview.proposal, preview.gated)"
run "U1 producerRecipesFor" \
  "            const options = producerRecipesFor(
              preview.gated," \
  "            const options = producerRecipesFor(
              catalog,"
