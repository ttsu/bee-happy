# What Bee Happy can take from Timberborn

Third in the series, after [`cell-type-ideas.md`](./cell-type-ideas.md) and
[`efficiency-buildings.md`](./efficiency-buildings.md).

Timberborn is a good reference precisely because it is _not_ Factorio. It's a colony
builder where the citizens walk, get thirsty, have opinions about their quality of life,
and die — which is much closer to what Bee Happy already is. Its mechanical spine is worth
studying in detail.

---

## 1. The one big lesson

**In Timberborn, wellbeing is a production multiplier. In Bee Happy, happiness is a
scoreboard.**

Timberborn's beavers have needs past mere survival — shelter, leisure, food variety,
temples and carousels and lidos. Meeting them raises wellbeing, and wellbeing grants
**+walking speed and +lifespan**. That single design choice is what makes the whole
mid-game work: amenity buildings compete with production buildings for space and labour,
and the player is constantly trading immediate output against a colony that moves faster
and lives longer. It's an investment decision, not a happiness meter.

Bee Happy already has the meter. `WorkerLifecycleSystem` accumulates
`happyBeeSecondsTotal`, `colony-ui-snapshot.ts` computes a happy-percentage for the HUD,
and the year-review modal displays it. And it feeds into **nothing**:

```ts
if (needs.hunger <= COLONY.happyHungerMax && needs.thirst <= COLONY.happyThirstMax) {
  yearly.happyBeeSecondsTotal += sec;
}
```

That's the whole mechanic. Two physiological thresholds, tallied for display.

The game is called Bee Happy. The title is promising a system the game doesn't have yet.

### The change

Make happiness modify `beeSpeed` and `workerLifespanMs`. Both already flow through
`effective-colony.ts`, which exists to apply lineage modifiers — so the plumbing for
"constants that vary at runtime" is built and tested.

The payoff is disproportionate to the effort:

- The existing HUD meter becomes a dashboard the player acts on instead of a stat they
  glance at
- Every efficiency building in the previous doc gets multiplied by it, because speed
  applies to the travel that dominates every job
- It creates demand for an entire new category of buildable cell — **amenities** — that
  isn't storage, isn't brood, and isn't automation
- Longer-lived bees mean fewer replacement larvae, which compounds into the ~38
  worker-seconds per larva that feeding costs

### Amenity cells worth building

Timberborn's leisure buildings have no output; they exist to be walked to. The bee versions
mostly write themselves, and several are real behaviours:

- **Bearding ledge** — bees cluster on the hive face on hot days. Summer wellbeing,
  useless in Winter, which gives it a seasonal rhythm.
- **Loafing comb** — the rest cell from the efficiency doc, now doing double duty:
  slows need drain _and_ grants wellbeing.
- **Dance floor** — social space and forage intel in one building (Timberborn's campfire
  crossed with a train station).
- **Propolis chamber** — aromatic resin lining; the hive's temple.
- **Food variety** — a bee fed on nectar, honey, pollen _and_ bee bread gets a variety
  bonus. This is a direct Timberborn import, it's nearly free to implement on top of the
  existing feed paths, and it gives the bee-bread chain a second reason to exist.

Variety is the sharpest of these, because it makes a _production_ decision (do I refine
pollen?) pay off in the _wellbeing_ system, tying the two economies together the way
Timberborn ties farming to leisure.

---

## 2. Heat as a utility network

Timberborn's other spine is power: water wheels generate it, power shafts distribute it,
gravity batteries store it, machines consume it. Placement matters because the network is
physical.

Bee Happy has no equivalent, and there's a bee-native one sitting right there: **heat**.
Real colonies hold the brood nest near 35 °C by clustering and shivering, burning honey as
fuel. That is a production, distribution, storage and consumption chain, already
thematically justified.

| Timberborn      | Bee Happy                                                           |
| --------------- | ------------------------------------------------------------------- |
| Water wheel     | Shivering cluster — bees burn honey to make heat                    |
| Power shaft     | **The comb itself** — heat propagates through built cells, decaying |
| Gravity battery | Thermal mass cell — wax/honey buffers warmth through a cold snap    |
| Machine         | Incubator (faster brood), ripening cell (warmth drives evaporation) |
| Efficiency mod  | Propolis lining — cuts loss at the hive perimeter                   |

The elegant part is the distribution layer: Timberborn makes you build shafts, but comb is
_already_ a connected graph, so heat can propagate through built cells with distance
falloff and no new object at all. Layout becomes the network. Sprawl leaks heat; compact
hives hold it. That's a spatial pressure the game currently doesn't have — nothing today
punishes a straggly hive except walking distance.

It also fixes Winter. Right now Winter cancels foraging and you wait for it to end. With
heat, Winter is an engineering problem: bank enough honey to keep the cluster burning, keep
the nest compact enough to hold warmth, and decide whether to spend fuel on over-wintering
brood so you explode in early Spring. Honey stops being purely a win condition and becomes
**fuel**, which is the closing of a loop the economy currently lacks.

This is the largest idea in these three documents, and the most work. It's also the one
that would most change what the game _is_.

---

## 3. Districts — the structural answer to commuting

Timberborn's district centre has a radius. Beavers live and work inside it; goods move
between districts through distribution posts staffed by haulers. You cannot solve sprawl
by building one enormous city — you're forced to decentralise.

I suggested scent markers and zone filters in the efficiency doc. Timberborn's answer is
better, because it's spatial and visible rather than a settings panel:

**A nest core cell with a radius.** Bees belong to a core and take jobs within its reach.
Growing past the radius means placing a _second_ core with its own storage, brood, and
labour pool — and moving goods between cores becomes an explicit hauling job you build for.

This maps unusually well onto the five hive levels, which could each host their own core,
and it turns "my bee flew across the entire hive to the wrong cell" from an annoyance into
a designed constraint with a designed solution.

---

## 4. Escalating winters

Timberborn's droughts get longer every cycle. That single ratchet is the source of all its
long-term tension: every wet season is spent preparing for a dry season you know will be
worse than the last one.

Bee Happy's seasons are fixed length. Years 1, 2 and 3 are mechanically identical apart
from the year-3 queen age-out (`queenAgeOutYearNumber`). The year counter exists but
doesn't _do_ anything.

`daysPerSeason` is already a runtime value — `colony.daysPerSeason`, configurable through
`game-settings.ts` and threaded through `getSeasonForColonyDay` and the demand model. So
scaling Winter length or harshness with `yearNumber` is close to free, and it converts
`computeWinterHoneyNeed` from a checkbox into a race. It also gives the optional-succession
decision real weight: do you push one more year against a longer Winter, or hand off now?

Of everything in this document, this is the highest tension-per-line-of-code.

---

## 5. Day and night

Timberborn beavers have working hours — they stop, eat, socialise, and sleep. Bees do this
for real: no night foraging.

A diurnal cycle inside the existing colony day would batch the game's tasks into a rhythm.
Foraging by day; processing, building, and nursing by night. It makes the day counter
felt rather than merely displayed, gives the renderer an obvious night palette to play
with, and turns "how many foragers versus in-hive workers" into a genuine ratio question
rather than an emergent accident of `EconomySystem` spawning forage jobs for every idle
worker.

Modest scope, high atmosphere, and it makes the existing lifecycle stages read more
clearly.

---

## 6. Worker slots — import the priority, not the slots

Timberborn buildings have explicit worker slots (1–3) and a per-building priority; you
staff them by hand.

I'd **not** import slots wholesale. Bee Happy's charm is partly that the bees self-organise
— `JobAssignmentSystem` picking the nearest eligible bee with a life-stage bonus produces
the pleasant feeling of watching a colony rather than commanding one. Making the player
staff every cell would trade that away for micromanagement.

Import the _priority_ half instead: let the player mark a cell or a region as high
priority and have that weight assignment. The plumbing exists —
`getWorkerStagePreferenceDistanceBonusPx` is already a distance-bonus knob on assignment,
and a player-set bonus would ride the same path. Control where the player wants it,
emergence everywhere else.

---

## 7. What not to import

- **Water and terrain physics.** Timberborn's flowing water, dams, levees and flooding are
  its heart, and they don't port. Bee Happy's world is a discrete hex graph on a fixed
  map, with no terrain to flood and no elevation to dam. Fluid simulation would fight the
  architecture for a mechanic the hive setting can't justify.
- **Two factions.** Timberborn ships two full building sets. That's a content-scope trap.
- **Terraforming.** The comb _is_ the terrain here, and the player already builds it — Bee
  Happy arguably does this better than Timberborn does.
- **The full needs list.** Timberborn tracks around ten wellbeing sources. Bee Happy's UI
  is a compact HUD and a hex canvas; three or four amenity sources is the ceiling before
  the interface drowns.

---

## 8. Ranked

| #   | Idea                             | Why                                                               | Effort |
| --- | -------------------------------- | ----------------------------------------------------------------- | ------ |
| 1   | **Happiness → speed + lifespan** | The meter already exists and does nothing; the title promises it  | Low    |
| 2   | **Escalating winters**           | `daysPerSeason` is already runtime; gives the year counter stakes | Low    |
| 3   | **Food variety bonus**           | Ties the refining chain to wellbeing; rides existing feed paths   | Low    |
| 4   | **Amenity cells**                | A whole new build category, unlocked by #1                        | Medium |
| 5   | **Day/night cycle**              | Rhythm and atmosphere; makes the forager ratio a real decision    | Medium |
| 6   | **Nest cores / districts**       | Structural fix for cross-hive commuting                           | High   |
| 7   | **Heat network**                 | Biggest idea here; makes Winter an engineering problem            | High   |

Items 1–3 are small, independent, and together they'd change how the game feels more than
any single new cell type — because they give the systems already in the codebase something
to _do_.

**The one-line version:** Timberborn's real lesson isn't dams or power shafts. It's that a
colony sim gets its depth from citizens who are more than hungry, and from a seasonal
threat that gets worse every cycle. Bee Happy has the bees and it has the Winter. Both are
currently inert.
