# Foundry changelog — deploy-facing notes

One section per merge to `develop`, most recent first. Each entry is written
to you, the app's user, in plain language — copy-paste friendly.

## 2026-08-03 — Stage 2: save your factory plans

> Hey Michael — you can name and keep your setups now. Dial in a stage
> (recipe, machines, overclock, tiers, belt tweaks), type a name, hit
> Save — it's stored in your browser and survives closing the tab. Load
> any saved plan and everything comes back exactly as you left it, down
> to fractional overclocks. Rename and delete work as you'd expect;
> saving under an existing name updates that plan. Two plans can never
> share a name, and even a double-click on Save can't create a
> duplicate. This is also the foundation for what's next: chaining
> stages together into a whole-factory view.

## 2026-08-03 — Bundled game data: no more file hunting

> Hey Michael — the app now just works on first open. It ships with a
> snapshot of your game's data built in (taken from your own install,
> Steam build 23855724), so a fresh browser goes straight to the recipe
> picker — no digging through the Steam folder. A small banner tells you
> which game build the bundled data came from; if your game updates past
> it, upload your newer Docs.json and yours takes over (and sticks).
> After a game patch, one command refreshes the built-in snapshot. One
> more safety net came out of review: if the browser's storage ever
> hiccups, the app uses the bundled data for that session but will never
> overwrite anything you uploaded.

## 2026-08-03 — Stage 1, Phase 4: the screen — v1 is complete

> Hey Michael — it's on screen now. Open the app, upload your game's
> Docs.json (the real UTF-16 file works as-is), pick a recipe, set your
> machine count and overclock, and the manifold draws itself: the machine
> row, each feed belt arriving with its entry point ("Feed 2 — Mk2 ·
> 120/min · enters after machine 16"), the bus colored by which belt
> feeds each stretch, and the output side mirrored below with its
> break-out points. Hover any bus stretch to see the exact flow it
> carries. Every number is exact — 37.5 means 37.5. If something can't
> work (a machine overclocked past the best belt, an override that
> starves machines), it tells you plainly instead of drawing a lie.
> Huge builds compress the row to fit; tweak any single belt in the
> list below the drawing. This completes v1 — the whole flow works end
> to end.

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
