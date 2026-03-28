import type { ColonyRuntime } from "../colony-runtime";
import { hiveKey } from "../../grid/hive-levels";
import { COLONY } from "../constants";
import { CellStateComponent, type JobComponent } from "./components/colony-components";

/**
 * Returns a 0–1 score used as a secondary sort key in `JobAssignmentSystem`:
 * higher means more in-progress work to finish before starting another job of the same priority.
 *
 * When a bee dies, reservations clear and the job reopens; without this tie-break, another
 * open job of the same kind can be ordered first arbitrarily.
 */
export const jobResumeSortWeight = (
  colony: ColonyRuntime,
  job: JobComponent,
): number => {
  const key = hiveKey({
    q: job.targetQ,
    r: job.targetR,
    level: job.targetLevel,
  });
  const cellEnt = colony.getCellAt(key);
  const st = cellEnt?.get(CellStateComponent);

  switch (job.kind) {
    case "buildCell": {
      if (st && !st.built && st.buildProgress > 0 && st.buildProgress < 1) {
        return st.buildProgress;
      }
      return 0;
    }
    case "honeyProcess": {
      if (st && st.honeyProcessingProgress > 0 && st.honeyProcessingProgress < 1) {
        return st.honeyProcessingProgress;
      }
      return 0;
    }
    case "cleanBrood": {
      if (
        st &&
        st.stage === "cleaning" &&
        st.cleaningTimerMs > 0 &&
        st.cleaningTimerMs < COLONY.cleaningDurationMs
      ) {
        return (
          (COLONY.cleaningDurationMs - st.cleaningTimerMs) / COLONY.cleaningDurationMs
        );
      }
      return 0;
    }
    case "feedLarvae": {
      let w = 0;
      if (st?.stage === "larvae") {
        const p = COLONY.larvaePollenUnitsNeeded;
        const n = COLONY.larvaeNectarUnitsNeeded;
        const done = p - st.larvaePollenRemaining + (n - st.larvaeNectarRemaining);
        const total = p + n;
        if (done > 0 && done < total) {
          w = done / total;
        }
      }
      if (
        job.feedLarvaePhase === "collecting" ||
        job.feedLarvaePhase === "toDeliver" ||
        job.feedLarvaePhase === "depositing"
      ) {
        return Math.max(w, 0.75);
      }
      return w;
    }
    case "layEgg": {
      if (job.layEggTimerMs > 0 && job.layEggTimerMs < COLONY.queenLayDurationMs) {
        return (
          (COLONY.queenLayDurationMs - job.layEggTimerMs) / COLONY.queenLayDurationMs
        );
      }
      return 0;
    }
    case "guardHive": {
      if (
        job.guardHiveTimerMs > 0 &&
        job.guardHiveTimerMs < COLONY.guardHiveDurationMs
      ) {
        return job.guardHiveTimerMs / COLONY.guardHiveDurationMs;
      }
      return 0;
    }
    case "clearCellForRetype": {
      return job.retypePhase === "clearing" ? 0.5 : 0;
    }
    default:
      return 0;
  }
};
