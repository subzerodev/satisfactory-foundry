# Foundry changelog — deploy-facing notes

One section per merge to `develop`, most recent first. Each entry is written
to you, the app's user, in plain language — copy-paste friendly.

## 2026-08-03 — Stage 1, Phase 3: the app's memory

> Hey Michael — the app now has its working memory: it remembers which
> recipe you picked, how many machines, your overclock, which belt and pipe
> tiers you've unlocked (that part survives closing the browser), and any
> per-belt tweaks — and it recalculates the whole manifold instantly every
> time you change any of them. It's also careful around re-uploads: a broken
> file never wipes anything, and a genuinely new game-data file safely
> resets only what can no longer be trusted.
>
> One more piece to go: the screen itself. Next phase draws the schematic.

## 2026-08-03 — Stage 1, Phase 2: reading your game's data

> Hey Michael — the app can now read the game's own Docs.json file. Drop the
> file in (well — once the upload screen exists) and it pulls out every
> recipe, machine, and item with the numbers kept perfectly exact: a
> 37.5-per-minute recipe stays exactly 37.5, never 37.499999. It remembers
> the parsed data in your browser so you only re-upload after a game patch,
> and if a file is broken or from an incompatible version it tells you
> up-front instead of drawing something wrong later.
>
> Still nothing on screen — this connects the game data to the solver from
> the last update. Next up: the app's memory (your selections), then finally
> the visual schematic.

## 2026-08-03 — Stage 1, Phase 1: the manifold solver core

> Hey Michael — the brain of the visualizer just landed: the solver that
> works out, for any recipe and machine count, how many belts (or pipes) you
> need, exactly where each one enters the manifold, and where the output side
> has to break out to a fresh belt. It does all the math in exact fractions —
> no floating-point drift, so a 37.5/min recipe lands entry points precisely.
> It also tells you when a plan can't work: which machines would starve (and
> by exactly how much), when a segment would exceed the bus capacity, and
> when one overclocked machine simply out-demands your best belt.
>
> Nothing visible to click yet — this is engine, not screen. The parser,
> state, and the actual schematic UI are the next three phases. You won't
> notice anything until those land.
