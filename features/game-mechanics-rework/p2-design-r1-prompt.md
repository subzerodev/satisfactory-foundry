# Review request — #152 P2 design (r1)

**Artifact:** `/home/subzerodev/workspace/satisfactory-foundry/features/game-mechanics-rework/p2-brainstorm-spec.md` (uncommitted, v1)
**Worktree:** `/home/subzerodev/workspace/satisfactory-foundry` (branch `develop`, HEAD `88a87d2`)
**Stage:** first design review of the P2 (drawing: ribbon + endpoints + legend + tables) merged brainstorm+spec.

## A. Current-state anchors (verify against live source)

- `src/ui/Schematic.tsx` (post-P1: LaneG, bus-seg lines, seams, tooltip plumbing, busCapacity prop at :395,:449).
- `src/ui/layout.ts` (LaneTrack.segments :80-90 — entryFlow pass-through, the "never a coordinate" header contract).
- `src/ui/format.ts` (segTooltip :117-124 with the stale "peak" copy; findingText already P1-renamed).
- `src/ui/SummaryCards.tsx` (the post-P1 minimal cards).
- `src/ui/Legend.tsx` (Swatch idiom).
- `src/layout/layout.ts` (:59 junctions, buildJunctions :241-264, feed/output placement :175-236) + `src/layout/footprints.ts:73-77`.
- `src/core/manifold.ts` (FeedLaneResult :76-90 — hardware/standingBufferItems; BusSegment entryFlow/handoffResidue; collectionCascade :107).
- The locked decisions: #140 c24769 (D+F), c24796 (buffer line), c24797 (cascades in tables), c24770 (pipe Level 1); the two binding caveats in `features/game-mechanics-rework/p1-completion.md`.

## B. Claims to verify (the design's load-bearing spine)

1. **The taper's honesty**: the claim that uniform per-machine drain makes the in-stretch profile exactly linear in x (constant pitch) — check against `drainSpan`/the entry-boundary math; is there any stretch shape (empty spans, clamped entries, single-machine stretches) where a straight left-to-right taper misstates the profile?
2. **The terminal rule** (caveat 1): number = onward flow ("0"), thickness = capacity occupancy (tapers to surplus), surplus surfaced in tooltip + card. Is this coherent — or does thickness-30-with-number-0 create a NEW misreading the legend entry cannot carry? Would tapering the terminal ribbon to zero WIDTH while showing surplus only textually be simpler/honest-er? Adjudicate.
3. **The endpoint-label economy**: entry number every stretch + hand-off only when positive & non-terminal + terminal 0. For 8411: 17 entry + 8 hand-off + 1 terminal = 26 labels. Does that satisfy c24769's "constant label ink" criterion (2 per stretch max), and is the 20px thinning rule sound at band-mode pitch?
4. **The pipe connector** (D4): does adding a neutral line CONTRADICT the P1-decided "no segments for pipes" honesty, or is a non-flow connector consistent with c24770? Check no existing test pins the current no-connector rendering (the spec's ledger claims this by grep).
5. **D7's seam-kind derivation**: "feed column j is seam-merger when its stretch's residue-in > 0, where residue-in = previous stretch's handoffResidue" — verify against buildJunctions' one-junction-per-COLUMN shape (junctions are per machine column, not per stretch — is the mapping from stretch residue to a single column well-defined, and is the FIRST column of the stretch the right one?). Also: layout.ts's site plan currently takes which inputs — does it even receive segments today (check the signature; the spec says the data is "threaded... no solver change" — verify the thread is actually available or name the plumbing).
6. **Selector/pin survival**: the claim that `bus-seg` DOM pins survive line→polygon if class-selected — grep the actual selectors in single-lane-feed-belts.test.tsx, smoke.test.tsx, and any getByRole/tag-based queries that break.
7. **Decision conformance**: nothing re-opens c24769's declined options (no per-gap numbers, no attachment-count labels on the drawing); hardware stays in tables; nothing exceeds Level-1 pipe honesty; P3's view-architecture scope untouched.

Return APPROVED / APPROVED_WITH_NITS / NEEDS_REWORK / BLOCKED with severity-tagged, line-cited findings.
