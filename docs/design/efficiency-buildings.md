# Efficiency buildings — making bees do more per second

Companion to [`cell-type-ideas.md`](./cell-type-ideas.md). That doc asked "what else could the
player build?" This one asks a narrower question: **what can the player build to make the
work the colony already does cost less?**

The ideas are ordered by an audit of where worker-seconds actually go, because the
intuitive answer (foraging) turns out to be wrong.

---

## 1. Where the time actually goes

Worked from the constants in `colony/constants.ts` and the job logic in `AdultCareSystem`,
`BroodSystem`, and `EconomySystem`. Travel numbers assume a walking speed of 90 px/s
(`beeSpeed: 0.09`) and a typical in-hive trip of ~250 px (roughly 4 hexes at
`hexSize: 36`). Flight is 270 px/s (`beeSpeed × 1.2 × forageFlightSpeedMultiplier`).
Distances are layout-dependent, so treat these as order-of-magnitude, not precise.

### The surprise: adult upkeep is the biggest line item

**Water delivery is the most expensive job in the game per unit of value.**

In `AdultCareSystem`, a `waterDeliver` job spawns for _every_ bee whose thirst passes 30
(`thirstCareThreshold`). With `thirstPerSec: 0.5` and `thirstRelief: 50`, that's about one
job per bee per **60 seconds**. And `tryWater` is satisfied by a _different_ worker walking
within 38 px of the thirsty bee:

```ts
const worker = job.reservedBeeIds[0] ? findEntityById(...) : undefined;
if (worker.pos.sub(target.pos).size > 38) { return; }
```

So each drink costs a **second bee's entire round trip** — and consumes no stored resource
at all. Nothing is checked about what that worker is carrying.

At ~3.5 worker-seconds per delivery, one drink per bee per 60 s:

> **≈ 6% of your entire workforce is permanently walking around delivering water**, and it
> scales linearly with colony size — every bee you add adds its own water burden _and_ the
> labour to service it.

Compare `adultFeed`, which is much better designed: `tryAdultFeed` early-returns unless
`targetId === worker.id`, so the hungry bee feeds _itself_. It costs only its own walk
(~2.8 s every ~37 s ≈ 7.5% of that bee's own time), and no second bee is consumed.

**Worth checking against intent:** that `waterDeliver` needs no water carried and no
cistern to draw from looks like a placeholder. Whether it's a bug or a simplification,
it's the single highest-leverage thing on this page.

### Second: feeding larvae

`larvaePollenUnitsNeeded: 4` plus `larvaeNectarUnitsNeeded: 1` means **five separate
round trips** per larva, each one: walk to a food cell → `feedLarvaeCollectMs` (1 s) →
walk to the brood cell → `feedLarvaeDepositMs` (1 s).

At ~2.8 s of walking each way, that's ~7.6 s per trip, **≈ 38 worker-seconds per larva**,
plus 5 s of `cleanBrood` afterwards. This is the dominant _productive_ labour cost in the
game, and about 70% of it is walking.

### Third: foraging

A forage trip returns `foragePollenDepositAmount: 3` units into a cell holding 12. Four
trips to fill one pollen cell. Each trip is flight-speed and the outbound distance is set
by the Tiled flower map, so call it ~7 s round trip — **noticeably cheaper per unit than
the in-hive feeding trips that consume the output.**

### Rough budget

| Activity         | Cost                         | Scales with        |
| ---------------- | ---------------------------- | ------------------ |
| Water delivery   | ~6% of all workers, always   | Bee count (linear) |
| Self-feeding     | ~7.5% of each bee's own time | Bee count (linear) |
| Feeding larvae   | ~38 worker-sec per larva     | Brood rate         |
| Cleaning brood   | 5 s per cycle                | Brood rate         |
| Foraging         | ~7 s per 3 units             | Consumption        |
| Honey processing | ~12.5 s per cell             | Nectar volume      |

**Two conclusions.** Upkeep overhead (water + food) is a fixed ~13% tax that grows with the
colony and never produces anything — that's where the biggest efficiency buildings belong.
And within productive work, **travel dominates the task itself**, so buildings that shorten
trips beat buildings that speed up timers.

---

## 2. The levers

Every efficiency building has to pull one of these. Listed with the constant it touches, so
each idea below is a concrete diff rather than a vibe.

| Lever               | Constants / code                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Trips per outcome   | `larvaePollenUnitsNeeded`, `foragePollenDepositAmount`, `pollenPerFeedUnit`                                       |
| Travel distance     | `hex-path.ts` costs, deposit-target selection, entrance position                                                  |
| Travel speed        | `beeSpeed`, `pathLegEasingMinSpeedMultiplier`, `beeLevelTransitionMs`                                             |
| Task duration       | `feedLarvaeCollectMs`, `cellBuildTargetSec`, `honeyProcessRatePerSec`, `cleaningDurationMs`, `queenLayDurationMs` |
| Need drain          | `hungerPerSec`, `thirstPerSec`, `hungerRelief`, `thirstRelief`                                                    |
| Bees per job        | `beesNeeded`, and `builders / cellBuildTargetSec` in `BuildSystem`                                                |
| Who takes the job   | `getWorkerStagePreferenceDistanceBonusPx` (180 px today)                                                          |
| Resource per action | `cellBuildWaxCost`, `adultFeedPollenCost`, `larvaeFeedHoneyCost`                                                  |

---

## 3. Kill the upkeep tax

The highest-value group, because these free labour that currently produces nothing.

### 3.1 Water trough — self-serve

**The fix:** thirsty bees walk to a trough themselves, exactly like `adultFeed` already
works. `waterDeliver` stops reserving a second bee.

**Instantly halves the cost of every drink in the game** — one bee's walk instead of two —
and it's a ~10-line change to `tryWater` plus a target-selection call that
`self-feed-target.ts` already implements for food. Of everything in this document, this is
the best ratio of impact to effort.

**Storage on top:** give the trough capacity (say 20 drinks) and let one `forageWater`
trip fill it in bulk instead of servicing one bee. Now water is ~1 forager trip per 20
drinks instead of 1 per drink, and it becomes a Winter preparation item, since
`cancelWinterForageJobs` cuts off resupply.

### 3.2 Dew collector

Placed on the hive's top level or perimeter; passively trickles water in with **no forage
trip at all**. Slow — call it one drink per 8 s — so it covers a small colony's baseline
and supplements a large one.

The point is a building whose whole job is to remove a category of trip from the game.
Pairs naturally with the trough: the collector fills it, bees serve themselves, and nobody
flies anywhere.

### 3.3 Refectory (combined feeding station)

One cell that satisfies **both** hunger and thirst in a single visit.

Right now `adultFeed` (priority 95) and `waterDeliver` (priority 90) are separate jobs with
separate trips, and both fire for the same bee on overlapping cycles. A refectory merges
them: one walk, both needs cleared. That's a straight ~40% cut to total upkeep trips, and
it gives the player a reason to build a deliberate "canteen" district rather than
scattering food.

### 3.4 Loafing comb (rest cell)

Idle bees currently drift at random (`IdleWanderSystem`) while hunger and thirst tick at
full rate. A loafing comb gives them somewhere to be, and halves `hungerPerSec` /
`thirstPerSec` while they're resting on it.

This attacks upkeep at the source rather than servicing it faster: a colony with slack
labour stops converting that slack into feeding jobs. It also makes idle bees _look_
purposeful, which is worth something on its own.

---

## 4. Cut trips per larva

Five round trips per larva is the game's biggest productive cost, and ~70% of it is walking.

### 4.1 Pantry cell

A small mixed-food buffer placed **adjacent to the brood nest**. Nurses draw from it
instead of from distant storage, which deletes the `toPickup` travel leg from
`feedLarvaePhase` entirely.

Cuts roughly 40% off every feeding trip, and creates the classic factory decision: keep a
local buffer stocked (costing separate restocking trips that can be batched and run by
off-peak labour) versus long hauls on the critical path. Restocking a pantry with 12 units
in bulk is far cheaper than 12 individual nurse trips.

### 4.2 Feeding gallery — one trip, several mouths

A nurse standing on a gallery cell feeds **every adjacent larva** from a single carried
load instead of one.

This is the inserter-arm idea in its most direct form: one trip serving 3 brood cells cuts
feeding labour by two-thirds for clustered brood, and it makes tight brood packing pay off
without any new resource. Probably the highest ceiling in this section, because it scales
with how well the player lays out the nest.

### 4.3 Pollen press / bee bread

Densify the payload so a larva needs 1 trip instead of 4 — the `larvaePollenUnitsNeeded`
lever pulled directly.

Covered in the previous doc as a production chain; from an efficiency standpoint it's the
single largest multiplier available, because it attacks trip _count_, and trip count is
what everything else here only chips at. It also gives surplus pollen a sink — pollen
cells currently cap out and foragers just stop collecting.

### 4.4 Nurse cell

Full automation of feeding for adjacent brood (see `cell-type-ideas.md` §3.1). Priced at
one permanently stationed bee, it converts a _variable_ stream of trips into a _fixed_
labour cost — which is exactly the trade a factory game should offer.

---

## 5. Cut travel

### 5.1 Flyway / corridor

A cheap cell (~2 wax) that stores nothing, grants a movement speed bonus, and — the
important part — is **preferred by the pathfinder**, so bees route along it.

Today every built cell is storage, so there's no such thing as a hallway and no reason not
to pack the comb solid. A flyway turns the comb into a road network and makes empty space
intentional. Because travel dominates nearly every job, a well-placed trunk route improves
_everything_ at once, which is the kind of building players enjoy optimising.

### 5.2 Shaft cell

Vertical express route (see `cell-type-ideas.md` §3.4). Levels −2..+2 already exist, but
each crossing pays a `beeLevelTransitionMs` hold plus junction pathing, so vertical layouts
are quietly taxed. The shaft makes multi-level hives competitive instead of merely legal.

### 5.3 Landing board / second entrance

Forage travel is measured flower → deposit cell. An entrance near the flower field
shortens the return leg of every single forage trip in the game, and gives the player a
reason to build storage _toward_ it — a real spatial decision where there currently is
none.

### 5.4 Depot cell

A high-capacity deposit cell that accepts **6–9 units per forage drop** instead of
`foragePollenDepositAmount: 3`. Halves or thirds forage trips to fill storage.

Balance it by making depots expensive and not increasing total capacity — you build a few
on the entrance approach, not everywhere, so it's placement rather than spam.

---

## 6. Speed up the task itself (beacons)

Lower priority than the travel and trip-count ideas above, because the timers are the
smaller half of most jobs. Still worth having as a late-game optimisation layer.

- **Fanning vent** — ×2 `honeyProcessRatePerSec` for bees processing in radius. Note this
  is the _speedup_ version, distinct from the auto-converter in the other doc; it stacks
  with labour instead of replacing it.
- **Royal court** — reduces `queenLayDurationMs` and `queenLayIntervalMs` for brood cells
  adjacent to it. There is exactly one queen and she walks to every cell she lays in, so
  lay throughput is a hard ceiling on colony growth. Highest-leverage beacon in the game.
- **Incubator** — reduces `eggDurationMs` and `sealedDurationMs` in radius. Compounding
  rather than linear: faster brood → more bees → more labour → more brood. Tune carefully,
  and probably cap it.
- **Builder's scaffold** — reduces `cellBuildTargetSec` in radius, and doubles as a local
  wax buffer. Worth it for the buffer alone: `BuildSystem` currently releases its builders
  and reopens the job whenever stored wax hits zero mid-build, so a wax-starved colony
  thrashes bees on and off build sites.
- **Hygiene station** — reduces `cleaningDurationMs` (5 s per brood cycle) and frees
  stage-1 bees. Small, but cleaning is pure overhead between larvae.

### Stacking rule — decide this before building any of them

Radius bonuses invite the player to ring one cell with eight boosters. Recommendation:
**only the strongest booster in range applies**, or multiplicative stacking with a hard
cap. Pick one rule and apply it to every beacon so the player can reason about it. Getting
this wrong is how beacon systems turn into a single dominant blueprint.

---

## 7. Better assignment, less idle

Efficiency that costs no travel at all — just getting the right bee onto the right job.

- **Task board / pheromone post** — boosts `getWorkerStagePreferenceDistanceBonusPx` (a
  flat 180 px today) for a chosen job kind in its zone, so the _right life stage_ wins
  assignment rather than merely the nearest bee. This is a module for the assignment
  system, and it's the cheapest efficiency building to implement — no new pathing, no new
  resource, no sprite states.
- **Zone markers** — designate a cluster as "brood feeding only" or "foragers don't deposit
  here." Stops cross-hive commuting, and fixes the everyday annoyance of watching a bee fly
  past three valid cells to reach a fourth.

Worth noting a related wart: `tryConsumeCellNectar` and `tryConsumeCellHoney` iterate
`cellsByKey` and consume from the **first matching cell**, not the nearest — so the
fallback path teleports food. Any zoning work should fix that too, or zones will leak.

---

## 8. Parallelism and cost

- **Honey vat (wide cell)** — a large cell with `beesNeeded: 3` that processes at ~3×.
  Precedent exists: `BuildSystem` already scales with `builders / cellBuildTargetSec`, so
  multi-bee throughput is a proven pattern in this codebase. Bigger machine, more
  throughput per tile — the most literal factory-game import in the document.
- **Comb frame (prefab)** — one build job lays 7 foundations at a wax discount (25 instead
  of 35). Cuts the per-job overhead of queuing, pathing, and reserving builders seven times
  over.
- **Wax reserve cell** — dedicated storage above the `workers × 4` cap
  (`beeswaxCapacity`). Fixes the build-thrash described above and lets a small colony bank
  wax for one big expansion.
- **Salvage cell** — refunds part of `cellRetypeWaxCost` and reclaims wax from demolished
  comb. Efficiency of _iteration_: right now the player has to be right the first time, and
  cheap re-planning is what makes an optimisation game feel good to replay.

---

## 9. What I'd build first

Ranked by labour freed per unit of implementation effort.

| #   | Building                      | Expected win                                             | Effort |
| --- | ----------------------------- | -------------------------------------------------------- | ------ |
| 1   | **Water trough** (self-serve) | ~3% of total workforce, immediately; more with bulk fill | Low    |
| 2   | **Pantry cell**               | ~40% off every larvae feeding trip                       | Medium |
| 3   | **Feeding gallery**           | Up to −66% feeding labour for clustered brood            | Medium |
| 4   | **Flyway/corridor**           | Improves every job at once; makes layout matter          | Medium |
| 5   | **Task board**                | No travel change, pure assignment quality                | Low    |
| 6   | **Royal court**               | Lifts the hard ceiling on colony growth                  | Low    |

Numbers 1 and 5 are small, self-contained changes that need no new sprites, no pathfinding
work, and no save-format concerns if implemented as cell flags rather than new
`CellTypeKind` values.

**If you only do one thing:** make water self-serve. It's a handful of lines in
`tryWater`, it removes an entire class of wasted trip, and the saving grows with every bee
the player adds.

---

## 10. Implementation notes

Most ideas here avoid the expensive parts of adding a cell type (see
`cell-type-ideas.md` §8 for those). Specifically:

- **Beacons and zones can be flags, not types.** A `boosts` field on `CellStateComponent`
  or a parallel component keeps `CellTypeKind` at four values, which avoids the save-codec
  migration, the sprite-sheet pressure, and the hardcoded three-button picker.
- **Radius queries need a helper.** Nothing in the codebase currently asks "what cells are
  within N hexes of this one." `hex-grid.ts` has the coordinate maths; a `neighborsWithin`
  helper plus a cached per-cell booster lookup should land before the first beacon, or
  every system will roll its own ring-walk.
- **Rate modifiers want a single choke point.** `getActiveColonyConstants()` is already the
  indirection layer for effective constants — per-cell modifiers should resolve through
  something similar rather than being multiplied inline at each call site, or the stacking
  rule from §6 becomes unenforceable.
- **Self-serve water reuses existing code.** `self-feed-target.ts` already does
  nearest-cell selection with a cross-level penalty; pointing `waterDeliver` at it is the
  bulk of idea §3.1.
