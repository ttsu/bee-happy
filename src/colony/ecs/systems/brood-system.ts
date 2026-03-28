import { System, SystemPriority, SystemType, type World } from "excalibur";
import { asActor } from "../../actor-utils";
import {
  BeeWorkComponent,
  CellCoordComponent,
  CellStateComponent,
  JobComponent,
  QueenTimerComponent,
} from "../components/colony-components";
import { COLONY } from "../../constants";
import type { ColonyRuntime } from "../../colony-runtime";
import { hiveKey } from "../../../grid/hive-levels";
import { hexToWorld } from "../../../grid/hex-grid";
import { JobPriority } from "../../job-priority";
import { canSpawnFeedLarvaeJob, processFeedLarvaeJobs } from "../../feed-larvae-path";

const findEntityById = (world: World, id: number) =>
  asActor(world.entities.find((e) => e.id === id));

const releaseJob = (world: World, job: JobComponent): void => {
  for (const id of job.reservedBeeIds) {
    const bee = findEntityById(world, id);
    const w = bee?.get(BeeWorkComponent);
    if (w) {
      w.availability = "available";
      w.currentJobEntityId = null;
      w.pathIndex = 0;
      w.idleWanderTarget = null;
      w.idleWanderPauseRemainingMs = 0;
    }
  }
  job.reservedBeeIds = [];
};

const hasOpenJobForCell = (
  world: World,
  kind: JobComponent["kind"],
  key: string,
): boolean => {
  for (const e of world.entities) {
    const j = e.get(JobComponent);
    if (!j || j.kind !== kind || j.status === "done") {
      continue;
    }
    const k = hiveKey({
      q: j.targetQ,
      r: j.targetR,
      level: j.targetLevel,
    });
    if (k === key) {
      return true;
    }
  }
  return false;
};

const findOpenLayEggJobForCell = (world: World, key: string): JobComponent | null => {
  for (const e of world.entities) {
    const j = e.get(JobComponent);
    if (!j || j.kind !== "layEgg" || j.status === "done") {
      continue;
    }
    const k = hiveKey({
      q: j.targetQ,
      r: j.targetR,
      level: j.targetLevel,
    });
    if (k === key) {
      return j;
    }
  }
  return null;
};

/**
 * Queen egg laying (timer), egg→larvae→sealed→cleaning→empty, feed and clean jobs.
 */
export class BroodSystem extends System {
  static override priority = SystemPriority.Lower;
  public readonly systemType = SystemType.Update;

  constructor(
    public world: World,
    private readonly colony: ColonyRuntime,
  ) {
    super();
  }

  override update(elapsed: number): void {
    if (this.colony.isSimulationPaused()) {
      return;
    }
    const qt = this.colony.controllerEntity.get(QueenTimerComponent)!;
    qt.layCooldownMs -= elapsed;
    if (qt.layCooldownMs <= 0) {
      qt.layCooldownMs = COLONY.queenLayIntervalMs;
      for (const [, ent] of this.colony.cellsByKey) {
        const st = ent.get(CellStateComponent)!;
        const coord = ent.get(CellCoordComponent)!;
        const key = hiveKey(coord);
        if (
          st.built &&
          st.cellType === "brood" &&
          st.stage === "empty" &&
          !st.pendingCellType &&
          !findOpenLayEggJobForCell(this.world, key)
        ) {
          const job = new JobComponent(
            "layEgg",
            JobPriority.layEgg,
            coord.q,
            coord.r,
            coord.level,
            1,
          );
          job.layEggTimerMs = COLONY.queenLayDurationMs;
          this.colony.createJob(job);
          break;
        }
      }
    }

    for (const ent of this.world.entities) {
      const job = ent.get(JobComponent);
      if (!job || job.kind !== "layEgg" || job.status === "done") {
        continue;
      }
      const key = hiveKey({
        q: job.targetQ,
        r: job.targetR,
        level: job.targetLevel,
      });
      const cellEnt = this.colony.getCellAt(key);
      if (!cellEnt) {
        job.status = "done";
        releaseJob(this.world, job);
        ent.kill();
        continue;
      }
      const st = cellEnt.get(CellStateComponent)!;
      if (!st.built || st.cellType !== "brood" || st.stage !== "empty") {
        job.status = "done";
        releaseJob(this.world, job);
        ent.kill();
        continue;
      }
      const center = hexToWorld({ q: job.targetQ, r: job.targetR }, COLONY.hexSize);
      let laid = false;
      for (const id of job.reservedBeeIds) {
        const queen = findEntityById(this.world, id);
        if (!queen) {
          continue;
        }
        const w = queen.get(BeeWorkComponent);
        const atPathEnd =
          !!w && job.pathPoints.length > 0 && w.pathIndex >= job.pathPoints.length - 1;
        const inCell = queen.pos.sub(center).size <= COLONY.buildWorkRadiusPx && atPathEnd;
        if (inCell) {
          job.layEggTimerMs -= elapsed;
          if (job.layEggTimerMs <= 0) {
            st.stage = "egg";
            st.eggTimerMs = COLONY.eggDurationMs;
            laid = true;
            break;
          }
        } else {
          job.layEggTimerMs = COLONY.queenLayDurationMs;
        }
      }
      if (!laid) {
        continue;
      }
      job.status = "done";
      releaseJob(this.world, job);
      ent.kill();
    }

    for (const [, ent] of this.colony.cellsByKey) {
      const st = ent.get(CellStateComponent)!;
      const coord = ent.get(CellCoordComponent)!;
      const key = hiveKey(coord);
      if (!st.built || st.cellType !== "brood") {
        continue;
      }
      if (st.stage === "egg") {
        st.eggTimerMs -= elapsed;
        if (st.eggTimerMs <= 0) {
          st.stage = "larvae";
          st.larvaePollenRemaining = COLONY.larvaePollenUnitsNeeded;
          st.larvaeNectarRemaining = COLONY.larvaeNectarUnitsNeeded;
          this.colony.events.emit({ type: "BroodLarvaeReady", cellKey: key });
        }
      } else if (
        st.stage === "larvae" &&
        (st.larvaePollenRemaining > 0 || st.larvaeNectarRemaining > 0)
      ) {
        if (
          canSpawnFeedLarvaeJob(this.colony, coord, st) &&
          !hasOpenJobForCell(this.world, "feedLarvae", key)
        ) {
          const j = new JobComponent(
            "feedLarvae",
            JobPriority.feedLarvae,
            coord.q,
            coord.r,
            coord.level,
            1,
          );
          this.colony.createJob(j);
        }
      } else if (st.stage === "sealed") {
        st.sealedTimerMs -= elapsed;
        if (st.sealedTimerMs <= 0) {
          st.stage = "cleaning";
          st.cleaningTimerMs = COLONY.cleaningDurationMs;
          this.colony.spawnEmergingWorker(coord.level, { q: coord.q, r: coord.r });
          this.colony.events.emit({ type: "BroodWorkerEmerged", cellKey: key });
          if (!hasOpenJobForCell(this.world, "cleanBrood", key)) {
            const j = new JobComponent(
              "cleanBrood",
              JobPriority.cleanBrood,
              coord.q,
              coord.r,
              coord.level,
              1,
            );
            this.colony.createJob(j);
          }
        }
      } else if (st.stage === "cleaning") {
        const center = hexToWorld({ q: coord.q, r: coord.r }, COLONY.hexSize);
        for (const je of this.world.entities) {
          const job = je.get(JobComponent);
          if (!job || job.kind !== "cleanBrood" || job.status === "done") {
            continue;
          }
          const jk = hiveKey({
            q: job.targetQ,
            r: job.targetR,
            level: job.targetLevel,
          });
          if (jk !== key) {
            continue;
          }
          for (const id of job.reservedBeeIds) {
            const bee = findEntityById(this.world, id);
            if (bee && bee.pos.sub(center).size < 40) {
              st.cleaningTimerMs -= elapsed;
            }
          }
        }
        if (st.cleaningTimerMs <= 0) {
          st.stage = "empty";
          for (const je of this.world.entities) {
            const job = je.get(JobComponent);
            if (
              job &&
              job.kind === "cleanBrood" &&
              hiveKey({
                q: job.targetQ,
                r: job.targetR,
                level: job.targetLevel,
              }) === key
            ) {
              job.status = "done";
              releaseJob(this.world, job);
              je.kill();
            }
          }
          this.colony.applyPendingBroodRetypeIfAny(key);
          this.colony.emitUiSnapshotImmediate();
        }
      }
    }

    processFeedLarvaeJobs(
      this.colony,
      this.world,
      (id) => findEntityById(this.world, id),
      releaseJob,
      (cellKey) => {
        this.colony.events.emit({ type: "BroodFed", cellKey });
      },
      elapsed,
    );
  }
}
