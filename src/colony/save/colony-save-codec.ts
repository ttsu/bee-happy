import { vec } from "excalibur";
import type { ColonyRuntime } from "../colony-runtime";
import { refreshActiveColonyConstantsFromMeta } from "../colony-active-constants";
import { BeeActor } from "../../render/bee-actor";
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
} from "../ecs/components/colony-components";
import {
  defaultMetaProgress,
  metaProgressSchema,
  readMetaProgressFromStorage,
  writeMetaProgressToStorage,
} from "../meta/meta-progress";
import { parseColonySavePayload } from "../../schemas/colony-save-load";
import {
  SAVE_FORMAT_VERSION,
  type CellStateJson,
  type ColonySaveV1,
  type JobComponentJson,
} from "./colony-save-types";

/**
 * Writes lineage meta + recomputes effective colony constants from storage.
 * Call before {@link ColonyRuntime.initialize} when loading a save so constants match the file.
 */
export function syncMetaFromSaveData(data: ColonySaveV1): void {
  const rawMeta = data.meta ?? readMetaProgressFromStorage();
  const metaParsed = metaProgressSchema.safeParse(rawMeta);
  const meta = metaParsed.success ? metaParsed.data : defaultMetaProgress();
  writeMetaProgressToStorage(meta);
  refreshActiveColonyConstantsFromMeta();
}

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

export function applyCellStateJson(st: CellStateComponent, j: CellStateJson): void {
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

export function newJobFromJson(j: JobComponentJson): JobComponent {
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
      selectedPlacementCellType: colony.selectedPlacementCellType,
    },
    cells,
    jobs,
    bees,
    meta: readMetaProgressFromStorage(),
  };
}

export function parseColonySaveJson(raw: string): ColonySaveV1 | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parseColonySavePayload(parsed);
  } catch {
    return null;
  }
}
