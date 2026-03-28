import type { Engine } from "excalibur";
import { Entity, type Scene } from "excalibur";
import { hexToWorld, worldToHex } from "../grid/hex-grid";
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
  YearlyStatsComponent,
  type BeeRole,
} from "./ecs/components/colony-components";
import { canRelocateCellContentsForRetype } from "./cell-retype-capacity";
import { CellRetypeSystem } from "./ecs/systems/cell-retype-system";
import { canPlaceFoundation, eligibleFoundationCoordsForLevel } from "./placement";
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
import { SeasonSystem } from "./ecs/systems/season-system";
import { getSeasonForColonyDay } from "./seasons";

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
  /** Last validation error for {@link requestCellTypeChange} (shown in the picker). */
  cellTypeChangeError: string | null = null;
  /** Hive key under the pointer for hover outline (see {@link updateHoverFromPointer}). */
  hoverHiveKey: string | null = null;
  lastUiEmit = 0;
  /** 0–1 full-screen fade during level transitions (for React overlay). */
  transitionOverlay = 0;

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
        new YearlyStatsComponent(),
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
    world.add(new SeasonSystem(world, this));
    world.add(new JobAssignmentSystem(world, this));
    world.add(new MovementSystem(world, this));
    world.add(new IdleWanderSystem(world, this));
    world.add(new BuildSystem(world, this));
    world.add(new BroodSystem(world, this));
    world.add(new CellRetypeSystem(world, this));
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

  /**
   * Updates {@link hoverHiveKey} from the primary pointer. Cleared while panning,
   * during level transitions, or when the cursor is not over a hive cell or build-eligible hex.
   */
  updateHoverFromPointer(): void {
    const active = this.controllerEntity.get(ActiveLevelComponent)!;
    if (active.transition !== "idle") {
      this.hoverHiveKey = null;
      return;
    }
    if (this.engine.input.pointers.isDown(0)) {
      this.hoverHiveKey = null;
      return;
    }
    const ptr = this.engine.input.pointers.primary;
    const w = this.engine.screen.pageToWorldCoordinates(ptr.lastPagePos);
    const h = worldToHex(w, COLONY.hexSize);
    const coord: HiveCoord = { q: h.q, r: h.r, level: this.activeLevel };
    const key = hiveKey(coord);
    if (this.cellsByKey.has(key)) {
      this.hoverHiveKey = key;
      return;
    }
    const lookup = {
      has: (k: string) => this.cellsByKey.has(k),
      getBuilt: (k: string) => this.cellsByKey.get(k)?.get(CellStateComponent),
    };
    const builtCoords: HiveCoord[] = [];
    for (const [, ent] of this.cellsByKey) {
      const c = ent.get(CellCoordComponent)!;
      const st = ent.get(CellStateComponent)!;
      if (st.built) {
        builtCoords.push({ q: c.q, r: c.r, level: c.level });
      }
    }
    const eligible = eligibleFoundationCoordsForLevel(
      this.activeLevel,
      lookup,
      builtCoords,
    );
    const eligibleKeys = new Set(eligible.map((c) => hiveKey(c)));
    this.hoverHiveKey = eligibleKeys.has(key) ? key : null;
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
    const yearly = this.controllerEntity.get(YearlyStatsComponent);
    if (yearly) {
      yearly.beesHatchedTotal += 1;
    }
    this.emitUiSnapshotImmediate();
    return bee;
  }

  /**
   * Whether the end-of-year review is open and simulation should not advance.
   */
  isSimulationPaused(): boolean {
    return this.controllerEntity.get(YearlyStatsComponent)?.isYearReviewOpen ?? false;
  }

  /**
   * Closes the year review, increments the calendar year, and resets yearly counters.
   */
  continueToNextYear(): void {
    const yearly = this.controllerEntity.get(YearlyStatsComponent);
    if (!yearly?.isYearReviewOpen) {
      return;
    }
    yearly.isYearReviewOpen = false;
    yearly.yearNumber += 1;
    yearly.honeyProcessedTotal = 0;
    yearly.nectarCollectedTotal = 0;
    yearly.pollenCollectedTotal = 0;
    yearly.beesHatchedTotal = 0;
    yearly.happyBeeSecondsTotal = 0;
    yearly.remainingBeesAtYearEnd = 0;
    this.emitUiSnapshotImmediate();
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
        this.cellTypeChangeError = null;
        this.emitUiSnapshotImmediate();
        return;
      }
      if (st.built && st.cellType !== "none") {
        this.pendingCellTypeKey = key;
        this.cellTypeChangeError = null;
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

  /**
   * Applies a new cell type and resets incompatible state (inventory, brood timers).
   */
  applyResolvedCellType(cellKey: string, newType: "brood" | "pollen" | "nectar"): void {
    const ent = this.cellsByKey.get(cellKey);
    if (!ent) {
      return;
    }
    const st = ent.get(CellStateComponent)!;
    st.cellType = newType;
    st.stage = "empty";
    st.pendingCellType = null;
    st.pollenStored = 0;
    st.nectarStored = 0;
    st.honeyStored = 0;
    st.honeyProcessingProgress = 0;
    st.honeyProcessingDirty = false;
    st.eggTimerMs = 0;
    st.sealedTimerMs = 0;
    st.cleaningTimerMs = 0;
    st.larvaePollenRemaining = 0;
    st.larvaeNectarRemaining = 0;
  }

  /**
   * After brood cleaning finishes, applies {@link CellStateComponent.pendingCellType} if set.
   */
  applyPendingBroodRetypeIfAny(cellKey: string): void {
    const ent = this.cellsByKey.get(cellKey);
    if (!ent) {
      return;
    }
    const st = ent.get(CellStateComponent)!;
    if (st.cellType !== "brood" || st.stage !== "empty") {
      return;
    }
    const pending = st.pendingCellType;
    if (!pending) {
      return;
    }
    this.applyResolvedCellType(cellKey, pending);
  }

  private hasOpenJobAtCell(cellKey: string, kind: JobComponent["kind"]): boolean {
    for (const e of this.scene.world.entities) {
      const j = e.get(JobComponent);
      if (!j || j.kind !== kind || j.status === "done") {
        continue;
      }
      const k = hiveKey({
        q: j.targetQ,
        r: j.targetR,
        level: j.targetLevel,
      });
      if (k === cellKey) {
        return true;
      }
    }
    return false;
  }

  private cellHasHoneyProcessJob(coord: CellCoordComponent): boolean {
    return this.hasOpenJobAtCell(
      hiveKey({ q: coord.q, r: coord.r, level: coord.level }),
      "honeyProcess",
    );
  }

  /**
   * Validates rules from the cell-type picker and applies, defers, or enqueues relocation.
   */
  requestCellTypeChange(cellKey: string, targetType: "brood" | "pollen" | "nectar"): void {
    this.cellTypeChangeError = null;
    const ent = this.cellsByKey.get(cellKey);
    if (!ent) {
      return;
    }
    const st = ent.get(CellStateComponent)!;
    const coord = ent.get(CellCoordComponent)!;

    if (!st.built) {
      this.cellTypeChangeError = "Cell is not built yet.";
      this.emitUiSnapshotImmediate();
      return;
    }

    if (st.cellType === targetType && !st.pendingCellType) {
      this.pendingCellTypeKey = null;
      this.emitUiSnapshotImmediate();
      return;
    }

    if (this.hasOpenJobAtCell(cellKey, "clearCellForRetype")) {
      this.cellTypeChangeError = "This cell is already being emptied for a type change.";
      this.emitUiSnapshotImmediate();
      return;
    }

    const broodBlocked =
      st.cellType === "brood" &&
      (st.stage === "egg" ||
        st.stage === "larvae" ||
        st.stage === "sealed" ||
        st.stage === "cleaning");

    if (broodBlocked) {
      st.pendingCellType = targetType;
      this.pendingCellTypeKey = null;
      this.emitUiSnapshotImmediate();
      return;
    }

    if (st.cellType === "brood" && st.stage === "empty") {
      this.applyResolvedCellType(cellKey, targetType);
      this.pendingCellTypeKey = null;
      this.emitUiSnapshotImmediate();
      return;
    }

    if (this.cellHasHoneyProcessJob(coord)) {
      this.cellTypeChangeError = "Wait for honey processing to finish on this cell.";
      this.emitUiSnapshotImmediate();
      return;
    }

    if (st.honeyProcessingProgress > 0) {
      this.cellTypeChangeError = "Wait for honey processing to finish on this cell.";
      this.emitUiSnapshotImmediate();
      return;
    }

    const needsRelocate =
      (st.cellType === "pollen" && st.pollenStored > 0) ||
      (st.cellType === "nectar" && (st.nectarStored > 0 || st.honeyStored > 0));

    if (needsRelocate) {
      if (!canRelocateCellContentsForRetype(this, cellKey, coord.level, st)) {
        this.cellTypeChangeError =
          "Not enough free storage elsewhere on this level to move the contents.";
        this.emitUiSnapshotImmediate();
        return;
      }
      st.pendingCellType = targetType;
      const job = new JobComponent(
        "clearCellForRetype",
        JobPriority.clearCellForRetype,
        coord.q,
        coord.r,
        coord.level,
        1,
      );
      this.createJob(job);
      this.pendingCellTypeKey = null;
      this.emitUiSnapshotImmediate();
      return;
    }

    this.applyResolvedCellType(cellKey, targetType);
    this.pendingCellTypeKey = null;
    this.emitUiSnapshotImmediate();
  }

  /**
   * Closes the cell-type picker without changing types.
   */
  dismissCellTypePicker(): void {
    this.pendingCellTypeKey = null;
    this.cellTypeChangeError = null;
    this.emitUiSnapshotImmediate();
  }

  /** Pushes the latest HUD snapshot to subscribers without waiting for the frame throttle. */
  emitUiSnapshotImmediate(): void {
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
    const yearly = this.controllerEntity.get(YearlyStatsComponent)!;
    const msPerBeeDay = COLONY.workerLifespanMs / 50;
    const currentColonyDay = Math.floor(time.colonyElapsedMs / msPerBeeDay) + 1;
    const { season: currentColonySeason } = getSeasonForColonyDay(currentColonyDay);
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
      cellTypeChangeError: this.cellTypeChangeError,
      currentColonyDay,
      currentColonySeason,
      yearNumber: yearly.yearNumber,
      isYearReviewOpen: yearly.isYearReviewOpen,
      yearlyReviewStats: {
        honeyProcessedTotal: yearly.honeyProcessedTotal,
        nectarCollectedTotal: yearly.nectarCollectedTotal,
        pollenCollectedTotal: yearly.pollenCollectedTotal,
        beesHatchedTotal: yearly.beesHatchedTotal,
        remainingBees: yearly.remainingBeesAtYearEnd,
        happyBeeSecondsTotal: yearly.happyBeeSecondsTotal,
      },
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
