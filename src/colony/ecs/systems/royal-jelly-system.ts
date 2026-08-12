import { System, SystemPriority, SystemType, type World } from "excalibur";
import {
  ColonyTimeComponent,
  RoyalJellyComponent,
} from "../components/colony-components";
import { getActiveColonyConstants } from "../../colony-active-constants";
import type { ColonyRuntime } from "../../colony-runtime";
import { computeHappinessPct } from "../../happiness";
import {
  accrueRoyalJellyFromBuffer,
  royalJellyPerDayFromHappiness,
} from "../../royal-jelly";
import { getMsPerBeeDay } from "../../worker-lifecycle";

/**
 * Accrues royal jelly once per colony day from happiness into a fractional buffer.
 */
export class RoyalJellySystem extends System {
  static override priority = SystemPriority.Higher;
  public readonly systemType = SystemType.Update;

  constructor(
    public world: World,
    private readonly colony: ColonyRuntime,
  ) {
    super();
  }

  override update(_elapsed: number): void {
    if (this.colony.isSimulationPaused() || !this.colony.lineageSystemEnabled) {
      return;
    }
    const jelly = this.colony.controllerEntity.get(RoyalJellyComponent);
    const time = this.colony.controllerEntity.get(ColonyTimeComponent);
    if (!jelly || !time) {
      return;
    }
    const currentDay = Math.floor(time.colonyElapsedMs / getMsPerBeeDay()) + 1;
    if (currentDay <= jelly.lastAccruedColonyDay) {
      return;
    }
    const C = getActiveColonyConstants();
    const happinessPct = computeHappinessPct(this.colony);
    const perDay = royalJellyPerDayFromHappiness(
      happinessPct,
      C.royalJellyPercentOfHappiness,
    );
    const daysElapsed = currentDay - jelly.lastAccruedColonyDay;
    const accrued = accrueRoyalJellyFromBuffer(
      jelly.stored,
      jelly.accrualBuffer,
      perDay,
      daysElapsed,
    );
    jelly.stored = accrued.stored;
    jelly.accrualBuffer = accrued.buffer;
    jelly.lastAccruedColonyDay = currentDay;
  }
}
