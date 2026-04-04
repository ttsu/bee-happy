import { System, SystemPriority, SystemType, type World } from "excalibur";
import { getActiveColonyConstants } from "../../colony-active-constants";
import { daysPerYearFromSeasonLength } from "../../game-settings";
import type { ColonyRuntime } from "../../colony-runtime";
import {
  CellStateComponent,
  ColonyTimeComponent,
  JobComponent,
  YearlyStatsComponent,
} from "../components/colony-components";
import { getSeasonForColonyDay } from "../../seasons";
import { releaseJobBees } from "../job-release";

/** Serialized {@link SeasonSystem} fields that are not derived from colony time. */
export type SeasonSystemSave = {
  prevColonyDay: number;
  lastNectarPurgeCycleIndex: number | null;
};

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

  getStateForSave(): SeasonSystemSave {
    return {
      prevColonyDay: this.prevColonyDay,
      lastNectarPurgeCycleIndex: this.lastNectarPurgeCycleIndex,
    };
  }

  applyStateFromLoad(state: SeasonSystemSave): void {
    this.prevColonyDay = state.prevColonyDay;
    this.lastNectarPurgeCycleIndex = state.lastNectarPurgeCycleIndex;
  }

  /** Resets season tracking when the hive resets after queen succession. */
  resetForNewColony(): void {
    this.prevColonyDay = 0;
    this.lastNectarPurgeCycleIndex = null;
  }

  override update(_elapsed: number): void {
    const time = this.colony.controllerEntity.get(ColonyTimeComponent);
    const yearly = this.colony.controllerEntity.get(YearlyStatsComponent);
    if (!time || !yearly) {
      return;
    }

    const colonyConstants = getActiveColonyConstants();
    const msPerBeeDay = colonyConstants.workerLifespanMs / 50;
    const currentColonyDay = Math.floor(time.colonyElapsedMs / msPerBeeDay) + 1;
    const daysPerSeason = this.colony.daysPerSeason;
    const daysPerYear = daysPerYearFromSeasonLength(daysPerSeason);

    const info = getSeasonForColonyDay(currentColonyDay, daysPerSeason);

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
        this.prevColonyDay % daysPerYear === 0 && currentColonyDay > this.prevColonyDay;

      if (!yearly.isYearReviewOpen && crossedYear) {
        if (
          this.colony.lineageSystemEnabled &&
          yearly.yearNumber === colonyConstants.queenAgeOutYearNumber
        ) {
          this.colony.triggerMandatorySuccession("queenAgedOut");
        } else {
          yearly.remainingBeesAtYearEnd = this.countBees();
          yearly.isYearReviewOpen = true;
          this.colony.emitUiSnapshotImmediate();
        }
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
