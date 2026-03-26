# Jobs system — master plan

## Purpose

This document is the **source of truth** for colony job kinds, **which role** performs each job, **assignment priority**, and **step-by-step job flows** as implemented or intended in code.

**Living document:** When you change `JobComponent`, `JobPriority`, assignment, or job-related systems, update this file in the same change. **Priority, role, movement, and completing system are defined only in [Job registry](#job-registry)**—do not repeat those fields in flow sections.

## How assignment works (shared)

| Mechanism | Location |
|-----------|----------|
| Job entities tagged `job`, sorted by priority | `src/colony/ecs/systems/job-assignment-system.ts` |
| Priority constants | `src/colony/job-priority.ts` |
| Role ↔ job kind rules | `src/colony/ecs/job-eligibility.ts` |
| Hex paths for most site jobs | `findHexPathWorldPoints` via `JobAssignmentSystem` |
| Movement along paths or special cases | `src/colony/ecs/systems/movement-system.ts` |
| Domain completion (build, brood, economy, care) | `build-system`, `brood-system`, `economy-system`, `adult-care-system` |

**Assignment rules:**

1. Non-done jobs are sorted by **priority** (higher number first). Values and keys live only in [Job registry](#job-registry) (mirrors `job-priority.ts`).
2. **Queen** may be assigned only to **`layEgg`**. **Workers** may be assigned to every other `JobKind`.
3. A bee must have **`BeeWorkComponent.availability === "available"`** and **`currentJobEntityId === null`** to be reserved.
4. For each job, the nearest eligible bee to the job’s target world position is chosen (see `JobAssignmentSystem`).

There is **no** separate per-role priority table in code—one global ordering.

---

## Job registry

**Update this table when priorities or ownership change.** The `JobPriority` key is the property name in `src/colony/job-priority.ts` (the `build` key maps to `buildCell` jobs).

| Job kind | `JobPriority` key | Value | Role | Movement | Completing system | Notes |
|----------|-------------------|-------|------|----------|-------------------|-------|
| `adultFeed` | `adultFeed` | 95 | worker | Chase target bee | `AdultCareSystem` | Spawn: hunger threshold; no duplicate per target id |
| `waterDeliver` | `waterDeliver` | 90 | worker | Chase target bee | `AdultCareSystem` | Spawn: thirst threshold; no duplicate per target id |
| `feedLarvae` | `feedLarvae` | 85 | worker | Hex path | `BroodSystem` | Spawn: larvae need food, pollen gate, one job per cell |
| `cleanBrood` | `cleanBrood` | 80 | worker | Hex path | `BroodSystem` | Spawn: after emerge from sealed; one job per cell |
| `layEgg` | `layEgg` | 75 | queen | Hex path (intended) | TBD | **Not spawned.** Eligibility/UI only; brood uses `QueenTimerComponent` + `BroodSystem` timer |
| `buildCell` | `build` | 65 | worker | Hex path | `BuildSystem` | Spawn: `ColonyRuntime.handlePlacementIntent` |
| `honeyProcess` | `honeyProcess` | 55 | worker | Hex path | `EconomySystem` | Spawn: full nectar cell; `AdultCareSystem` can interrupt |
| `foragePollen` | `foragePollen` | 45 | worker | Economy direct | `EconomySystem` | Spawn: low pollen; `MovementSystem` skips path |
| `forageNectar` | `forageNectar` | 44 | worker | Economy direct | `EconomySystem` | Spawn: low colony nectar; path skipped |
| `forageWater` | `forageWater` | 43 | worker | Economy direct | `EconomySystem` | **Not spawned**; handler exists if job created; path skipped |
| `depositPollen` | — | — | worker | TBD | TBD | Types/UI only; add key to `job-priority.ts` when implemented |
| `depositNectar` | — | — | worker | TBD | TBD | Same |
| `depositWater` | — | — | worker | TBD | TBD | Same |

---

## Flows

Step-by-step behavior only. **Do not restate priority or role here**—use [Job registry](#job-registry).

### `layEgg` (target behavior if wired to jobs)

1. Create job with `beesNeeded: 1`, target brood cell (or queen anchor), status `open`.
2. `JobAssignmentSystem` reserves the **queen**; build **hex path** to target (same pattern as workers unless special-cased).
3. `MovementSystem` moves queen along path; align level to `targetLevel`.
4. On success at cell (proximity + empty brood), set cell to `egg`, start egg timer, mark job `done`, release queen, remove job entity.

**Maintenance:** Either implement this flow or keep timer-only brood and treat `layEgg` as reserved for future use or removal.

---

### `buildCell`

1. User places foundation → `JobComponent("buildCell", …)` for that hex and level.
2. Nearest worker reserved; **hex `pathPoints`** from bee to goal.
3. Worker follows `MovementSystem` until last segment; level synced toward job target.
4. `BuildSystem`: worker counts as builder when at **path end** and within **`COLONY.buildWorkRadiusPx`** of cell center; wax consumed; `buildProgress` increases.
5. When `buildProgress >= 1`: cell `built`, job `done`, bees released, job entity removed.

---

### `feedLarvae`

1. Job targets brood cell `q,r,level` with hungry larvae.
2. Worker reserved; **hex path** to cell.
3. When reserved bee within **~45px** of cell center (`processFeedJobs`), consume **pollen** or **honey** from colony resources, reduce `larvaeFoodRemaining`.
4. If larvae fully fed → stage `sealed`, timers set, events emitted; job `done`, release, job entity killed.

---

### `cleanBrood`

1. Cell in `cleaning` with `cleaningTimerMs` > 0.
2. Worker paths to cell.
3. While job active, each reserved bee **within ~40px** of center accelerates timer depletion.
4. When timer ≤ 0: cell `empty`; matching `cleanBrood` jobs `done`, released, entities killed.

---

### `foragePollen` / `forageNectar` / `forageWater`

1. Job created with target storage cell coords; `foragePhase = "outbound"`, `scratchX/Y` as off-hive target.
2. Assignment clears **`pathPoints`**; bee is **not** moved by hex path system.
3. **outbound:** Bee moves toward `scratch` until close → **wait**.
4. **wait:** `forageWaitMs` counts down → **return**, `carryPayload` set by kind.
5. **return:** Bee moves to deposit world position; on arrival apply **pollen** to colony or **nectar** to cell storage; job `done`, release, job entity killed.

---

### `honeyProcess`

1. Worker paths to full nectar cell.
2. `updateHoney`: bee within **50px** of center; if cell not dirty, advance `honeyProcessingProgress`; at completion convert nectar to honey, reset cell flags, job `done`.
3. If **`honeyProcessingDirty`** (e.g. nectar taken for adult feeding), honey job ends early without full conversion.

---

### `adultFeed`

1. Job has `adultFeedTargetBeeId` set to hungry bee.
2. **`pathPoints` empty**; worker **steers toward target actor** in `MovementSystem`.
3. When worker within **38px** of target, consume **colony nectar** / **cell nectar** / **honey** or trigger honey-process interrupt; reduce target hunger; job `done`, entity killed.

---

### `waterDeliver`

1. Same targeting as `adultFeed` (`adultFeedTargetBeeId` = thirsty bee).
2. Worker chases target; within **38px**, reduce thirst; job `done` (no resource spend in current code).

---

### `depositPollen` / `depositNectar` / `depositWater`

**Intended direction (when implemented):** Optional phase after forage carry: path to storage cell, apply to cell or pool, complete. Add `JobPriority` keys and rows to [Job registry](#job-registry); mirror patterns from `feedLarvae` / economy. Current foraging deposits through `updateForage` without separate deposit jobs.

---

## Changelog

| Date | Change |
|------|--------|
| 2025-03-26 | Initial master plan authored from current codebase. |
| 2025-03-26 | Normalized: single [Job registry](#job-registry) for priority, role, movement, systems, and spawn notes; flows are steps only. |

When you make a behavior change, add a row here with date and a short note.
