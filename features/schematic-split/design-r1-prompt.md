# Design review r1 — #135 split the schematic (Stage 23)

**Worktree (absolute):** `/home/subzerodev/workspace/satisfactory-foundry`
**Artifact:** `features/schematic-split/brainstorm-spec.md` (design r1)
**Stage:** design (no `src/` file modified) · **Ticket:** #135 · **Epic:** #136
**Committed as:** `c054283`

Michael's field report: *"this diagram needs rethought i dont understand what its
saying from the layout of it."*

## Settled — do not re-litigate, but DO check the design honours them

- **The schematic splits into separate views** (#135 comment 24630). The bus/feed
  drawing answers **how to physically build it** AND **what is over capacity** —
  together. **The 106-machine block becomes its own view.**
- **Presentation only** (epic #136): the solver, the saturation model and #120's
  parallel-line semantics are unchanged.
- Stage 13/14 removed a view and had to restore it after a mislabelled toggle made
  the user ask for the wrong deletion (`docs/master-plan.md:211-252`). Nothing is
  deleted here.

## Spend your effort here

1. **The load-bearing claim: the bus rows are spatially indexed by the machine
   axis, so the axis cannot leave with the block.** The spec cites
   `ui/layout.ts:76-85` (`LaneTrack.segments` carrying `fromMachine`/`toMachine`
   alongside `x1`/`x2`) and `computeLayout` (`:275-340`). **Verify it**, and judge
   the conclusion: is keeping ticks + labels in the schematic while moving the
   band + count actually the right cut, or does it leave the schematic incoherent
   (or the machines view empty of meaning)?

2. **Is the split faithful to the decision, or does it under-deliver?** Michael
   asked for the machine block to become its own view. The spec keeps a machine
   ruler in the schematic. Is that honouring the decision or quietly defeating it?
   Argue it either way, but decide.

3. **The scope-out.** The spec deliberately does NOT redesign the machine block,
   on the grounds that the decision settles *where* it goes, not *what it
   becomes*, and files it as #138 (blocked by #135). Is that a legitimate scope
   boundary, or is a split that ships a still-unreadable block failing the
   ticket's actual purpose ("the schematic doesn't communicate")?

4. **The element-by-element division** at `Schematic.tsx:356-411` — rect `:382`,
   count `:383-385`, ticks `:393`, labels `:399-405`. Verify those are genuinely
   separable, and check the **non-band path** (`:516-537`, N ≤ 114) really splits
   the same way. What happens at N = 20 versus N = 161?

5. **Blast radius.** The spec claims five sites, all in `App.tsx` (`:66`, `:158`,
   `:429-446`, `:447-469`) plus CSS, with no store change. Verify, and look for
   anything the spec missed — CSS height assumptions, layout constants that
   assume the band occupies vertical space, or tests that assert the schematic
   contains machine-block elements.

6. **Tests.** The spec claims no snapshot tests and that `layout.test.ts` should
   need no change. Verify against `smoke.test.tsx`, `layout.test.ts`,
   `parallel-feed-belts.test.tsx`, `coincident-feed-marks.test.tsx`. If
   `layout.test.ts` would need changing, say so — the spec treats that as a
   signal the split has leaked into layout.

## Anchors

`src/ui/Schematic.tsx` (`:78-90`, `:96-343`, `:356-411`, `:413-573`, `:484-506`,
`:516-537`, `:539-561`);
`src/ui/layout.ts` (`:32-70`, `:72-88`, `:95-113`, `:114-169`, `:190-211`, `:275-340`);
`src/ui/App.tsx` (`:66`, `:158`, `:426-469`);
`src/ui/app.css` (`.schematic`, `.view-tabs`, `.machine-band`, `.machine-label`,
`.parallel-run-label`);
`src/core/manifold.ts` (`:44-77`);
`docs/master-plan.md` Stages 12-16;
tests: `src/ui/smoke.test.tsx`, `src/ui/layout.test.ts`,
`src/ui/parallel-feed-belts.test.tsx`, `src/ui/coincident-feed-marks.test.tsx`.

## Also check

- Every `file:line` the spec cites, against live source. A search-agent map
  informed this spec and **maps have overstated facts on this ticket's sibling** —
  treat cited facts as claims to verify.
- Any ledger row marked **Verified** that is not. One row is deliberately marked
  *Judgement, not measurement* — check that the rest earn their label.
- Whether the design is bigger than it needs to be.

## Verdict contract

Return exactly one of `APPROVED` / `APPROVED_WITH_NITS` / `NEEDS_REWORK` /
`BLOCKED` **in your final message**, with severity-tagged findings citing
verified source. If a nested check does not report, state the finding anyway
marked unconfirmed and source-derived — do not withhold it and do not wait.

Approve if a determined attack finds nothing real. Be explicit about severity: if
what you find is cosmetic, say so and approve rather than reaching for
`NEEDS_REWORK`. This is a lean spec by deliberate choice — do not request restored
narrative unless its absence would cause the change to be built or verified
incorrectly.
