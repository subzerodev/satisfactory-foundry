# Foundry changelog — deploy-facing notes

One section per merge to `develop`, most recent first. Each entry is written
to you, the app's user, in plain language — copy-paste friendly.

## 2026-08-05 — Stage 10 complete: breathing room

> Hey Michael — your spacing note, measured and fixed. The panels that
> got their frames in the drawing pass had text sitting right against
> the rules — they all breathe now with the same inset the inspector
> always had. The ＋ stage and FLOW buttons were touching; they have a
> proper gap. And the Mk conveyor/pipe chips were so close their borders
> merged — they read as separate buttons now. I went over every other
> surface with a ruler too (header, legend, title block, tables) and
> they were already right, so nothing else moved. That closes Stage 10 —
> if a spot still feels cramped to you, name it and it gets fixed on
> this ticket's tail.

## 2026-08-05 — Stage 10, Phase 1: bigger canvas, your choice of flow

> Hey Michael — the graph area is now much taller by default, and you
> can resize it yourself: grab the bottom-right corner of the canvas and
> drag (if the grip ever refuses to drag, tell me — I have a fallback
> ready). And the flow chart is yours to orient: the FLOW button next to
> ＋ stage switches between left-to-right and top-to-bottom. Stages
> you've placed by hand stay exactly where you put them; only the ones
> the planner placed automatically re-arrange into the new direction,
> and new stages keep flowing that way. The choice saves with each plan,
> so a chart you laid out top-to-bottom comes back top-to-bottom. Your
> spacing notes are next.

## 2026-08-05 — Stage 10, Phase 0: every control matches the paper

> Hey Michael — your first catch, fixed. Every selection box, input,
> and button now wears the medium: the Recipe picker, the Machines and
> clock fields, the view and tier toggles, the trip fields in the
> inspector — all in the instrument font with the soft-ink frame, in
> both papers. Radios and checkboxes get the orange mark, and even the
> browser's own dropdown menus and number spinners now follow the
> theme. Next up: the bigger, resizable graph area and the
> left-right/top-bottom flow option — and your spacing notes are
> ticketed for the pass right after.

## 2026-08-05 — Stage 9 complete: the full drawing identity

> Hey Michael — the last surfaces joined the drawing. The train and
> recipe-comparison tables are proper schedules now (mono figures under
> ruled, letter-spaced headers), every panel sits on the sheet in a
> square soft-ink frame, the floor-plan labels use the instrument font,
> and keyboard focus gets a clear orange ring in both papers. That's the
> whole identity you approved, shipped end to end: vellum and cyanotype,
> title block to inspection stamps. The planner finally looks like what
> it is — a FICSIT engineering document.

## 2026-08-05 — Stage 9, Phase 1: the canvas joins the drawing

> Hey Michael — the graph itself now speaks the language. Stages are
> machine plates: square ink-bordered nameplates with your stage name in
> drafting caps and the numbers in the instrument font. The wires are
> dimension lines — thin ink with a proper drafting tick at the consumer
> end, the rate riding the line as dimension text. And when a feed runs
> short, you get an actual inspection stamp: a red-bordered, slightly
> tilted "SHORT 90/MIN · ×6 COVERS IT" slapped on the line, like a QA
> reject tag. Unrouted feeds get a calmer amber-boxed note. The canvas
> grid is graph-paper lines now and even the zoom controls wear the
> medium. Works in both papers — vellum and cyanotype. Last phase:
> the side panels and tables become drawing schedules.

## 2026-08-05 — Stage 9, Phase 0: the drawing-sheet look begins

> Hey Michael — the app started dressing for the job. It now wears the
> engineering-drawing identity you picked: warm vellum drafting paper in
> light mode, and dark mode is a true cyanotype blueprint — the toggle
> even names where it's taking you (it says CYANOTYPE on paper, VELLUM
> on blueprint). The header is the sheet's top strip with the new
> wordmark and the legend redrawn as line conventions (solid rules for
> belts, dashed for pipes), the whole app sits inside a double ink
> frame, and the bottom-right has a real title block: what you're
> working on, sheet stats, today's date, "/MIN · EXACT Q", and the
> chain's total power. Fonts ship with the app — nothing phones home.
> The graph canvas itself still wears its old colors; that's next phase,
> when nodes become machine plates and problems become inspection
> stamps.

## 2026-08-05 — Stage 8 complete: alternate-recipe comparison

> Hey Michael — the last piece of the planner-intelligence arc. When a
> stage's item has alternate recipes, a comparison table now appears next
> to the recipe picker: every way to make that item, side by side, with
> what each REALLY costs — not just the one machine, but the whole
> upstream job down to raw ore: total machines, total power, and the raw
> resources per minute. Iron Ingot shows all five ways (plain smelting,
> Iron Alloy, Basic, Leached, Pure Iron) with honestly different
> trade-offs. Hit apply on a row and the stage swaps to that recipe,
> resized so it keeps making at least what it made before — your wires
> then show you what upstream needs adjusting, and the chain builder or
> the one-click apply can fix it. No "best" badge anywhere: they're your
> trade-offs to make. That's the whole Stage 8 wishlist shipped.

## 2026-08-05 — Stage 8, Phase 3: the auto-chain builder

> Hey Michael — the big one landed. There's a "Build chain" box under the
> graph now: pick a target item, type a rate, hit Propose — and the
> planner designs the whole factory for you. Heavy Modular Frame at
> 10/min? It comes back with the full 12-stage chain — Smelters ×51,
> Constructors for rods, screws, plates, the works — plus a summary of
> the raw ores you'll need to mine (and any byproducts). Nothing touches
> your graph until you hit Apply; then it lands as ordinary stages and
> wires you can edit like anything hand-built, with every wire green on
> arrival (it sizes machines so nothing runs short, rounding up whole
> machines). It sticks to standard recipes and stops at raw resources —
> comparing alternate recipes is the next (and last) piece of this arc.

## 2026-08-04 — Stage 8, Phase 2: transport fine-tuning knobs

> Hey Michael — two honesty knobs for transport links. Pipes: the game's
> pipe ratings are best-case numbers (manifolds slosh), so a pipe link now
> has a "derate %" field — type 50 and the planner sizes the run for half
> the nominal flow, showing "2 pipes sustain 300/min each" with a label
> that says it's YOUR assumption, not a game constant. Leave it empty and
> nothing changes. Trains: if one end of a route shares an existing
> station (say, an unload-only stop at your main hub), tick "station at
> <name> is shared" and that end's power drops out of the station MW
> column — the tonnage math doesn't move, only whose ledger the power sits
> on. Your saved plans upgraded silently and load exactly as before.
> Next: the big one — the auto-chain builder.

## 2026-08-04 — Stage 8, Phase 1: one click instead of retyping

> Hey Michael — two small quality-of-life wins. When a wire says
> "short 600/min · ×30 covers it", click the link and there's now an
> actual button: "apply ×30 to Smelters" — one click sets the machine
> count and the wire flips to ok. It knows about fan-out too, so
> applying never shorts a sibling. And on the Combined floor plan you
> can now click any site to make it the active stage — the panels
> below switch to editing it, the outline follows, and you never leave
> the overview. Next: the transport fine-tuning knobs, then the big
> one — the auto-chain builder.

## 2026-08-04 — Stage 8, Phase 0: under-the-hood housekeeping

> Hey Michael — nothing to see this time, and that's the point. Two
> internal clean-ups landed: the game-data lookups are now bulletproof
> against a weird edge case (an item literally named "constructor"
> could have confused JavaScript's plumbing), and five copies of the
> same transport-resolving code became one. Everything works exactly
> as before — flag anything odd if you spot it. Next up: the one-click
> apply button and clicking sites on the combined floor plan.

## 2026-08-04 — Stage 7 complete: the whole chain on one floor plan

> Hey Michael — the last piece of the logistics arc is in. Flip the
> view twice and you get "Combined": every solved stage laid out as a
> real floor plan in one shared space, arranged the way YOU arranged
> them on the canvas — no new controls to learn, just drag the nodes
> and the site plan follows. The links between sites carry their
> transport story ("≈ 2×1-car trains · 412 m") and the drawn distance
> feeds straight back into the planner: open a link, click "use drawn
> distance", and the fleet recomputes from your own layout. A power
> footer totals the sites and the transport stations honestly (trains
> point you at their comparison table rather than pretending one
> number covers every consist). That's Stage 7 — the whole
> mine-it-here-use-it-there workflow you asked for, from fact table to
> floor plan.

## 2026-08-04 — Stage 7, Phase 2: transport planning on your links

> Hey Michael — click any link between two stages and the transport
> planner opens. Pick the mode — belt, truck, tractor, explorer, fluid
> truck, train, or drone — tell it the trip (a time you measured
> in-game, or a distance for an optimistic estimate), and it answers
> "how many": belts for your unlocked tier, trucks with docking time
> counted, drones with their battery bill. Trains get the full
> comparison table you asked for — every cars-per-train choice side by
> side with train count, station power, and what each sustains — and if
> a route can't keep up at any consist size, it shows up as a finding
> with the fix that provably helps. Estimates always say so with a ≈,
> drone costs only say "batteries" when batteries are the fuel, and
> your saved plans carry all of it. One phase left in this arc: the
> combined floor plan.

## 2026-08-04 — Stage 7, Phase 1: the transport math brain

> Hey Michael — no new buttons yet, but the engine for the logistics
> planner you asked for is in. It knows every vehicle cold — truck 48
> slots, freight car 32, drone 9, the tanker volumes — straight from
> your installed game's own data, and it can answer "how many do I
> need?" exactly: give it a rate and a trip time and it computes the
> fleet, with zero rounding anywhere. Trains get the full treatment:
> it lays out every cars-per-train choice side by side — how many
> trains, how many platforms, the power bill, and whether the station
> itself becomes the bottleneck — so the "one long train vs several
> short ones" question you raised gets real numbers, not a guess.
> Next phase wires this into the links on your canvas.

## 2026-08-04 — Stage 6 complete: the chain explains itself

> Hey Michael — the math you were doing in your head is on screen now.
> When a feed runs short, the wire says exactly how many machines fix
> it — "short 102.5/min · ×19 covers it" — and if one stage feeds the
> same item to several others, it says "×19 total" so you know it's
> the whole load. Capacity warnings now tell you the cheapest way out:
> your Mk1 Plastic bus says "unlocking Mk2 (120/min) would raise the
> bus above this peak" — and it only ever promises what the math can
> prove. And the wattage is everywhere it should be: each stage card
> shows its draw (exact at 100% — your 14 Manufacturers pull exactly
> 770 MW), overclocked stages show an honest ≈, the odd machines like
> the Particle Accelerator show their swing range, and the canvas
> totals the whole chain. That's the helpers batch done — next up:
> the logistics arc you asked for.

## 2026-08-04 — Stage 6, Phase 1: plans travel + the app learns wattage

> Hey Michael — two quiet foundations landed. Your plans can now leave
> the browser: an Export button next to each saved plan downloads it as
> a small JSON file, and Import brings one back in — share them, back
> them up, move machines. A broken or hand-mangled file gets refused
> with a plain message and never touches what you have. And under the
> hood the app now knows what every machine costs to run — real
> megawatt numbers for all twenty buildings, pulled from the game's own
> data, including the weird ones like the Particle Accelerator whose
> draw swings between 250 and 1500 MW. You can't see the power numbers
> yet: the next update puts them on the stage cards, along with the
> "how many machines do I actually need" suggestions and fix hints on
> capacity warnings.

## 2026-08-04 — Stage 5 complete: the polish round — and that's the whole plan

> Hey Michael — the finishing touches are in, and with them every stage
> of the original plan is shipped. What's new: hover anywhere on the
> schematic and you get a proper styled tooltip instead of the browser's
> plain one; drag a Docs.json from your file manager and drop it
> anywhere on the app — it reads the real UTF-16 file correctly, same as
> the upload button; there's a ☾ button in the header for dark mode (it
> remembers your choice, follows your system setting until you pick, and
> darkens everything — canvas, schematic, blueprint); and fluid lanes
> now look different from belts — dashed blue pipes in both the
> schematic and the blueprint, so a Refinery build reads at a glance.
> That's tooltips, drag-drop, dark mode, pipes — the polish list, done.
> The foundry now does everything the master plan set out: exact solver,
> your game data, saved plans, chained factory graphs, buildable
> blueprints, and a finished surface.

## 2026-08-04 — Stage 4 complete: the blueprint view

> Hey Michael — flip the new "View: Blueprint" button above the
> schematic and your solved stage becomes a floor plan: the actual
> foundation tiles you'd need to lay, every machine drawn at its true
> in-game size (a Constructor really is 7.9m wide on the drawing),
> splitters and mergers in their spots along the feed and output
> lanes, and markers showing exactly where each fresh belt drops in or
> breaks out — labelled with the exact rates. It's drawn to scale
> straight from real meters, so what you see is what you'd build.
> Click any stage on the canvas and flip to its blueprint. One click
> back and you're on the familiar schematic. This closes the physical
> layout arc — one stage to go: the polish round.

## 2026-08-04 — Stage 4, Phase 1: the layout brain (nothing visible yet)

> Hey Michael — the app just learned real-world geometry. Under the
> hood there's now an engine that takes any solved stage and works out
> the physical build: every machine's true in-game footprint (pulled
> from the official wiki, building by building — a Constructor really
> is 7.9m wide), where each splitter and merger sits, where a fresh
> feed belt drops into the manifold, and exactly how many 8m
> foundation tiles the whole thing needs. All the math is exact — no
> drifting decimals. You can't see any of it yet: the next update
> draws it as a proper blueprint view. If a future game patch adds a
> machine the app doesn't know, it draws an honest placeholder and
> tells you, rather than guessing silently.

## 2026-08-04 — Stage 3 complete: plans save the whole factory

> Hey Michael — saving a plan now keeps everything. Your stages, their
> recipes and tweaks, the wires between them, even where you dragged
> each card on the canvas — one Save captures the whole factory, and
> Load brings it back exactly, fractions and all. Plans you saved
> before this update still open fine (they come back as a single
> stage, and the next save quietly upgrades them). Your unlocked
> belt/pipe tiers stay YOUR tiers — loading someone's plan never
> rewinds your progression. And if the game data changed since a plan
> was saved, anything that no longer exists is shown honestly as
> missing instead of pretending. This closes out the chained-stages
> arc — the whole-factory editor is done.

## 2026-08-04 — Stage 3, Phase 2: the factory canvas

> Hey Michael — your factory is a map now. Above the usual controls
> there's a canvas: each stage is a card (its name, recipe, machine
> count, and a badge if something's off), and you drag a wire from one
> card's right edge to the next card's left edge to feed one stage into
> another. The wire labels itself with what flows and how healthy it is —
> "Iron Ingot · ok" when supply covers demand, "short 30/min" the moment
> you add a machine downstream and outrun the smelters, exact numbers
> always. Drag cards wherever you like, double-click a name to rename,
> ✕ removes a stage (and its wires), ＋ adds one. Click any card and the
> whole lower screen becomes that stage's manifold drill-in. If a
> connection can't work, a small note in the corner says why in plain
> words — a stage with no recipe yet, two stages that share no item, or
> a feed lane that's already taken. Nothing is silently dropped.

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
