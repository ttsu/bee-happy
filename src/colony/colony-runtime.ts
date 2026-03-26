import type { Engine } from "excalibur";
import { Entity, type Scene } from "excalibur";
import { hexToWorld } from "../grid/hex-grid";
import type { HexCoord } from "../grid/hex-grid";
import { hiveKey } from "../grid/hive-levels";
import type { HiveCoord } from "../grid/hive-levels";
import { BeeActor } from "../render/bee-actor";
import { COLONY } from "./constants";
import { ColonyEventBus, type ColonyUiSnapshot } from "./events/colony-events";
import {
  ActiveLevelComponent,
  BeeAgeComponent,
  BeeLevelComponent,
  BeeNeedsComponent,
  BeeRoleComponent,
  CellCoordComponent,
  CellStateComponent,
  ColonyResourcesComponent,
  ColonyTimeComponent,
  JobComponent,
  QueenTimerComponent,
  type BeeRole,
} from "./ecs/components/colony-components";
import { canPlaceFoundation } from "./placement";
import { JobPriority } from "./job-priority";
import { AdultCareSystem } from "./ecs/systems/adult-care-system";
import { BroodSystem } from "./ecs/systems/brood-system";
import { BuildSystem } from "./ecs/systems/build-system";
import { EconomySystem } from "./ecs/systems/economy-system";
import { IdleWanderSystem } from "./ecs/systems/idle-wander-system";
import { JobAssignmentSystem } from "./ecs/systems/job-assignment-system";
import { LevelSystem } from "./ecs/systems/level-system";
import { MovementSystem } from "./ecs/systems/movement-system";
import { WorkerLifecycleSystem } from "./ecs/systems/worker-lifecycle-system";
import { GuardSystem } from "./ecs/systems/guard-system";

/**
 * Central registry and helpers for hive cells, jobs, and colony controller ECS entities.
 */
export class ColonyRuntime {
  readonly events = new ColonyEventBus();
  readonly cellsByKey = new Map<string, Entity>();
  controllerEntity!: Entity;
  scene!: Scene;
  engine!: Engine;
  pendingCellTypeKey: string | null = null;
  lastUiEmit = 0;
  /** 0–1 full-screen fade during level transitions (for React overlay). */
  transitionOverlay = 0;
  /** Debug touch mapping details for on-screen diagnostics. */
  debugTouch = "waiting for touch";

  initialize(scene: Scene, engine: Engine): void {
    this.scene = scene;
    this.engine = engine;
    const world = scene.world;

    this.controllerEntity = new Entity({
      name: "colony-controller",
      components: [
        new ActiveLevelComponent(),
        new ColonyResourcesComponent(),
        new QueenTimerComponent(),
        new ColonyTimeComponent(),
      ],
    });
    this.controllerEntity.addTag("colonyController");
    world.add(this.controllerEntity);

    const res = this.controllerEntity.get(ColonyResourcesComponent)!;
    res.wax = COLONY.initialWax;
    res.colonyNectar = COLONY.initialColonyNectar;

    this.controllerEntity.get(QueenTimerComponent)!.layCooldownMs = 3500;

    this.seedLevelZero();

    world.add(new LevelSystem(world, this));
    world.add(new WorkerLifecycleSystem(world, this));
    world.add(new JobAssignmentSystem(world, this));
    world.add(new MovementSystem(world, this));
    world.add(new IdleWanderSystem(world, this));
    world.add(new BuildSystem(world, this));
    world.add(new BroodSystem(world, this));
    world.add(new EconomySystem(world, this));
    world.add(new AdultCareSystem(world, this));
    world.add(new GuardSystem(world, this));
  }

  get resources(): ColonyResourcesComponent {
    return this.controllerEntity.get(ColonyResourcesComponent)!;
  }

  /**
   * Sums pollen across all built pollen storage cells (HUD and economy demand checks).
   */
  sumPollenStored(): number {
    let total = 0;
    for (const [, e] of this.cellsByKey) {
      const st = e.get(CellStateComponent)!;
      if (st.built && st.cellType === "pollen") {
        total += st.pollenStored;
      }
    }
    return total;
  }

  /** Total honey across built nectar cells (HUD). */
  sumHoneyStored(): number {
    let total = 0;
    for (const [, e] of this.cellsByKey) {
      const st = e.get(CellStateComponent)!;
      if (st.built && st.cellType === "nectar") {
        total += st.honeyStored;
      }
    }
    return total;
  }

  get activeLevel(): number {
    return this.controllerEntity.get(ActiveLevelComponent)!.activeLevel;
  }

  builtByLevel(): Map<number, Set<string>> {
    const m = new Map<number, Set<string>>();
    for (const [, ent] of this.cellsByKey) {
      const coord = ent.get(CellCoordComponent)!;
      const st = ent.get(CellStateComponent)!;
      if (!st.built) {
        continue;
      }
      const set = m.get(coord.level) ?? new Set<string>();
      set.add(`${coord.q},${coord.r}`);
      m.set(coord.level, set);
    }
    return m;
  }

  getCellAt(key: string): Entity | undefined {
    return this.cellsByKey.get(key);
  }

  spawnBee(role: BeeRole, level: number, hex: HexCoord): BeeActor {
    const pos = hexToWorld(hex, COLONY.hexSize);
    const bee = new BeeActor(role, pos);
    bee.addComponent(new BeeLevelComponent(level));
    this.scene.add(bee);
    return bee;
  }

  /**
   * Spawns a worker that eclosed from a brood cell and pushes an immediate HUD update.
   */
  spawnEmergingWorker(level: number, hex: HexCoord): BeeActor {
    const bee = this.spawnBee("worker", level, hex);
    this.emitUiSnapshotImmediate();
    return bee;
  }

  createCellEntity(coord: HiveCoord, state: Partial<CellStateComponent>): Entity {
    const key = hiveKey(coord);
    const ent = new Entity({
      name: `cell-${key}`,
      components: [
        new CellCoordComponent(coord.q, coord.r, coord.level),
        Object.assign(new CellStateComponent(), state),
      ],
    });
    ent.addTag("cell");
    this.cellsByKey.set(key, ent);
    this.scene.world.add(ent);
    return ent;
  }

  createJob(job: JobComponent): Entity {
    const ent = new Entity({ name: `job-${job.kind}`, components: [job] });
    ent.addTag("job");
    this.scene.world.add(ent);
    return ent;
  }

  /**
   * Handles a tap on the hive: assign type for a finished empty cell, or place a new foundation.
   */
  handleTapIntent(coord: HiveCoord): void {
    const active = this.controllerEntity.get(ActiveLevelComponent)!;
    if (active.transition !== "idle") {
      return;
    }
    if (coord.level !== active.activeLevel) {
      return;
    }
    const key = hiveKey(coord);
    const existing = this.cellsByKey.get(key);
    if (existing) {
      const st = existing.get(CellStateComponent)!;
      if (st.built && st.cellType === "none") {
        this.pendingCellTypeKey = key;
        this.emitUiSnapshotImmediate();
        return;
      }
    }
    this.handlePlacementIntent(coord);
  }

  handlePlacementIntent(coord: HiveCoord): void {
    const active = this.controllerEntity.get(ActiveLevelComponent)!;
    if (active.transition !== "idle") {
      return;
    }
    if (coord.level !== active.activeLevel) {
      return;
    }
    const lookup = {
      has: (k: string) => this.cellsByKey.has(k),
      getBuilt: (k: string) => this.cellsByKey.get(k)?.get(CellStateComponent),
    };
    if (!canPlaceFoundation(coord, lookup)) {
      return;
    }
    const key = hiveKey(coord);
    this.createCellEntity(coord, {
      built: false,
      stage: "foundation",
      buildProgress: 0,
      cellType: "none",
    });
    this.events.emit({ type: "CellBuildStarted", cellKey: key });
    const job = new JobComponent(
      "buildCell",
      JobPriority.build,
      coord.q,
      coord.r,
      coord.level,
      1,
    );
    this.createJob(job);
  }

  assignCellType(cellKey: string, cellType: "brood" | "pollen" | "nectar"): void {
    const ent = this.cellsByKey.get(cellKey);
    if (!ent) {
      return;
    }
    const st = ent.get(CellStateComponent)!;
    st.cellType = cellType;
    st.stage = "empty";
    this.pendingCellTypeKey = null;
    this.emitUiSnapshotImmediate();
  }

  /** Pushes the latest HUD snapshot to subscribers without waiting for the frame throttle. */
  private emitUiSnapshotImmediate(): void {
    this.events.emit({ type: "ColonySnapshot", snapshot: this.getUiSnapshot() });
  }

  getUiSnapshot(): ColonyUiSnapshot {
    const res = this.resources;
    let workers = 0;
    let queens = 0;
    for (const a of this.scene.actors) {
      const br = a.get(BeeRoleComponent);
      if (!br) {
        continue;
      }
      if (br.role === "queen") {
        queens += 1;
      } else {
        workers += 1;
      }
    }
    let happy = 0;
    let totalNeeds = 0;
    for (const a of this.scene.actors) {
      const n = a.get(BeeNeedsComponent);
      if (!n) {
        continue;
      }
      totalNeeds += 1;
      if (n.hunger <= COLONY.happyHungerMax && n.thirst <= COLONY.happyThirstMax) {
        happy += 1;
      }
    }
    let broodOccupied = 0;
    let broodTotal = 0;
    for (const [, e] of this.cellsByKey) {
      const st = e.get(CellStateComponent)!;
      if (st.cellType !== "brood" || !st.built) {
        continue;
      }
      broodTotal += 1;
      if (
        st.stage === "egg" ||
        st.stage === "larvae" ||
        st.stage === "sealed" ||
        st.stage === "cleaning"
      ) {
        broodOccupied += 1;
      }
    }
    const time = this.controllerEntity.get(ColonyTimeComponent)!;
    const msPerBeeDay = COLONY.workerLifespanMs / 50;
    const currentColonyDay = Math.floor(time.colonyElapsedMs / msPerBeeDay) + 1;
    return {
      beesTotal: workers + queens,
      workers,
      queens,
      pollen: this.sumPollenStored(),
      honey: this.sumHoneyStored(),
      colonyNectar: res.colonyNectar,
      happinessPct: Math.min(
        100,
        Math.max(0, totalNeeds > 0 ? Math.round((happy / totalNeeds) * 100) : 100),
      ),
      broodOccupied,
      broodTotal,
      activeLevel: this.activeLevel,
      wax: res.wax,
      transitionOverlay: this.transitionOverlay,
      pendingCellTypeKey: this.pendingCellTypeKey,
      currentColonyDay,
      debugTouch: this.debugTouch,
    };
  }

  requestLevelChange(delta: 1 | -1): void {
    const ctrl = this.controllerEntity.get(ActiveLevelComponent)!;
    if (ctrl.transition !== "idle") {
      return;
    }
    const next = ctrl.activeLevel + delta;
    if (next < -2 || next > 2) {
      return;
    }
    ctrl.pendingLevel = next;
    ctrl.transition = "fadeOut";
    ctrl.transitionT = 0;
    this.events.emit({
      type: "LevelChangeStarted",
      from: ctrl.activeLevel,
      to: next,
    });
  }

  private seedLevelZero(): void {
    const seeds: { coord: HiveCoord; type: "brood" | "pollen" | "nectar" }[] = [
      { coord: { q: 0, r: 0, level: 0 }, type: "brood" },
      { coord: { q: 1, r: 0, level: 0 }, type: "pollen" },
      { coord: { q: -1, r: 0, level: 0 }, type: "nectar" },
    ];
    for (const s of seeds) {
      this.createCellEntity(s.coord, {
        built: true,
        stage: "empty",
        buildProgress: 1,
        cellType: s.type,
        ...(s.type === "pollen" ? { pollenStored: COLONY.initialPollen } : {}),
        ...(s.type === "nectar"
          ? {
              nectarStored: Math.min(COLONY.nectarCellCapacity, 8),
              honeyStored: 0,
            }
          : {}),
      });
    }
    this.spawnBee("queen", 0, { q: 0, r: 0 });
    const msPerDay = COLONY.workerLifespanMs / 50;
    const spread =
      COLONY.bootstrapWorkerAgeMaxDays - COLONY.bootstrapWorkerAgeMinDays + 1;
    for (const hex of [
      { q: 0, r: 1 },
      { q: 1, r: -1 },
    ] as const) {
      const w = this.spawnBee("worker", 0, hex);
      const dayRoll =
        COLONY.bootstrapWorkerAgeMinDays + Math.floor(Math.random() * spread);
      w.get(BeeAgeComponent)!.ageMs = (dayRoll - 1) * msPerDay;
    }
  }
}
