# #142 — completion note

**Landed:** merge 61ac0e3 on develop (fix a54f055 + fold commits, spec
1192814). Pushed. Last of the four pre-arc fixes (#140 comment 24744).

**What landed:** the three variable-power buildings (Particle Accelerator,
Converter, Quantum Encoder) report per-recipe power everywhere power is
shown or summed. Parse of mVariablePowerConsumptionConstant/Factor onto
CatalogRecipe; effectiveMachinePower in core as the single owner of the
building-class gate; corrected surfaces: stage advice, chain Σ, and
proposalMetrics' in-loop sum (cost sheet + compare rows). Plutonium Pellet:
500 MW (varies 250–750) instead of 875 (varies 250–1500). Persistence via
StoredRecipe.variablePower + CATALOG_PARSER_VERSION 6→7 so cached users
re-parse and gain the field.

**What the reviewers caught:** the D3 caller inventory was wrong twice over
(the adapter never calls the projection — in-loop correction required;
link-plan blends two recipes); the AC4/AC5 internal contradiction (version
pins must move with the bump — adjudicated as the only correct
implementation, sweep rule extended: a constant bump must sweep the
constant's literal); and the adversarial real-data probe showed the
field-gating trap is live on ORDINARY recipes (Recipe_IronPlate_C ships
constant=0/factor=1), not just the three endgame ones — the building-class
gate neutralizes the whole class. Simplify: APPROVED at both stages, no
findings (helper proven structurally necessary; the "triple retelling"
judged three facets at their owning sites).

**Acceptance criteria:** all five hold on the merged trunk (1165 tests +
lint green), with AC5 amended post-freeze per the adjudication.
