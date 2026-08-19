# Handoff — #140, the game-mechanics audit + rework arc

Written 2026-08-18 because the current session is deep into its context window and
Michael's standing instruction is: **stop and hand off cleanly rather than push on
and finish badly.** Nothing here is started. Read #140 first — it is the ticket.

## Start here

1. `git checkout develop` (currently `1c8684f`, clean, pushed).
2. Read **#140** in full, then #136's audit trail, then #133 / #135 / #138 / #139.
3. Do **Phase 1 only** — the audit. Do not design a model change until Michael has
   read the gap report.

## What Michael has actually decided

Only these. Everything else is open.

- **The solver must become splitter- and game-mechanics-aware** (#136 comment 24714).
- **Investigate first** — he expects more gaps than the splitter one.
- **All related work lands in ONE PR.** The model, the schematic (#135), the
  packaging (#133) and the drawing's legend. Do not merge them separately; that
  fragmentation is what he objected to.
- Test case: **8411 concrete, Wet Concrete alt recipe.**
- Earlier and still binding: packaging lives in the Extraction panel (#133 comment
  24629); the schematic splits into separate views (#135 comment 24630).

## What the last session decided WITHOUT him — treat as un-agreed

He called these out directly. Do not build on them as if settled:

- Tier 2 classification for #133 and #135 (both tickets said Tier 3).
- #135's 12px ruler with two tick kinds — his words: he has not agreed to it.
- Scoping the machine-block redesign out into #138.
- The packaging control's placement, and Resource Well items silently getting none.
- Splitting this into four tickets at all.

If any of those still look right, **ask him**, don't assume.

## The finding driving #140

`manifold.ts:415-417`: a segment's peak is `survivedIn + belt.capacity` — the
previous belt's leftover added onto the next belt's **full** capacity on one line.
That sum exceeding `B` is what emits `parallelCount = 2`.

For his Limestone: 120/min per machine, Mk5 = 780/min, and 780 leaves **60/min**
after 6 machines. The model's answer to 60/min is "run a second belt for the next
several machines". He is right that you would use a splitter instead.

`grep -riE 'splitter|smart|programmable|merger' src/core/ src/data/` → **zero hits.**
The game has five conveyor attachments (verified in the 1.2 `Docs.json`).

## Verified facts, so you need not re-derive them

- Game files: `~/.steam/steam/steamapps/common/Satisfactory/CommunityResources/Docs/en-US.json`,
  **UTF-16LE**, strip the BOM before `json.loads`.
- Belt `mSpeed` in-file: 120 / 240 / 540 / 960 / 1560 / 2400 (Mk1–Mk6). The app's
  `tiers.ts:11` has 60 / 120 / 270 / 480 / 780 / 1200 — exactly half, and those are
  the correct in-game per-minute rates. **The app's numbers are right.**
- Pipe `mFlowLimit`: 5 and 10 (per second) = 300 / 600 per minute. App matches.
- **But `tiers.ts` is a hardcoded literal**, not parsed from `Docs.json`, while
  recipes and items are parsed. Correct by maintenance, not construction.
- `bandMode(N)` = `912/N < 8`, so band mode engages only above **N = 114**. At his
  106 machines the schematic takes the **non-band** path (`Schematic.tsx:507-537`),
  which emits a rect + conditional label per machine and **no tick lines**. A
  previous spec revision got this wrong; do not repeat it.
- `firstLockedTierForOneLine` (`format.ts:66-79`) searches only **locked** tiers —
  the "Mk6 supports one bus line" clause is an upgrade hint, which is #139.

## Where the existing specs stand

- `features/raw-packaging/brainstorm-spec.md` — #133, design **r4**, never
  implemented. Two design rounds; the surviving corrections are real (plan file must
  bump to v9; `migrateV8` must rebuild not pass through; the extraction write must
  canonicalize). Worth keeping, but it was written against the *current* solver.
- `features/schematic-split/brainstorm-spec.md` — #135, design **r3**, built on the
  current model and on the un-agreed ruler design. Expect it to need rework once the
  audit lands.

## Process corrections he asked for, explicitly

- **Do not deploy or declare done at the end of a context window.** Stop, hand off,
  or compact.
- **Ask when unsure** rather than deciding and reporting.
- Do not make post-brainstorm design decisions he has not seen.
- He likes the minimal visual style, but **do not approximate a "current state"
  visual** — render the real thing or say plainly it is illustrative and at what N.

## Suggested first move

Run his 8411 Wet Concrete case through the solver and report how many `x2` runs
exist and which are merge artifacts, before touching anything. That is concrete,
it is his live case, and it gives him real numbers to steer the rework with.
