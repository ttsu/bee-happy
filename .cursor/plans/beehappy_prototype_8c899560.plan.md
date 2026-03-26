---
name: BeeHappy Prototype
overview: Create a playable Bee Happy prototype in ExcaliburJS with a hex grid hive builder, autonomous queen/worker bees driven by a job system, and a React HUD/overlays for touch-first UI.
todos: []
isProject: false
---

## Goal

Build a working top-down bee colony prototype focused on the core loop:

1. player places hive cells on a hex grid (must be adjacent to existing cell)
  - hive is multi-level: the hex grid exists on multiple stacked levels
  - only one level is visible at a time; player can scroll between levels
  - player can **pan the view** by dragging on the main game area (camera moves; see touch controls)
2. available workers build with wax
3. after build completes, player assigns cell type (brood / pollen / nectar/honey)
4. queen lays eggs in available brood cells
5. worker jobs feed larvae, clean brood cells, forage resources, and defend (later)
6. colony HUD shows bee counts, happiness, resources, and brood occupancy

## Key mechanics decisions (based on your answers)

- Bees have visible movement using simple pathfinding on the hex grid (path nodes come from the grid). Bees can move through free space, but pathfinding routes via nearby hex nodes so they visibly “flow” toward targets.
- **Camera pan:** drag on the main view translates the camera so the player can explore a larger hive without scaling the whole world unrealistically.
- Start with a small pre-seeded hive (queen + a few initial cells + a couple worker bees) so players can unlock egg/brood progression quickly.

## Proposed architecture

We’ll align with Excalibur’s built-in ECS by representing bee/cell/job state as ECS Components and running logic in ECS Systems driven by ECS Queries. Bees remain Actors for visuals, but decisions and progression live in ECS Systems (so we avoid manual array scans).

### Modules / responsibilities

- `grid/hex-grid.ts`
  - Hex coordinate system (axial q,r) and neighbor math.
  - Convert between `HexCoord` and world pixel positions.
  - Hit test: pointer world -> nearest hex.
- `grid/hive-levels.ts`
  - Level indexing (integer `level`, with `0` as the starting level).
  - `HiveCoord = { q, r, level }` helpers.
  - Rules for cross-level adjacency and valid placement on empty levels.
- `input/camera-pan.ts` (or `MyLevel` input helpers)
  - Pointer drag on the **main canvas / game area** moves `Scene` (or engine) **camera** by the drag delta in world space.
  - Works with **screen-to-world** conversion so pan stays consistent under zoom and after level transitions.
- `colony/ecs/components/*`
  - `bee-*.ts`: role, availability, current job ref, carry payload, path/target info.
  - `cell-*.ts`: cell coord, build progress, cell type, brood stage/timers, occupancy flags.
  - `job-*.ts`: job kind, priority, target (coord/world pos), reservation counts/refs, required resources.
  - `bee-happiness`: bee is happy when hunger and thirst meet **minimum thresholds** (fed + hydrated); colony metric = % happy bees.
  - `colony-resources.ts`: wax/pollen/honey (and optional **colony nectar buffer** if used); **nectar-in-cell** is stored on nectar/honey cell components until processed to honey.
  - `bee-level.ts`: which level a bee is currently on (`level`).
  - `cell-level.ts`: which level a cell belongs to (`level`).
  - `active-level.ts`: the currently visible level (stored on the colony controller entity).
- `colony/events/colony-events.ts`
  - Typed event emitter for “state transitions” (job created, cell built, egg laid, larvae ready, etc.).
  - Includes level events: `LevelChangeRequested`, `LevelChangeStarted`, `LevelChanged`.
- `colony/ecs/systems/*`
  - `JobAssignmentSystem`: uses ECS queries to reserve only enough available worker Actors.
  - `BuildSystem`: advances build progress for foundation cells.
  - `QueenEggSystem`: creates lay-egg jobs when brood cells are available.
  - `BroodLifecycleSystem`: advances egg->larvae->sealed->cleaning->empty state and emits events.
  - `FeedingSystem`: executes feed-larva jobs using carried pollen/honey.
  - `ForagingSystem`: executes forage jobs and schedules deposit jobs (nectar into cells, pollen into cells, water for delivery).
  - `HoneyProcessingSystem`: when a nectar cell is full, workers process nectar into honey (not instant on deposit); processing jobs can be preempted for adult feeding (see AdultCare).
  - `CleaningSystem`: advances “clean brood” jobs and returns bees to available state.
  - `MovementSystem`: one **shared path per job** (A* toward job target); reserved bees follow that path with local steering, recomputing only when the job target or graph changes.
  - `LevelVisibilitySystem`: hides/shows bee Actors based on whether `bee.level === activeLevel`.
  - `LevelTransitionSystem`: animates fade + zoom during level switches and gates input during transition.
- `render/`
  - `CellRendererActor`: draws the hex grid + placed cells (one actor for cells).
  - `BeeActor`: one Actor per bee (queen/worker visuals + minimal state); collisions **off by default**; enable selectively during defense (see rendering/performance).
- `ui/` (React)
  - `HudOverlay` shows counts.
  - `CellTypePickerOverlay` appears after build completion.
  - `useColonyStore` exposes simulation state to React.

### Update loop mapping (Excalibur)

- `MyLevel extends Scene`
  - In `onInitialize`:
    - Create a single “colony controller” ECS entity holding resources/time components.
    - Create initial cell entities.
    - Spawn bee Actors and attach bee state components.
    - Register ECS Systems so updates are driven by Queries.
  - In `onPreUpdate` (minimal):
    - Handle **camera pan** (pointer drag on main view) vs **tap-to-place** vs **right-strip level scroll** (see touch controls).
    - Convert qualifying pointer taps into a “placement intent” event.
    - Let ECS Systems handle job creation/progression.
  - In `onPostUpdate`:
    - Throttle/publish UI snapshots from ECS state (event-driven where possible).

## ECS state + event-driven transitions

To stay aligned with Excalibur’s built-in ECS:

- “Game state” lives in ECS Components attached to:
  - bee `Actor` entities (bee state components)
  - cell entities (cell state components)
  - job entities (job state components)
  - a single colony controller entity (resources + global timers)
- “Decisions” happen in ECS Systems driven by ECS Queries (ex: “all available workers”).

Event-driven policy (reduce unnecessary work):

- Create/open jobs via events (placement click -> open `BuildJob` entity).
- **Dirty flags / change detection:** ECS systems still run each frame in Excalibur, so expensive work runs only when relevant components are dirty (examples: `NeedsAssignment`, `PathTargetChanged`, `AdultNeedsChanged`, `NectarCellFull`, `HoneyProcessingInterrupted`). Set dirty on events; clear after reconcile. Avoid scanning all cells/bees every frame.
- Systems reconcile when:
  - a job is created/opened
  - a bee becomes available/changes job
  - a timer completes for a relevant component (build finished, brood stage changed, etc.)
  - a dirty flag is set
- When systems advance a stage, they publish a transition event (ex: `CellBuilt`, `BroodLarvaeReady`), which triggers follow-up job creation without scanning all cells every frame.
- When the player requests a level scroll:
  - emit `LevelChangeRequested(nextLevel)`
  - `LevelTransitionSystem` controls the transition timeline and emits `LevelChanged(level)` when complete.

## Job assignment / task switching rules

High-level policies:

- Only bees in `availability='available'` can be assigned.
- `JobAssignmentSystem` selects jobs by priority and reserves only enough available worker Actors to satisfy `beesNeeded`.
- Task switching:
  - A busy worker can preempt only if a higher-priority job exists (ex: `feedLarvae` outranks `forage`, `defend` outranks everything while intruders are present).
  - Switching cancels reservation on the old job entity and reserves the new job entity (to avoid oversubscription).

## Core systems (event-driven ECS)

### Tick entry (inside `MyLevel.onPreUpdate`)

- Minimal:
  - **Pan:** on pointer move with button/touch down on the **main game surface** (not the right-side level strip), accumulate delta and move the camera; on pointer up, if movement exceeded a small threshold, treat as pan and **do not** emit `PlacementIntent`.
  - **Place:** on pointer up with movement below threshold (or short tap), convert to `PlacementIntent(coord, activeLevel)` (subject to transition gating).
  - **Level scroll:** interpret right-side drag gestures into `LevelChangeRequested(+1/-1)` events (do not pan the camera from this zone).
  - ECS Systems handle job creation/progression, and `onPostUpdate` throttles UI snapshots when needed.

### Placement -> `BuildJob` (event-driven)

1. On `PlacementIntent(coord)`, validate:
  - the cell is empty
  - at least one neighbor exists and is `built=true`
2. Create a `Cell` entity in `foundation` state.
3. Create a `BuildJob` entity (`buildCell`) with `priority` and `beesNeeded`, targeting `targetCoord`.
4. Emit `CellBuildStarted` so the UI can show “workers building…” for that hex.

### JobAssignmentSystem (queries + reservations)

Triggered when:

- a job entity is created/opened (or its `beesNeeded` changes), or
- a bee transitions to `availability='available'`.

For each open job (highest `priority` first):

1. Compute `stillNeeded = beesNeeded - reservedCount` on the job entity.
2. Choose up to `stillNeeded` closest available worker Actors (fast heuristic: squared distance to job target world position).
3. Reserve them by writing `currentJob` (bee component) and `reservation` refs (job component).
4. Update the **job’s** shared path target; `MovementSystem` assigns each reserved bee the **same** path polyline (or flow) toward the job target so A* runs once per job change, not once per bee.

### BuildSystem (foundation progress + completion event)

- Query cells in `stage='foundation'` (not yet built) and the associated `BuildJob` entity reservations.
- For each job, advance `buildProgress` using:
  - wax consumption rate per active reserved builder
  - only builders within `buildReach` are considered “actively building”
- On completion:
  - mark the cell as `built=true` and `stage='empty'`
  - complete/close the `BuildJob` entity
  - emit `CellBuilt` so UI can open the cell type picker overlay.

### BroodLifecycleSystem (queen eggs + stage progression)

- Queen eggs:
  - On a timer, create `LayEggJob` for the first available `brood` cell in `stage='empty'`.
- Egg -> larvae:
  - When egg timer completes, advance to `stage='larvae'` and emit `BroodLarvaeReady`.
- Larvae feeding:
  - While larvae needs remain, ensure there is a `FeedLarvaeJob` targeting that cell.
  - When needs hit zero, emit `BroodFed` and advance to `stage='sealed'`.
- Sealed -> cleaning -> empty:
  - When sealed/molt timer completes, create `CleanBroodJob`.
  - On completion, advance cell back to `stage='empty'` (and ready for the next egg).

### ForagingSystem (pollen + nectar -> cell deposits)

- Create forage jobs when the colony needs pollen and/or nectar/honey (driven by queued feed jobs or configured demand thresholds).
- For each forage job:
  - bee moves to a forage point, waits `forageDuration`, then sets a carried payload (`pollen` or `nectar`).
  - create a deposit job so the same bee returns and delivers into the target compatible **cell** (pollen cell or nectar cell).
- **Nectar storage (no instant honey):**
  - workers **deposit nectar into nectar/honey cells**; the cell accumulates nectar until a configured capacity is reached (full).
  - **Honey is not created on deposit.** Once a cell is full of nectar, separate `**HoneyProcessingJob`** work (see `HoneyProcessingSystem`) converts nectar in that cell into honey over time.
- Core mechanic for this prototype:
  - forage jobs also yield `water` while the bee is away (simulated as “nearby water access”).
  - on return, water is delivered via a `WaterDeliveryJob` to a subset of thirsty bee entities in the hive (contact/nearby check, no physics collisions).

### HoneyProcessingSystem (full cell -> honey over time)

- When a nectar cell becomes full, create/queue `HoneyProcessingJob` targeting that cell.
- Reserved workers process nectar in the cell into honey over time (progress bar / timer).
- **Abort for adult feeding:** if a hungry adult needs nectar and there is **no other available nectar supply** (no unfilled nectar capacity elsewhere, no colony buffer), workers may **abort processing** and consume nectar from the cell (or redirect nectar) to satisfy hunger—set `HoneyProcessingInterrupted` dirty and re-open assignment when safe.

### AdultCareSystem (hunger + thirst -> happiness)

- Core mechanic:
  - adult feeding priority: **available nectar** (colony buffer or nectar in cells) **before honey**; when nectar is unavailable, use **honey**.
  - workers can **interrupt honey processing** to take nectar from a cell when that is the only nectar source (see `HoneyProcessingSystem`).
  - worker bees forage water and deliver it to thirsty bees via contact.
- ECS components (conceptual):
  - each bee has `HungerComponent`, `ThirstComponent`, and `HappinessComponent` (derived/stored).
  - each bee’s hunger/thirst increase over time and decrease when the bee receives the matching care.
- **Colony happiness aggregation (single rule):**
  - A bee is **happy** if `hunger` and `thirst` are both at or below configured **minimum thresholds** (fed + hydrated enough).
  - `**colonyHappiness` = (number of happy bees / total bees) × 100%**, shown on the HUD. No separate average/worst-case mode in the prototype.
- Event/job flow (event-driven, no per-frame global scans):
  - when a bee crosses a hunger threshold, the system opens an `AdultFeedingJob` that reserves a bee and applies nectar-first / honey-fallback / abort-processing rules
  - when a bee crosses a thirst threshold, it becomes eligible for `WaterDeliveryJob` targeting
  - when care is delivered (deposit/delivery completion event), the target bee’s hunger/thirst are reduced, which affects whether they count as happy
  - if many bees are unhappy/unfed, the job system will naturally prioritize AdultCare jobs, reducing throughput for build/larvae tasks (core “tension” mechanic)

### AdultFeedingPolicy (nectar-first, honey fallback, processing abort)

- When satisfying adult hunger:
  - prefer **nectar** (from colony storage or from nectar cells that are not yet fully processed into honey).
  - if no nectar is available, use **honey**.
  - if the only nectar is **inside a cell undergoing honey processing**, workers may **abort** processing to consume that nectar (per `HoneyProcessingSystem`).

## Hex grid + adjacency rules (concrete defaults)

- Hex orientation: pointy-top.
- Axial coordinates `(q, r)`.
- 6 neighbors: `[(+1,0),(+1,-1),(0,-1),(-1,0),(-1,+1),(0,+1)]`.
- World conversion (hex size `S`):
  - `x = S * sqrt(3) * (q + r/2)`
  - `y = S * 3/2 * r`
- Adjacency rule for placement:
  - Player can place new cell at `coord` only if at least one neighbor cell exists and is `built=true`.

### Multi-level hive rules

- Coordinate becomes `HiveCoord = (q, r, level)`.
- **Stacking alignment:** levels share the **same** axial `(q, r)` grid; there is **no offset or rotation** between levels. Vertical stacking is always `(q, r, L)` vs `(q, r, L±1)`.
- Visible level:
  - only entities where `entity.level === activeLevel` are rendered (cells + bees).
- **Cross-level movement (outer edge only):**
  - a bee may move to an adjacent level **only from an outer-edge cell** on its current level.
  - **Outer edge:** any cell that has **at least one hex neighbor** (same level) **with no built cell**—i.e. the cell is not completely surrounded by six built neighbors.
  - Vertical movement from `(q, r, L)` to `(q, r, L±1)` requires: (1) the cell at `(q, r, L)` is an **outer edge** on level `L`, and (2) a **built cell** exists at the **same `(q, r)`** on the target level (vertical comb connects at that stack coordinate).
- Placement on an empty level:
  - player may begin building on an empty level `L` if **vertical adjacency** to `L-1` or `L+1` holds: **same `(q, r)`** and that coordinate has a **built cell** on the neighboring level.
  - once the first foundation exists on `L`, standard same-level adjacency rules apply.

## Rendering approach (scalable)

- Use a `CellRendererActor` (single actor) to draw:
  - hex outlines
  - placed cells with type/stage visuals
- Bees are `Actor`s (queen + each worker), targeting ~200-400 visible bees in the prototype.
- Performance tactics for hundreds of bee Actors:
  - disable/remove physics/collisions for bees by default; **for defense**, enable colliders **only for intruders + a small defender set** when intruders spawn (temporary “defense mode”).
  - keep per-bee graphics minimal (single sprite/circle, no animations for early prototype)
  - **shared path per job** (see `MovementSystem` + `JobAssignmentSystem`): one A* (or flow) toward the job target per job update; bees follow the shared route; cache path keys include `**level`** and `jobId`.
- If we later hit performance ceilings, we can add an LOD approach (simplified rendering/less update frequency for far-from-camera bees).

### Level switch visual transition (simulate 3D)

- During `LevelChangeRequested`:
  - fade out current level (full-screen overlay alpha 0 -> 1)
  - slight camera zoom in (ex: `zoom 1.0 -> 1.1`)
  - swap `activeLevel`
  - fade in (overlay alpha 1 -> 0)
  - slight camera zoom back (ex: `1.1 -> 1.0`)
- Input gating:
  - disable placement taps while transition is running to avoid accidental builds mid-scroll.
- **Hit testing:** hex placement and hit tests must use **engine screen-to-world** (or equivalent) so pointer-to-hex mapping stays correct while zoom/camera change; do not assume fixed pixel-to-world mapping during transitions.

## React HUD/overlays integration

- Configure the engine so **UI overlays** (level strip, HUD) can receive pointers without the canvas stealing drags meant for those regions (`PointerScope`/layering as appropriate for Excalibur + DOM).
- Add a React root element in `index.html` (or overlay container div).
- Excalibur renders to canvas; React renders to DOM overlay.
- Use a lightweight store:
  - `uiBridge` listens to colony events.
  - UI uses `useSyncExternalStore`-style hook or a small event emitter.
- Overlays:
  - `HudOverlay`: always visible
  - `CellTypePickerOverlay`: appears when a foundation build job completes; player chooses `brood/pollen/nectar`.
  - `HudOverlay` includes `Happiness: <0-100%>` = **percentage of bees who are happy** (both food and water thresholds met).
  - For touch-first: large tappable cards/buttons.

### Touch controls: camera pan (main view)

- **Where:** drags on the **main** game canvas / central area (everything except the dedicated right strip and modal overlays).
- **Behavior:** one- or two-finger drag moves the camera so the world appears to slide under the finger (classic map pan).
- **Implementation notes:**
  - Update camera `pos` (or equivalent) by the drag delta each frame; optional bounds clamp so the view cannot drift infinitely off the hive.
  - Use the same **screen-to-world** pipeline as placement so pan stays correct at any zoom.
  - During `LevelTransitionSystem` active transition, optionally **disable pan** alongside placement, or allow pan only after fade completes (pick one; default: disable both for clarity).

### Touch controls: level scroll (right side)

- Add a right-side vertical “level scroll” interaction zone (React overlay div) that captures touch drags.
- Gesture behavior:
  - drag up -> request `LevelChangeRequested(+1)` (go “up” a level)
  - drag down -> request `LevelChangeRequested(-1)` (go “down” a level)
  - include hysteresis/dead-zone so small drags don’t flip levels accidentally
  - throttle to prevent repeated switches while a transition is still running
- HUD also shows the current level indicator (ex: `Level: 0`, `Level: -1`, etc.).

## UX flow (prototype)

- On game start:
  - queen + 2 workers + pre-seeded cells (1 brood empty, 1 pollen, 1 nectar/honey).
- Player pans the view by dragging on the main area; changes level via the right-side strip.
- Player taps an empty hex adjacent to built cells:
  - show “workers building…” until completion
- When build completes:
  - show cell type picker overlay
  - player selection sets `cell.type`
  - brood cells will get eggs eventually; pollen/nectar cells receive foraging deposits.

## Deliverables (implementation scope)

- Working build loop + brood lifecycle + feeding + cleaning.
- HUD with:
  - `Bees: <queen+workers>`
  - `Pollen: X, Honey: Y` (and nectar-in-cells / processing state as needed for clarity)
  - `Happiness: <0-100%>` = **% of bees happy** (food + water thresholds met)
  - `Brood: <occupied>/<total>`
- React overlay for cell type selection after build.

## Development order

1. Implement grid + placement validation + **camera pan** (drag main view; tap vs pan threshold; pointer scope for canvas vs UI).
2. Implement ECS scaffolding:
  - custom Components for bee/cell/job/resource state
  - register ECS Systems (movement/build/brood skeleton)
3. Implement build loop end-to-end:
  - placement intent -> `BuildJob` + foundation cell
  - `JobAssignmentSystem` reservations
  - `MovementSystem` + `BuildSystem` progression
  - `CellBuilt` event -> UI type picker overlay
4. Implement multi-level hive basics:
  - `activeLevel` state + rendering only active level
  - right-side drag gesture -> `LevelChangeRequested`
  - fade + zoom transition timeline
  - hide bee Actors when off-level; allow bees to move between levels
  - placement rules for starting on an empty adjacent level
5. Implement cell type assignment (brood/pollen/nectar/honey) to unlock brood/forage behaviors.
6. Implement queen eggs + brood lifecycle (egg -> larvae -> sealed -> cleaning -> empty).
7. Implement feeding jobs (worker carry + deposit pollen/honey into larvae).
8. Implement cleaning jobs -> return workers to `available`.
9. Implement adult care + happiness loop:
  - nectar-first (honey fallback); abort honey processing to consume cell nectar when no other nectar exists
  - water foraging + delivery to thirsty bees
  - happiness = % of bees meeting min food + water thresholds; tunable rates to avoid death spirals
10. Implement foraging + nectar cells + honey processing (deposit nectar → full cell → process to honey; not on deposit).
11. Add React HUD + overlays driven by throttled ECS->UI snapshots/events.
12. Add defend job + intruder spawning (optional for “core fun” gating).

## Open questions (impacting mechanics)

- Where do water sources live in the world/grid for early prototype (single fixed “water node” outside the hive vs multiple forageable water hexes), and should water be scarce/limited?  
  - Decision: multiple foragable water locations
- What is the intended cap and bounds for levels in the prototype (ex: `-2..+2`), and do we allow infinite scrolling with procedural empty levels?
  - Decision: initially capped to +/- 2 levels.
- **Resolved:** `colonyHappiness` = percentage of bees that are happy (min thresholds for food and water). **Resolved:** multi-level stacking uses same `(q,r)` only; cross-level moves only from outer-edge cells. **Resolved:** nectar → honey only after cell is full and processing jobs run; adults can abort processing to eat nectar when no other supply exists.

## Notes on realism vs prototype

- Pathfinding uses hex grid centers for planning, but movement can be straight-line between centers to keep it cheap and pleasant.
- Nectar is deposited into cells; honey appears only after **processing** a full nectar cell, not on deposit.
- **Happiness tuning:** keep hunger/thirst rise rates and recovery rates configurable so the colony can recover from low happiness (avoid irrecoverable failure spirals in the prototype).
- For performance with hundreds of bee Actors:
  - **shared path per job**; recompute only when job target or connectivity changes
  - path cache keys include `level` and `jobId`

