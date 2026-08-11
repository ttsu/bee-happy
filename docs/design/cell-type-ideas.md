# Cell type ideas — expanding the build vocabulary

Brainstorm doc. Nothing here is committed to as a design decision; it is a menu with
enough mechanical detail to argue about and enough code context to estimate.

Today the player builds three things: **brood**, **pollen**, and **nectar/honey**. Every
cell is a storage bucket or a nursery slot, and a cell's neighbours are irrelevant to what
it does. That is a small vocabulary for a game whose core verb is "lay out comb."

---

## 1. The framing: bees _are_ the belts

The instinct when borrowing from Factorio or Satisfactory is to add item transport —
belts, inserters, splitters. That doesn't translate here, because Bee Happy already has
transport: it's the bees, and they path across a hex grid and five vertical levels.

What is actually scarce in this game:

| Scarce thing             | Where it shows up in code                                                      |
| ------------------------ | ------------------------------------------------------------------------------ |
| **Worker-seconds**       | `JobAssignmentSystem` — one bee per job, jobs queue up and starve              |
| **Travel distance**      | `findHexPathWorldPointsWithLevels`, `beeLevelTransitionMs`, forage round trips |
| **Beeswax**              | `beeswaxCapacity = workers × 4` — building is hard-capped by population        |
| **Honey at Winter**      | `computeWinterHoneyNeed` — the whole run funnels into one number               |
| **Queen lay throughput** | `queenLayIntervalMs` + one queen walking to each cell                          |

So a "factory component" in Bee Happy is anything that does one of four things:

1. **Deletes a job** — the work still happens, but no bee is reserved for it (automation)
2. **Shortens a trip** — same job, less travel (logistics)
3. **Multiplies a rate** — same job, faster (beacons/modules)
4. **Adds a refinement step** — raw input becomes a denser output (recipes)

Everything below is sorted by which of those four it is.

### The second unexploited axis: adjacency

Cell neighbours currently mean nothing. On a hex grid with 6-neighbour rosettes and
vertical neighbours across 5 levels (`verticalNeighbor` already exists in
`hive-levels.ts`), that is a lot of unused design space. Adjacency is the cheapest
possible way to turn "how many pollen cells do I need" into "where do they go" — and
several ideas below are worth building _mainly_ because they make placement a puzzle.

---

## 2. Rules any new cell should follow

These keep the additions from dissolving the game's existing tension.

- **Automation is slower than a bee, never faster.** An auto-converter that beats a
  worker at honey processing makes workers pointless. Auto-cells trade throughput for
  labour: ~40–50% of the manual rate, but zero worker-seconds. The player builds them for
  surplus and background work, not for the critical path.
- **Everything has upkeep.** Wax decay, honey per tick, or a permanently stationed bee.
  Without upkeep the player just carpets the hive and the decision evaporates. Upkeep is
  also what makes over-building a real, recoverable mistake.
- **Prefer cells that pay off on layout, not on count.** "Build 6 of these" is inventory
  management. "Build this one _here_" is a game.
- **Gate the vocabulary.** Three types is the right number for minute one. Unlock the rest
  through lineage affixes, year number, or a first-time build (`meta-progress.ts` already
  persists across successions and is the natural home for unlocks).
- **Wax cost should scale with power.** `cellBuildWaxCost` is a flat 5 today. Advanced
  cells wanting 15–40 wax gives the wax economy something to do besides gate the early
  game.

---

## 3. Tier 1 — build these first

High value, and each is a small delta on systems that already exist.

### 3.1 Nurse cell (auto brood feeder)

**Hook:** a cell that feeds the larvae touching it, so nurses stop being a bottleneck.

**Mechanic:** the nurse cell pulls pollen/nectar from _its own_ 6 neighbours and pushes
feed units into any larvae cells also in its 6 neighbours. A rosette — nurse cell in the
middle, alternating brood and pollen around it — self-feeds indefinitely. It cannot reach
past its own ring, so range is the whole constraint.

**Cost:** ~20 wax, plus one stationed nurse bee (removed from the labour pool while
assigned). That's the honest version of automation: you're not deleting the work, you're
paying a fixed worker instead of a variable stream of trips.

**Why it's fun:** `feedLarvae` is the highest-traffic job in the game and it's pure
walking. The nurse cell converts a distance problem into a layout problem, and the rosette
pattern is instantly readable on a hex grid. This is the single best pattern-teaching
object in the list.

**Code hook:** replaces the `feed-larvae-path.ts` job for in-range larvae. New system, or
a branch inside `BroodSystem` that decrements `larvaePollenRemaining` /
`larvaeNectarRemaining` directly.

---

### 3.2 Ripening cell (auto honey converter)

**Hook:** wing-fanning cell that evaporates nectar into honey without a bee standing there.

**Mechanic:** converts nectar → honey in the 6 neighbouring nectar cells at roughly
`honeyProcessRatePerSec × 0.4`. No job, no reservation, no bee. Real-bee flavour is exact
— this is literally what fanning is.

**Cost:** ~15 wax, and it consumes a trickle of honey while active (the fanning bees are
burning fuel). During Winter it either shuts off or costs double.

**Why it's fun:** `honeyProcess` currently pins a builder-stage bee in place for ~12s per
cell, and there is a real late-game moment where nectar cells sit full because everyone is
out foraging. This is the release valve — and the slower rate means you still process
manually when Winter is close.

**Code hook:** `EconomySystem.checkFullNectarCells()` already scans for full nectar cells.
Add a pre-pass that converts in-radius cells passively before the job spawns.

---

### 3.3 Water cistern

**Hook:** stored water, so `forageWater` isn't a round trip every single time.

**Mechanic:** a cell that stores water (say 20 units). `forageWater` fills the cistern
instead of hand-delivering to one thirsty bee; `waterDeliver` and self-drinking draw from
the nearest cistern. In Winter, when foraging is cancelled
(`cancelWinterForageJobs`), the cistern is the **only** source — run dry and the colony's
thirst climbs with nothing to do about it.

**Cost:** ~10 wax. Cheap on purpose; this one is quality-of-life first.

**Why it's fun:** water is currently the odd resource out — foraged but never stored, so
it can't be planned for. A cistern makes water a Fall preparation item alongside honey,
which doubles the content of the game's best decision point ("am I ready for Winter?").

**Code hook:** new `cellType`, plus branches in `updateWaterForage` and
`AdultCareSystem`. `self-feed-target.ts` already does nearest-cell-with-cross-level-penalty
selection and generalises cleanly.

---

### 3.4 Shaft cell (vertical elevator)

**Hook:** a chimney that makes moving between hive levels fast.

**Mechanic:** a shaft cell stacked at the same `(q,r)` across several levels drops
`beeLevelTransitionMs` to near zero for bees passing through it, and makes the path cost
between those levels trivial for `findHexPathWorldPointsWithLevels`.

**Cost:** ~12 wax per level, and the cell stores nothing — it's pure infrastructure.

**Why it's fun:** the hive already supports levels −2 to +2, but every cross-level trip
pays a 300ms hold plus pathing through junctions, which quietly taxes any layout that
isn't flat. The shaft makes vertical building _good_ instead of merely possible, and it
introduces the most classic factory-game decision there is: spend tiles on transport
infrastructure now, or pay travel time forever.

**Code hook:** `bee-vertical-move.ts` and the level-junction logic in `hex-path.ts`.

---

### 3.5 Capped honey cell (the winter vault)

**Hook:** honey the colony can't casually eat.

**Mechanic:** spend wax to cap a full honey cell. Capped honey is excluded from
`adultFeed` and larvae feeding — it's Winter reserve only, released automatically when
Winter starts (or manually, at a cost). Uncapping mid-Summer wastes the wax.

**Cost:** ~4 wax per cell capped. Real bees do exactly this.

**Why it's fun:** right now honey is one undifferentiated pool that gets nibbled by daily
feeding, and the winter demand meter is a forecast the player can't act on directly.
Capping turns it into savings vs. chequing — a commitment device, and a genuinely
agonising Fall decision when the colony is hungry _now_.

**Code hook:** a `capped` flag on `CellStateComponent` rather than a new `cellType`, so
it's additive. `deposit-queries.ts` and `self-feed-target.ts` skip capped cells;
`computeWinterHoneyNeed` compares against capped stock.

---

## 4. Tier 2 — production chains

This is where the factory-game DNA actually lands: raw input → time + labour → denser
output. The bee-biology versions of these are real, which is a gift.

### 4.1 Bee bread cell (fermentation)

Pollen + a splash of nectar, sealed in a cell, ferments over ~1 colony day into **bee
bread**. One bee-bread trip feeds a larva as much as 3 pollen trips.

The classic recipe shape: costs time and a cell you can't use for anything else, and pays
back in trips saved. It also gives surplus pollen a sink — pollen currently caps out and
foragers just stop collecting it. And it lets brood cost be tuned by _refinement level_
rather than by raw quantity, which is a much better balancing knob.

### 4.2 Royal jelly cell

Nurse bees convert bee bread + honey → **royal jelly**. Royal jelly does two things:
feeds the queen (`feedQueen` currently consumes nothing, which is a missed hook), and —
more interestingly — becomes a second currency in the succession shop alongside honey.

Wiring a production chain to meta-progression is the highest-leverage connection available
in this codebase. Right now the succession shop spends stored honey
(`succession-shop-prices.ts`), meaning the optimal play is to hoard and never build.
A dedicated meta-currency you have to _manufacture_ makes the last third of a run about
building a jelly line, not about sitting still.

### 4.3 Queen cell (the peanut)

A large, expensive cell that consumes royal jelly over several days to raise a new queen.

Succession is currently something that happens _to_ the player — a bee-count threshold, a
starved queen, or the year-3 age-out (`queenAgeOutYearNumber`). A queen cell makes it a
plan: start raising a successor in Summer, and take a better lineage roll for having
prepared. Failing to finish one before the old queen ages out is a great fail state — it
punishes you at the exact moment the game already spikes in difficulty.

This is my pick for the most valuable single idea in the document, because it converts the
game's existing meta-loop from a timer into a project.

### 4.4 Wax works cell

Converts honey → beeswax at a lossy ratio (real bees burn roughly 6–8 units of honey per
unit of wax; that ratio is already good game balance).

Beeswax today is `workers × 0.28/sec`, capped at `workers × 4`. Building is therefore
gated purely on population, and there is no way to convert a good harvest into faster
expansion. The wax works is the missing lever: burn the surplus to build now. It also
gives early-game colonies a comeback path when population has crashed.

### 4.5 Drone cell

Oversized brood cell, cheap to fill, produces drones who do **no work at all** and eat
like everyone else. Payoff: drones that survive to Fall improve the lineage affix roll at
succession (mating flights = genetic diversity, which is the actual biology).

A pure "waste resources this run to improve the next run" decision, which roguelikes live
on and this game's succession structure already supports.

---

## 5. Tier 3 — bigger swings

### 5.1 Waggle dance floor

A designated open cell where returning foragers "dance." Foragers that path over it
inherit the best-known flower destination instead of `pickRandomFlowerDestination()`'s
uniform random pick — shorter trips, or richer patches, or seasonal flower types.

Flower destinations are currently picked at random from the Tiled map. Introducing
_quality_ per patch, plus a building that propagates knowledge of the good ones, turns
foraging from a fixed-cost timer into something the layout influences. It's also the most
charming possible version of a Factorio train stop.

### 5.2 Second entrance / landing board

An extra hive entrance on the perimeter. Foragers depart and return there, which
re-centres the whole travel economy of a sprawling hive — and gives you a second thing to
defend. `GuardSystem` currently hardcodes `GUARD_TARGET_Q/R = 0`; making entrances real
placed objects fixes that hardcode and creates the throughput-vs-security tradeoff that
guard duty currently lacks.

### 5.3 Scent marker (the filter inserter)

Marks a cluster as reserved: "brood feeding only," "foragers don't deposit here,"
"winter reserve." Solves the everyday annoyance of a bee flying across the hive to the
wrong cell, and it's the logistics-network idea rendered in bee terms — pheromone zones
rather than a UI-heavy request system.

### 5.4 Thermoregulation cell (winter cluster)

Costs honey per tick; keeps brood in radius developing through Winter, and slows hunger
drain for bees clustered nearby.

Winter is currently a survival pause — foraging is cancelled and you wait. Making it
_optionally_ productive, at a steep honey price, gives the season a decision instead of a
countdown, and creates the aggressive playstyle of over-wintering brood to explode in
early Spring.

### 5.5 Corridor cell

A cheap (~2 wax) walkable cell that stores nothing and grants a movement speed bonus.

Right now every built cell is storage, so there's no such thing as a hallway and no reason
not to pack the comb solid. A corridor makes empty space intentional and turns the comb
into a road network — which retroactively makes every distance-based mechanic in the game
more interesting.

### 5.6 Super-cell (merged rosette)

Merge 7 hexes into one large cell with better-than-linear capacity (7 × 12 = 84 → holds 100) and a single deposit point, so foragers make one trip instead of scattering.

The assembler-tier-upgrade idea. Rewards deliberate planning and gives late-game hives a
way to compress a sprawling storage field into something manageable.

---

## 6. Adjacency rules (no new cell types needed)

Worth flagging separately because these are nearly free and they make everything above
land harder:

- **Brood nest warmth** — a brood cell with ≥4 brood neighbours develops ~25% faster. One
  rule, and suddenly clustered brood beats scattered brood. Real biology, too.
- **Storage sprawl penalty** — an isolated pollen/nectar cell with few built neighbours is
  slower to deposit into. Discourages carpeting the map.
- **Vertical stacking bonus** — cells of the same type stacked across levels at the same
  `(q,r)` share capacity or deposit faster. Gives the 5-level hive a reason to exist that
  isn't just more surface area.

If only one thing on this page gets built, brood nest warmth is the cheapest way to make
the hex grid matter.

---

## 7. What I'd build first

1. **Nurse cell** (§3.1) — biggest labour saving, teaches the rosette pattern, makes
   adjacency legible in one glance.
2. **Ripening cell** (§3.2) — smallest code delta of anything here; `checkFullNectarCells`
   is already the right hook.
3. **Queen cell + royal jelly chain** (§4.2–4.3) — the depth play. Turns succession from a
   timer into a project and gives production a destination beyond the winter meter.
4. **Brood nest warmth** (§6) — a single adjacency rule, near-zero cost, changes layout.

Tier 1 alone roughly doubles the build vocabulary while leaving the core loop intact.

---

## 8. Implementation notes

`CellTypeKind` is `"none" | "brood" | "pollen" | "nectar"` in
`colony/ecs/components/colony-components.ts`. Widening that union touches roughly 20
files. Known landmines, from a pass over the call sites:

- **Save format.** `colony/save/colony-save-codec.ts` writes `cellType` as a bare string.
  New values need a format-version bump and a migration path for old saves, plus the Zod
  schemas in `schemas/colony-snapshot.ts`.
- **Sprite sheet is full-ish.** `/images/cell_sprites.png` is a 4×4 grid of 246×280 frames
  (`render/cell-sprite-frames.ts`). Each new type needs frames for its states; more than a
  couple of new types means a bigger sheet or a second one.
- **The picker doesn't scale.** `ui/cell-type-picker.tsx` hardcodes three buttons in
  duplicated blocks. Before adding a fourth, drive it from a data table — otherwise every
  new type is another 25-line copy-paste. Same for
  `ui/placement-cell-type-toolbar.tsx`.
- **Retype clearing.** `cell-retype-capacity.ts` and `CellRetypeSystem` know how to
  relocate pollen/nectar/honey. Any new stored resource (water, bee bread, royal jelly)
  needs a relocation chunk constant and a spare-capacity query, or retyping will silently
  destroy it.
- **Demand meters.** `colony/demand/colony-demand.ts` models exactly three demand bars. A
  fourth resource either joins the model or is deliberately left out of the HUD — worth
  deciding up front rather than discovering at HUD-layout time.
- **Job kinds.** New jobs go in the `JobKind` union, `job-priority.ts`, and
  `worker-lifecycle.ts`'s `isWorkerStagePreferredJobKind`, so the right life stage
  gravitates to them. Cells that automate work are the easier path here — they add a
  system, not a job kind.
- **Tutorial.** `tutorial/tutorial-steps.ts` walks the player through the current three
  types. New types should be unlock-gated so the opening stays as clean as it is now.

**Cheapest possible first step:** the ripening cell and capped honey both ride on existing
state (`honeyProcessingProgress`, a new `capped` flag) and need no new job kind, no
pathfinding work, and no picker changes if capping is a cell action rather than a type.
