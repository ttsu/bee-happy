import type { Engine } from "excalibur";
import { Entity, vec, type Scene } from "excalibur";
import { hexToWorld, worldToHex } from "../grid/hex-grid";
import type { HexCoord } from "../grid/hex-grid";
import { hiveKey, parseHiveKey } from "../grid/hive-levels";
import type { HiveCoord } from "../grid/hive-levels";
import { BeeActor } from "../render/bee-actor";
import { refreshActiveColonyConstantsFromMeta } from "./colony-active-constants";
import { ColonyEventBus, type ColonyUiSnapshot } from "./events/colony-events";
import {
  ActiveLevelComponent,
  BeeLevelComponent,
  CellCoordComponent,
  CellStateComponent,
  ColonyTimeComponent,
  HoneyRunComponent,
  JobComponent,
  QueenTimerComponent,
  YearlyStatsComponent,
  type BeeRole,
} from "./ecs/components/colony-components";
import type { LineageEntry, SuccessionReason } from "./meta/meta-progress";
import { buildColonyUiSnapshot } from "./colony-ui-snapshot";
import { seedLevelZero as seedLevelZeroColony } from "./colony-seed";
import {
  applySuccessionChoice as applySuccessionChoiceToColony,
  debugOpenSuccessionOptional as debugOpenSuccessionOptionalImpl,
  dismissSuccessionModal as dismissSuccessionModalImpl,
  requestOptionalSuccession as requestOptionalSuccessionImpl,
  resetWorldAfterSuccession as resetWorldAfterSuccessionImpl,
  triggerMandatorySuccession as triggerMandatorySuccessionImpl,
} from "./colony-succession";
import { getActiveColonyConstants } from "./colony-active-constants";
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
import type { SeasonSystemSave } from "./ecs/systems/season-system";
import { SeasonSystem } from "./ecs/systems/season-system";

/**
 * Central registry and helpers for hive cells, jobs, and colony controller ECS entities.
 */
export type ColonyInitializeOptions = {
  /** Default: seed level 0 and spawn bees. Skip when loading from a save. */
  mode?: "new" | "load";
};

export class ColonyRuntime {
  readonly events = new ColonyEventBus();
  readonly cellsByKey = new Map<string, Entity>();
  /**
   * True when this session was initialized from a save (`mode === "load"`).
   * Used by the UI to skip the first-play tutorial on Continue.
   */
  sessionStartedFromSave = false;
  controllerEntity!: Entity;
  scene!: Scene;
  engine!: Engine;
  private seasonSystem: SeasonSystem | null = null;
  pendingCellTypeKey: string | null = null;
  /** Last validation error for {@link requestCellTypeChange} (shown in the picker). */
  cellTypeChangeError: string | null = null;
  /**
   * When set, the next {@link requestCellTypeChange} to this type on the same cell
   * discards stored goods instead of relocating (player confirmed).
   */
  cellTypeChangeDiscardTarget: "brood" | "pollen" | "nectar" | null = null;
  /** Hive key under the pointer for hover outline (see {@link updateHoverFromPointer}). */
  hoverHiveKey: string | null = null;
  lastUiEmit = 0;
  /** 0–1 full-screen fade during level transitions (for React overlay). */
  transitionOverlay = 0;

  /**
   * When set, the React layer shows the succession modal (pupa pick + honey shop).
   * Cleared after the player confirms or defers optional succession.
   */
  successionModal: {
    readonly mandatory: boolean;
    readonly reason: SuccessionReason;
    /** Honey currency for rerolls / upgrades: total stored in nectar cells at succession. */
    readonly honeyBudget: number;
    readonly beesTotal: number;
    readonly colonyDay: number;
  } | null = null;

  initialize(scene: Scene, engine: Engine, options?: ColonyInitializeOptions): void {
    this.scene = scene;
    this.engine = engine;
    const world = scene.world;
    const mode = options?.mode ?? "new";
    this.sessionStartedFromSave = mode === "load";

    this.controllerEntity = new Entity({
      name: "colony-controller",
      components: [
        new ActiveLevelComponent(),
        new QueenTimerComponent(),
        new ColonyTimeComponent(),
        new YearlyStatsComponent(),
        new HoneyRunComponent(),
      ],
    });
    this.controllerEntity.addTag("colonyController");
    world.add(this.controllerEntity);

    this.controllerEntity.get(QueenTimerComponent)!.layCooldownMs = 3500;

    refreshActiveColonyConstantsFromMeta();

    if (mode === "new") {
      seedLevelZeroColony(this);
    }

    world.add(new LevelSystem(world, this));
    world.add(new WorkerLifecycleSystem(world, this));
    const season = new SeasonSystem(world, this);
    this.seasonSystem = season;
    world.add(season);
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

  getSeasonSystemStateForSave(): SeasonSystemSave {
    return (
      this.seasonSystem?.getStateForSave() ?? {
        prevColonyDay: 0,
        lastNectarPurgeCycleIndex: null,
      }
    );
  }

  applySeasonSystemStateForLoad(state: SeasonSystemSave): void {
    this.seasonSystem?.applyStateFromLoad(state);
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

  /** Total unprocessed nectar in built nectar cells (HUD). */
  sumNectarStored(): number {
    let total = 0;
    for (const [, e] of this.cellsByKey) {
      const st = e.get(CellStateComponent)!;
      if (st.built && st.cellType === "nectar") {
        total += st.nectarStored;
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
    const h = worldToHex(w, getActiveColonyConstants().hexSize);
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
    const pos = hexToWorld(hex, getActiveColonyConstants().hexSize);
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
    const yearly = this.controllerEntity.get(YearlyStatsComponent);
    if (yearly?.isYearReviewOpen) {
      return true;
    }
    return this.successionModal?.mandatory === true;
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
   * Returns the hive key if tapping this hex should open the cell-type picker (built cell).
   */
  getOpenCellTypePickerKeyForTap(coord: HiveCoord): string | null {
    const active = this.controllerEntity.get(ActiveLevelComponent)!;
    if (active.transition !== "idle" || coord.level !== active.activeLevel) {
      return null;
    }
    const key = hiveKey(coord);
    const existing = this.cellsByKey.get(key);
    if (!existing) {
      return null;
    }
    const st = existing.get(CellStateComponent)!;
    if (st.built && st.cellType === "none") {
      return key;
    }
    if (st.built && st.cellType !== "none") {
      return key;
    }
    return null;
  }

  /**
   * Opens the anchored cell-type picker (tap on a built cell; same pointer-up path as placement).
   */
  openCellTypePicker(cellKey: string): void {
    this.pendingCellTypeKey = cellKey;
    this.cellTypeChangeError = null;
    this.cellTypeChangeDiscardTarget = null;
    this.emitUiSnapshotImmediate();
  }

  /**
   * Page-space point → hive key under the active level (for dismiss hit-testing).
   */
  hiveKeyUnderPagePoint(pageX: number, pageY: number): string | null {
    const w = this.engine.screen.pageToWorldCoordinates(vec(pageX, pageY));
    const h = worldToHex(w, getActiveColonyConstants().hexSize);
    return hiveKey({ q: h.q, r: h.r, level: this.activeLevel });
  }

  /**
   * World center of the pending cell → page coordinates for the picker anchor.
   */
  getPendingCellTypeAnchorPage(): { pageX: number; pageY: number } | null {
    if (!this.pendingCellTypeKey) {
      return null;
    }
    const coord = parseHiveKey(this.pendingCellTypeKey);
    const w = hexToWorld(
      { q: coord.q, r: coord.r },
      getActiveColonyConstants().hexSize,
    );
    const page = this.engine.screen.worldToPageCoordinates(vec(w.x, w.y));
    return { pageX: page.x, pageY: page.y };
  }

  /**
   * Handles a tap on the hive: open the cell-type picker on a built cell, or place a new foundation.
   */
  handleTapIntent(coord: HiveCoord): void {
    const active = this.controllerEntity.get(ActiveLevelComponent)!;
    if (active.transition !== "idle") {
      return;
    }
    if (coord.level !== active.activeLevel) {
      return;
    }
    const pickerKey = this.getOpenCellTypePickerKeyForTap(coord);
    if (pickerKey != null) {
      this.openCellTypePicker(pickerKey);
      return;
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
  requestCellTypeChange(
    cellKey: string,
    targetType: "brood" | "pollen" | "nectar",
  ): void {
    this.cellTypeChangeError = null;
    const discardConfirmed =
      this.cellTypeChangeDiscardTarget === targetType &&
      this.pendingCellTypeKey === cellKey;
    const ent = this.cellsByKey.get(cellKey);
    if (!ent) {
      return;
    }
    const st = ent.get(CellStateComponent)!;
    const coord = ent.get(CellCoordComponent)!;

    if (!st.built) {
      this.cellTypeChangeDiscardTarget = null;
      this.cellTypeChangeError = "Cell is not built yet.";
      this.emitUiSnapshotImmediate();
      return;
    }

    if (st.cellType === targetType && !st.pendingCellType) {
      this.pendingCellTypeKey = null;
      this.cellTypeChangeDiscardTarget = null;
      this.emitUiSnapshotImmediate();
      return;
    }

    if (this.hasOpenJobAtCell(cellKey, "clearCellForRetype")) {
      this.cellTypeChangeDiscardTarget = null;
      this.cellTypeChangeError =
        "This cell is already being emptied for a type change.";
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
      this.cellTypeChangeDiscardTarget = null;
      this.emitUiSnapshotImmediate();
      return;
    }

    if (st.cellType === "brood" && st.stage === "empty") {
      this.applyResolvedCellType(cellKey, targetType);
      this.pendingCellTypeKey = null;
      this.cellTypeChangeDiscardTarget = null;
      this.emitUiSnapshotImmediate();
      return;
    }

    if (this.cellHasHoneyProcessJob(coord)) {
      this.cellTypeChangeDiscardTarget = null;
      this.cellTypeChangeError = "Wait for honey processing to finish on this cell.";
      this.emitUiSnapshotImmediate();
      return;
    }

    if (st.honeyProcessingProgress > 0) {
      this.cellTypeChangeDiscardTarget = null;
      this.cellTypeChangeError = "Wait for honey processing to finish on this cell.";
      this.emitUiSnapshotImmediate();
      return;
    }

    const needsRelocate =
      (st.cellType === "pollen" && st.pollenStored > 0) ||
      (st.cellType === "nectar" && (st.nectarStored > 0 || st.honeyStored > 0));

    if (needsRelocate) {
      const canMove = canRelocateCellContentsForRetype(this, cellKey, coord.level, st);
      if (!canMove && !discardConfirmed) {
        this.cellTypeChangeDiscardTarget = targetType;
        this.cellTypeChangeError =
          "There is nowhere else to store this on this level. Choose again to discard it and change the cell type.";
        this.emitUiSnapshotImmediate();
        return;
      }
      if (!canMove && discardConfirmed) {
        this.cellTypeChangeDiscardTarget = null;
        this.applyResolvedCellType(cellKey, targetType);
        this.pendingCellTypeKey = null;
        this.emitUiSnapshotImmediate();
        return;
      }
      this.cellTypeChangeDiscardTarget = null;
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

    this.cellTypeChangeDiscardTarget = null;
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
    this.cellTypeChangeDiscardTarget = null;
    this.emitUiSnapshotImmediate();
  }

  /** Pushes the latest HUD snapshot to subscribers without waiting for the frame throttle. */
  emitUiSnapshotImmediate(): void {
    this.events.emit({ type: "ColonySnapshot", snapshot: this.getUiSnapshot() });
  }

  getUiSnapshot(): ColonyUiSnapshot {
    return buildColonyUiSnapshot(this);
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

  /**
   * Opens optional succession ignoring bee threshold and queen presence (for dev shortcuts / QA).
   */
  debugOpenSuccessionOptional(): void {
    debugOpenSuccessionOptionalImpl(this);
  }

  /**
   * Opens the optional succession modal (player-initiated while hive is large).
   */
  requestOptionalSuccession(): void {
    requestOptionalSuccessionImpl(this);
  }

  /**
   * Forces mandatory succession (queen death or end of reign).
   */
  triggerMandatorySuccession(reason: SuccessionReason): void {
    triggerMandatorySuccessionImpl(this, reason);
  }

  dismissSuccessionModal(): void {
    dismissSuccessionModalImpl(this);
  }

  /**
   * Persists lineage meta and resets the colony to a fresh hive (new queen).
   */
  applySuccessionChoice(entry: Omit<LineageEntry, "generationIndex">): void {
    applySuccessionChoiceToColony(this, entry);
  }

  /**
   * Clears the simulation and re-seeds level 0 (after lineage write).
   */
  resetWorldAfterSuccession(): void {
    resetWorldAfterSuccessionImpl(this);
  }

  /**
   * Resets seasonal state after succession (internal hook for {@link resetWorldAfterSuccession}).
   */
  resetSeasonForNewColonyAfterSuccession(): void {
    this.seasonSystem?.resetForNewColony();
  }
}
