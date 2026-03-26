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
    const res = this.colony.resources;
    const qt = this.colony.controllerEntity.get(QueenTimerComponent)!;
    qt.layCooldownMs -= elapsed;
    if (qt.layCooldownMs <= 0) {
      qt.layCooldownMs = COLONY.queenLayIntervalMs;
      for (const [, ent] of this.colony.cellsByKey) {
        const st = ent.get(CellStateComponent)!;
        if (st.built && st.cellType === "brood" && st.stage === "empty") {
          st.stage = "egg";
          st.eggTimerMs = COLONY.eggDurationMs;
          break;
        }
      }
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
          st.larvaeFoodRemaining = COLONY.larvaeFoodNeeded;
          this.colony.events.emit({ type: "BroodLarvaeReady", cellKey: key });
        }
      } else if (st.stage === "larvae" && st.larvaeFoodRemaining > 0) {
        if (
          res.pollen >= COLONY.pollenPerFeedUnit &&
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
        }
      }
    }

    this.processFeedJobs(elapsed, res);
  }

  private processFeedJobs(
    elapsed: number,
    res: { pollen: number; honey: number },
  ): void {
    for (const je of this.world.entities) {
      const job = je.get(JobComponent);
      if (!job || job.kind !== "feedLarvae" || job.status === "done") {
        continue;
      }
      const key = hiveKey({
        q: job.targetQ,
        r: job.targetR,
        level: job.targetLevel,
      });
      const cellEnt = this.colony.getCellAt(key);
      if (!cellEnt) {
        continue;
      }
      const st = cellEnt.get(CellStateComponent)!;
      const center = hexToWorld({ q: job.targetQ, r: job.targetR }, COLONY.hexSize);
      let fed = false;
      for (const id of job.reservedBeeIds) {
        const bee = findEntityById(this.world, id);
        if (bee && bee.pos.sub(center).size < 45) {
          fed = true;
        }
      }
      if (fed) {
        if (res.pollen >= COLONY.pollenPerFeedUnit) {
          res.pollen -= COLONY.pollenPerFeedUnit;
        } else if (res.honey >= COLONY.honeyPerFeedUnit) {
          res.honey -= COLONY.honeyPerFeedUnit;
        } else {
          continue;
        }
        st.larvaeFoodRemaining = Math.max(
          0,
          st.larvaeFoodRemaining - COLONY.feedAmountPerVisit,
        );
        if (st.larvaeFoodRemaining <= 0) {
          st.stage = "sealed";
          st.sealedTimerMs = COLONY.sealedDurationMs;
          this.colony.events.emit({ type: "BroodFed", cellKey: key });
        }
        job.status = "done";
        releaseJob(this.world, job);
        je.kill();
      }
    }
  }
}
