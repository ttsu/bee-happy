import { Entity, vec } from "excalibur";
import type { ColonyRuntime } from "./colony-runtime";
import { COLONY } from "./constants";
import { worldToHex } from "../grid/hex-grid";
import type { HiveCoord } from "../grid/hive-levels";
import { BeeActor } from "../render/bee-actor";
import {
  ActiveLevelComponent,
  BeeAgeComponent,
  BeeCarryComponent,
  BeeLevelComponent,
  BeeNeedsComponent,
  BeeRoleComponent,
  BeeWorkComponent,
  CellCoordComponent,
  CellStateComponent,
  ColonyTimeComponent,
  JobComponent,
  QueenTimerComponent,
  YearlyStatsComponent,
  type BeeRole,
  type CellStage,
  type CellTypeKind,
  type JobKind,
} from "./ecs/components/colony-components";
import type { SeasonSystemSave } from "./ecs/systems/season-system";

/** @deprecated Legacy single-save key; migrated into slots on first read of the index. */
export const SAVE_STORAGE_KEY = "bee-happy-save-v1";

const SAVE_INDEX_KEY = "bee-happy-save-index-v1";
const SAVE_SLOT_KEY_PREFIX = "bee-happy-save-slot-v1-";

/** Session-only: which save slot the running game writes to (set when starting from the menu). */
export const ACTIVE_SAVE_SLOT_SESSION_KEY = "bee-happy-active-save-slot-id";

export const SAVE_FORMAT_VERSION = 1;
export const SAVE_INDEX_FORMAT_VERSION = 1;

export type SaveIndexEntry = {
  slotId: string;
  /** Shown in the load list; assigned when the slot is first persisted. */
  slotLabel: string;
  /** Last successful write time (from {@link ColonySaveV1.savedAtIso}). */
  savedAtIso: string;
};

export type SaveIndexV1 = {
  formatVersion: typeof SAVE_INDEX_FORMAT_VERSION;
  slots: SaveIndexEntry[];
};

export type Vec2Json = { x: number; y: number };

export type CellStateJson = {
  built: boolean;
  stage: CellStage;
  buildProgress: number;
  cellType: CellTypeKind;
  pollenStored: number;
  nectarStored: number;
  honeyStored: number;
  honeyProcessingProgress: number;
  eggTimerMs: number;
  sealedTimerMs: number;
  cleaningTimerMs: number;
  larvaePollenRemaining: number;
  larvaeNectarRemaining: number;
  honeyProcessingDirty: boolean;
  pendingCellType: "brood" | "pollen" | "nectar" | null;
};

export type JobComponentJson = {
  kind: JobKind;
  priority: number;
  targetQ: number;
  targetR: number;
  targetLevel: number;
  beesNeeded: number;
  reservedBeeIds: number[];
  status: "open" | "active" | "done";
  pathPoints: Vec2Json[];
  /** Added in a later format; omitted in older saves. */
  pathLevels?: number[];
  foragePhase: JobComponent["foragePhase"];
  forageWaitMs: number;
  forageCapacityPollMs: number;
  carryPayload: JobComponent["carryPayload"];
  depositTargetKey: string | null;
  adultFeedTargetBeeId: number | null;
  selfFeedCellKey: string | null;
  feedQueenTimerMs: number;
  layEggTimerMs: number;
  guardHiveTimerMs: number;
  scratchX: number;
  scratchY: number;
  feedLarvaePhase: JobComponent["feedLarvaePhase"];
  feedLarvaePhaseTimerMs: number;
  feedPickupQ: number;
  feedPickupR: number;
  feedPickupLevel: number;
  feedCargoKind: JobComponent["feedCargoKind"];
  retypePhase: JobComponent["retypePhase"];
  retypeClearAccumMs: number;
};

export type BeeJson = {
  role: BeeRole;
  level: number;
  pos: Vec2Json;
  rotation: number;
  work: {
    availability: "available" | "busy";
    currentJobEntityId: number | null;
    pathIndex: number;
    idleWanderTarget: Vec2Json | null;
    idleWanderPauseRemainingMs: number;
  };
  carry: BeeCarryComponent["carry"];
  needs: { hunger: number; thirst: number };
  ageMs: number | null;
};

export type ActiveLevelJson = Pick<
  ActiveLevelComponent,
  "activeLevel" | "transition" | "pendingLevel" | "transitionT"
>;

export type YearlyStatsJson = Pick<
  YearlyStatsComponent,
  | "yearNumber"
  | "isYearReviewOpen"
  | "honeyProcessedTotal"
  | "nectarCollectedTotal"
  | "pollenCollectedTotal"
  | "beesHatchedTotal"
  | "happyBeeSecondsTotal"
  | "remainingBeesAtYearEnd"
>;

export type ColonySaveV1 = {
  formatVersion: typeof SAVE_FORMAT_VERSION;
  savedAtIso: string;
  camera: Vec2Json;
  activeLevel: ActiveLevelJson;
  queenTimer: Pick<QueenTimerComponent, "layCooldownMs">;
  colonyTime: Pick<ColonyTimeComponent, "colonyElapsedMs">;
  yearly: YearlyStatsJson;
  seasonSystem: SeasonSystemSave;
  runtime: {
    pendingCellTypeKey: string | null;
    cellTypeChangeError: string | null;
    cellTypeChangeDiscardTarget: "brood" | "pollen" | "nectar" | null;
    transitionOverlay: number;
  };
  cells: { key: string; coord: HiveCoord; state: CellStateJson }[];
  /** Stable order: entity id at save time + job payload (ids remapped on load). */
  jobs: { entityId: number; job: JobComponentJson }[];
  /** Stable order: entity id at save time + bee payload. */
  bees: { entityId: number; bee: BeeJson }[];
};

function cellStateToJson(st: CellStateComponent): CellStateJson {
  return {
    built: st.built,
    stage: st.stage,
    buildProgress: st.buildProgress,
    cellType: st.cellType,
    pollenStored: st.pollenStored,
    nectarStored: st.nectarStored,
    honeyStored: st.honeyStored,
    honeyProcessingProgress: st.honeyProcessingProgress,
    eggTimerMs: st.eggTimerMs,
    sealedTimerMs: st.sealedTimerMs,
    cleaningTimerMs: st.cleaningTimerMs,
    larvaePollenRemaining: st.larvaePollenRemaining,
    larvaeNectarRemaining: st.larvaeNectarRemaining,
    honeyProcessingDirty: st.honeyProcessingDirty,
    pendingCellType: st.pendingCellType,
  };
}

function applyCellStateJson(st: CellStateComponent, j: CellStateJson): void {
  st.built = j.built;
  st.stage = j.stage;
  st.buildProgress = j.buildProgress;
  st.cellType = j.cellType;
  st.pollenStored = j.pollenStored;
  st.nectarStored = j.nectarStored;
  st.honeyStored = j.honeyStored;
  st.honeyProcessingProgress = j.honeyProcessingProgress;
  st.eggTimerMs = j.eggTimerMs;
  st.sealedTimerMs = j.sealedTimerMs;
  st.cleaningTimerMs = j.cleaningTimerMs;
  st.larvaePollenRemaining = j.larvaePollenRemaining;
  st.larvaeNectarRemaining = j.larvaeNectarRemaining;
  st.honeyProcessingDirty = j.honeyProcessingDirty;
  st.pendingCellType = j.pendingCellType;
}

function jobToJson(job: JobComponent): JobComponentJson {
  return {
    kind: job.kind,
    priority: job.priority,
    targetQ: job.targetQ,
    targetR: job.targetR,
    targetLevel: job.targetLevel,
    beesNeeded: job.beesNeeded,
    reservedBeeIds: [...job.reservedBeeIds],
    status: job.status,
    pathPoints: job.pathPoints.map((p) => ({ x: p.x, y: p.y })),
    pathLevels: [...job.pathLevels],
    foragePhase: job.foragePhase,
    forageWaitMs: job.forageWaitMs,
    forageCapacityPollMs: job.forageCapacityPollMs,
    carryPayload: job.carryPayload,
    depositTargetKey: job.depositTargetKey,
    adultFeedTargetBeeId: job.adultFeedTargetBeeId,
    selfFeedCellKey: job.selfFeedCellKey,
    feedQueenTimerMs: job.feedQueenTimerMs,
    layEggTimerMs: job.layEggTimerMs,
    guardHiveTimerMs: job.guardHiveTimerMs,
    scratchX: job.scratchX,
    scratchY: job.scratchY,
    feedLarvaePhase: job.feedLarvaePhase,
    feedLarvaePhaseTimerMs: job.feedLarvaePhaseTimerMs,
    feedPickupQ: job.feedPickupQ,
    feedPickupR: job.feedPickupR,
    feedPickupLevel: job.feedPickupLevel,
    feedCargoKind: job.feedCargoKind,
    retypePhase: job.retypePhase,
    retypeClearAccumMs: job.retypeClearAccumMs,
  };
}

function applyJobJson(job: JobComponent, j: JobComponentJson): void {
  job.reservedBeeIds = [...j.reservedBeeIds];
  job.status = j.status;
  job.pathPoints = j.pathPoints.map((p) => vec(p.x, p.y));
  const pl = j.pathLevels;
  job.pathLevels =
    pl && pl.length === j.pathPoints.length
      ? [...pl]
      : j.pathPoints.map(() => job.targetLevel);
  job.foragePhase = j.foragePhase;
  job.forageWaitMs = j.forageWaitMs;
  job.forageCapacityPollMs = j.forageCapacityPollMs;
  job.carryPayload = j.carryPayload;
  job.depositTargetKey = j.depositTargetKey;
  job.adultFeedTargetBeeId = j.adultFeedTargetBeeId;
  job.selfFeedCellKey = j.selfFeedCellKey;
  job.feedQueenTimerMs = j.feedQueenTimerMs;
  job.layEggTimerMs = j.layEggTimerMs;
  job.guardHiveTimerMs = j.guardHiveTimerMs;
  job.scratchX = j.scratchX;
  job.scratchY = j.scratchY;
  job.feedLarvaePhase = j.feedLarvaePhase;
  job.feedLarvaePhaseTimerMs = j.feedLarvaePhaseTimerMs;
  job.feedPickupQ = j.feedPickupQ;
  job.feedPickupR = j.feedPickupR;
  job.feedPickupLevel = j.feedPickupLevel;
  job.feedCargoKind = j.feedCargoKind;
  job.retypePhase = j.retypePhase;
  job.retypeClearAccumMs = j.retypeClearAccumMs;
}

function newJobFromJson(j: JobComponentJson): JobComponent {
  const job = new JobComponent(
    j.kind,
    j.priority,
    j.targetQ,
    j.targetR,
    j.targetLevel,
    j.beesNeeded,
  );
  applyJobJson(job, j);
  return job;
}

/**
 * Full colony snapshot for local persistence (cells, jobs, bees, timers).
 */
export function serializeColonySave(colony: ColonyRuntime): ColonySaveV1 {
  const scene = colony.scene;
  const active = colony.controllerEntity.get(ActiveLevelComponent)!;
  const queen = colony.controllerEntity.get(QueenTimerComponent)!;
  const time = colony.controllerEntity.get(ColonyTimeComponent)!;
  const yearly = colony.controllerEntity.get(YearlyStatsComponent)!;

  const cells: ColonySaveV1["cells"] = [];
  for (const [key, ent] of colony.cellsByKey) {
    const coord = ent.get(CellCoordComponent)!;
    const st = ent.get(CellStateComponent)!;
    cells.push({
      key,
      coord: { q: coord.q, r: coord.r, level: coord.level },
      state: cellStateToJson(st),
    });
  }

  const jobs: ColonySaveV1["jobs"] = [];
  for (const e of scene.world.entities) {
    const job = e.get(JobComponent);
    if (job) {
      jobs.push({ entityId: e.id, job: jobToJson(job) });
    }
  }

  const bees: ColonySaveV1["bees"] = [];
  for (const actor of scene.actors) {
    if (!(actor instanceof BeeActor)) {
      continue;
    }
    const br = actor.get(BeeRoleComponent);
    const work = actor.get(BeeWorkComponent);
    const carry = actor.get(BeeCarryComponent);
    const needs = actor.get(BeeNeedsComponent);
    const level = actor.get(BeeLevelComponent);
    const age = actor.get(BeeAgeComponent);
    if (!br || !work || !carry || !needs || !level) {
      continue;
    }
    const iw = work.idleWanderTarget;
    bees.push({
      entityId: actor.id,
      bee: {
        role: br.role,
        level: level.level,
        pos: { x: actor.pos.x, y: actor.pos.y },
        rotation: actor.rotation,
        work: {
          availability: work.availability,
          currentJobEntityId: work.currentJobEntityId,
          pathIndex: work.pathIndex,
          idleWanderTarget: iw ? { x: iw.x, y: iw.y } : null,
          idleWanderPauseRemainingMs: work.idleWanderPauseRemainingMs,
        },
        carry: carry.carry,
        needs: { hunger: needs.hunger, thirst: needs.thirst },
        ageMs: age ? age.ageMs : null,
      },
    });
  }

  return {
    formatVersion: SAVE_FORMAT_VERSION,
    savedAtIso: new Date().toISOString(),
    camera: { x: scene.camera.pos.x, y: scene.camera.pos.y },
    activeLevel: {
      activeLevel: active.activeLevel,
      transition: "idle",
      pendingLevel: null,
      transitionT: 0,
    },
    queenTimer: { layCooldownMs: queen.layCooldownMs },
    colonyTime: { colonyElapsedMs: time.colonyElapsedMs },
    yearly: {
      yearNumber: yearly.yearNumber,
      isYearReviewOpen: yearly.isYearReviewOpen,
      honeyProcessedTotal: yearly.honeyProcessedTotal,
      nectarCollectedTotal: yearly.nectarCollectedTotal,
      pollenCollectedTotal: yearly.pollenCollectedTotal,
      beesHatchedTotal: yearly.beesHatchedTotal,
      happyBeeSecondsTotal: yearly.happyBeeSecondsTotal,
      remainingBeesAtYearEnd: yearly.remainingBeesAtYearEnd,
    },
    seasonSystem: colony.getSeasonSystemStateForSave(),
    runtime: {
      pendingCellTypeKey: colony.pendingCellTypeKey,
      cellTypeChangeError: colony.cellTypeChangeError,
      cellTypeChangeDiscardTarget: colony.cellTypeChangeDiscardTarget,
      transitionOverlay: colony.transitionOverlay,
    },
    cells,
    jobs,
    bees,
  };
}

export type LoadPayload = {
  data: ColonySaveV1;
  seasonSystem: SeasonSystemSave;
};

/**
 * Clears seeded content and applies a save. Call after {@link ColonyRuntime.initialize}
 * with `{ mode: "load" }` so the world only has the controller + systems.
 */
export function applyColonySave(colony: ColonyRuntime, payload: LoadPayload): void {
  const { data, seasonSystem } = payload;
  const scene = colony.scene;
  const world = scene.world;

  for (const e of [...world.entities]) {
    e.kill();
  }
  for (const a of [...scene.actors]) {
    a.kill();
  }
  colony.cellsByKey.clear();

  colony.controllerEntity = new Entity({
    name: "colony-controller",
    components: [
      Object.assign(new ActiveLevelComponent(), data.activeLevel),
      Object.assign(new QueenTimerComponent(), data.queenTimer),
      Object.assign(new ColonyTimeComponent(), data.colonyTime),
      Object.assign(new YearlyStatsComponent(), data.yearly),
    ],
  });
  colony.controllerEntity.addTag("colonyController");
  world.add(colony.controllerEntity);

  colony.applySeasonSystemStateForLoad(seasonSystem);

  for (const c of data.cells) {
    const ent = colony.createCellEntity(c.coord, {});
    applyCellStateJson(ent.get(CellStateComponent)!, c.state);
  }

  const jobMap = new Map<number, number>();
  for (const { entityId: oldId, job: j } of data.jobs) {
    const ent = colony.createJob(newJobFromJson(j));
    jobMap.set(oldId, ent.id);
  }

  const beeMap = new Map<number, number>();
  const beeWorkOldJobIds: { actor: BeeActor; oldJobId: number | null }[] = [];
  for (const { entityId: oldBeeId, bee: b } of data.bees) {
    const pos = vec(b.pos.x, b.pos.y);
    const hex = worldToHex(pos, COLONY.hexSize);
    const actor = colony.spawnBee(b.role, b.level, hex);
    actor.rotation = b.rotation;
    actor.pos = pos;
    const work = actor.get(BeeWorkComponent)!;
    work.availability = b.work.availability;
    work.pathIndex = b.work.pathIndex;
    work.idleWanderTarget = b.work.idleWanderTarget
      ? vec(b.work.idleWanderTarget.x, b.work.idleWanderTarget.y)
      : null;
    work.idleWanderPauseRemainingMs = b.work.idleWanderPauseRemainingMs;
    beeWorkOldJobIds.push({ actor, oldJobId: b.work.currentJobEntityId });
    actor.get(BeeCarryComponent)!.carry = b.carry;
    const needs = actor.get(BeeNeedsComponent)!;
    needs.hunger = b.needs.hunger;
    needs.thirst = b.needs.thirst;
    if (b.ageMs != null) {
      const age = actor.get(BeeAgeComponent);
      if (age) {
        age.ageMs = b.ageMs;
      }
    }
    beeMap.set(oldBeeId, actor.id);
  }

  for (const { actor, oldJobId } of beeWorkOldJobIds) {
    const work = actor.get(BeeWorkComponent)!;
    work.currentJobEntityId = oldJobId != null ? (jobMap.get(oldJobId) ?? null) : null;
  }

  scene.camera.pos = vec(data.camera.x, data.camera.y);

  colony.pendingCellTypeKey = data.runtime.pendingCellTypeKey;
  colony.cellTypeChangeError = data.runtime.cellTypeChangeError;
  colony.cellTypeChangeDiscardTarget = data.runtime.cellTypeChangeDiscardTarget;
  colony.transitionOverlay = data.runtime.transitionOverlay;

  for (const e of world.entities) {
    const job = e.get(JobComponent);
    if (!job) {
      continue;
    }
    job.reservedBeeIds = job.reservedBeeIds
      .map((id) => beeMap.get(id))
      .filter((id): id is number => id != null);
    job.adultFeedTargetBeeId = beeMap.get(job.adultFeedTargetBeeId ?? -1) ?? null;
  }

  colony.emitUiSnapshotImmediate();
}

export function parseColonySaveJson(raw: string): ColonySaveV1 | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const o = parsed as Record<string, unknown>;
    if (o.formatVersion !== SAVE_FORMAT_VERSION) {
      return null;
    }
    return parsed as ColonySaveV1;
  } catch {
    return null;
  }
}

function parseSaveIndexJson(raw: string | null): SaveIndexV1 | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const o = parsed as Record<string, unknown>;
    if (o.formatVersion !== SAVE_INDEX_FORMAT_VERSION) {
      return null;
    }
    const slots = o.slots;
    if (!Array.isArray(slots)) {
      return null;
    }
    return parsed as SaveIndexV1;
  } catch {
    return null;
  }
}

function slotStorageKey(slotId: string): string {
  return `${SAVE_SLOT_KEY_PREFIX}${slotId}`;
}

function migrateLegacySaveIntoIndex(): SaveIndexV1 | null {
  try {
    const raw = localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const data = parseColonySaveJson(raw);
    if (!data) {
      return null;
    }
    const slotId = crypto.randomUUID();
    const label = `Colony 1`;
    localStorage.setItem(slotStorageKey(slotId), raw);
    const index: SaveIndexV1 = {
      formatVersion: SAVE_INDEX_FORMAT_VERSION,
      slots: [
        {
          slotId,
          slotLabel: label,
          savedAtIso: data.savedAtIso,
        },
      ],
    };
    localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(index));
    localStorage.removeItem(SAVE_STORAGE_KEY);
    return index;
  } catch {
    return null;
  }
}

/**
 * Reads the save slot index, migrating a legacy single-key save if present.
 */
export function readSaveIndex(): SaveIndexV1 {
  try {
    const parsed = parseSaveIndexJson(localStorage.getItem(SAVE_INDEX_KEY));
    if (parsed) {
      return parsed;
    }
    const migrated = migrateLegacySaveIntoIndex();
    if (migrated) {
      return migrated;
    }
    return { formatVersion: SAVE_INDEX_FORMAT_VERSION, slots: [] };
  } catch {
    return { formatVersion: SAVE_INDEX_FORMAT_VERSION, slots: [] };
  }
}

function writeSaveIndex(index: SaveIndexV1): void {
  localStorage.setItem(SAVE_INDEX_KEY, JSON.stringify(index));
}

/**
 * Save slots for the launch menu, newest first.
 */
export function listSaveSlotsNewestFirst(): SaveIndexEntry[] {
  const { slots } = readSaveIndex();
  return [...slots].sort((a, b) => {
    const ta = Date.parse(a.savedAtIso);
    const tb = Date.parse(b.savedAtIso);
    const na = Number.isNaN(ta) ? 0 : ta;
    const nb = Number.isNaN(tb) ? 0 : tb;
    return nb - na;
  });
}

export function getColonySaveForSlot(slotId: string): ColonySaveV1 | null {
  try {
    const raw = localStorage.getItem(slotStorageKey(slotId));
    if (!raw) {
      return null;
    }
    return parseColonySaveJson(raw);
  } catch {
    return null;
  }
}

function nextDefaultSlotLabel(slots: SaveIndexEntry[]): string {
  let max = 0;
  const re = /^Colony\s+(\d+)$/i;
  for (const s of slots) {
    const m = re.exec(s.slotLabel.trim());
    if (m) {
      const n = Number.parseInt(m[1]!, 10);
      if (!Number.isNaN(n)) {
        max = Math.max(max, n);
      }
    }
  }
  return `Colony ${max + 1}`;
}

/**
 * Reserves a new save slot id for a fresh colony. The slot appears in the load list after the first autosave.
 */
export function ensureActiveSaveSlotForNewGame(): string {
  const slotId = crypto.randomUUID();
  setActiveSaveSlotSession(slotId);
  return slotId;
}

export function setActiveSaveSlotSession(slotId: string): void {
  try {
    sessionStorage.setItem(ACTIVE_SAVE_SLOT_SESSION_KEY, slotId);
  } catch {
    /* ignore */
  }
}

function getActiveSaveSlotIdFromSession(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_SAVE_SLOT_SESSION_KEY);
  } catch {
    return null;
  }
}

function upsertIndexEntryForSlot(
  slotId: string,
  slotLabel: string,
  savedAtIso: string,
): void {
  const index = readSaveIndex();
  const i = index.slots.findIndex((s) => s.slotId === slotId);
  const entry: SaveIndexEntry = { slotId, slotLabel, savedAtIso };
  const slots =
    i >= 0
      ? index.slots.map((s) => (s.slotId === slotId ? entry : s))
      : [...index.slots, entry];
  writeSaveIndex({ formatVersion: SAVE_INDEX_FORMAT_VERSION, slots });
}

/**
 * Loads the colony JSON for the current session's slot (Continue / loaded game).
 */
export function readColonySaveFromStorage(): ColonySaveV1 | null {
  const slotId = getActiveSaveSlotIdFromSession();
  if (!slotId) {
    return null;
  }
  return getColonySaveForSlot(slotId);
}

export function writeColonySaveToStorage(data: ColonySaveV1): void {
  let slotId = getActiveSaveSlotIdFromSession();
  if (!slotId) {
    slotId = crypto.randomUUID();
    setActiveSaveSlotSession(slotId);
  }
  const index = readSaveIndex();
  const existing = index.slots.find((s) => s.slotId === slotId);
  const slotLabel = existing?.slotLabel ?? nextDefaultSlotLabel(index.slots);
  localStorage.setItem(slotStorageKey(slotId), JSON.stringify(data));
  upsertIndexEntryForSlot(slotId, slotLabel, data.savedAtIso);
}

/**
 * Removes one save slot (storage + index entry).
 */
export function deleteSaveSlot(slotId: string): void {
  try {
    localStorage.removeItem(slotStorageKey(slotId));
  } catch {
    /* ignore */
  }
  const index = readSaveIndex();
  writeSaveIndex({
    formatVersion: SAVE_INDEX_FORMAT_VERSION,
    slots: index.slots.filter((s) => s.slotId !== slotId),
  });
}

/**
 * Clears every save slot and the legacy key (for tests or full reset).
 */
export function clearAllColonySavesFromStorage(): void {
  try {
    const index = readSaveIndex();
    for (const s of index.slots) {
      localStorage.removeItem(slotStorageKey(s.slotId));
    }
    localStorage.removeItem(SAVE_INDEX_KEY);
    localStorage.removeItem(SAVE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** @deprecated Prefer {@link clearAllColonySavesFromStorage} or {@link deleteSaveSlot}. */
export function clearColonySaveFromStorage(): void {
  clearAllColonySavesFromStorage();
}
