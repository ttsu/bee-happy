import { System, SystemPriority, SystemType, type World } from "excalibur";
import { COLONY } from "../../constants";
import type { ColonyRuntime } from "../../colony-runtime";
import {
  CellStateComponent,
  ColonyTimeComponent,
  JobComponent,
  YearlyStatsComponent,
} from "../components/colony-components";
import { getSeasonForColonyDay } from "../../seasons";
import { releaseJobBees } from "../job-release";

/**
 * Winter nectar expiry, year boundary detection, and opening the end-of-year review.
 */
export class SeasonSystem extends System {
  static override priority = SystemPriority.Higher;
  public readonly systemType = SystemType.Update;

  private prevColonyDay = 0;
  private lastNectarPurgeCycleIndex: number | null = null;

  constructor(
    public world: World,
    private readonly colony: ColonyRuntime,
  ) {
    super();
  }

  override update(_elapsed: number): void {
    const time = this.colony.controllerEntity.get(ColonyTimeComponent);
    const yearly = this.colony.controllerEntity.get(YearlyStatsComponent);
    if (!time || !yearly) {
      return;
    }

    const msPerBeeDay = COLONY.workerLifespanMs / 50;
    const currentColonyDay = Math.floor(time.colonyElapsedMs / msPerBeeDay) + 1;

    const info = getSeasonForColonyDay(currentColonyDay);

    if (
      info.season === "Winter" &&
      info.seasonDayOneBased === 5 &&
      this.lastNectarPurgeCycleIndex !== info.cycleIndex
    ) {
      this.purgeNectarInCells();
      this.lastNectarPurgeCycleIndex = info.cycleIndex;
    }

    if (this.prevColonyDay !== 0) {
      const crossedYear =
        this.prevColonyDay % 60 === 0 &&
        currentColonyDay > this.prevColonyDay;

      if (!yearly.isYearReviewOpen && crossedYear) {
        yearly.remainingBeesAtYearEnd = this.countBees();
        yearly.isYearReviewOpen = true;
        this.colony.emitUiSnapshotImmediate();
      }
    }

    this.prevColonyDay = currentColonyDay;
  }

  private countBees(): number {
    return this.colony.scene.actors.length;
  }

  /**
   * Clears nectar in all built nectar cells; honey is unchanged. Cancels honey processing jobs.
   */
  private purgeNectarInCells(): void {
    for (const [, ent] of this.colony.cellsByKey) {
      const st = ent.get(CellStateComponent)!;
      if (!st.built || st.cellType !== "nectar") {
        continue;
      }
      st.nectarStored = 0;
      st.honeyProcessingProgress = 0;
      st.honeyProcessingDirty = false;
    }

    for (const e of this.world.entities) {
      const job = e.get(JobComponent);
      if (!job || job.kind !== "honeyProcess" || job.status === "done") {
        continue;
      }
      releaseJobBees(this.world, job);
      e.kill();
    }
  }
}
