import { System, SystemPriority, SystemType, type World } from "excalibur";
import { BeeswaxComponent } from "../components/colony-components";
import { beeswaxAccrualPerSec, beeswaxCapacity } from "../../beeswax";
import { getActiveColonyConstants } from "../../colony-active-constants";
import type { ColonyRuntime } from "../../colony-runtime";

/**
 * Passively accrues hive beeswax proportional to worker count, capped per worker.
 */
export class BeeswaxSystem extends System {
  static override priority = SystemPriority.Higher;
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
    const wax = this.colony.controllerEntity.get(BeeswaxComponent);
    if (!wax) {
      return;
    }
    const C = getActiveColonyConstants();
    const workers = this.colony.countWorkers();
    const cap = beeswaxCapacity(workers, C);
    wax.stored = Math.min(
      cap,
      wax.stored + beeswaxAccrualPerSec(workers, C) * (elapsed / 1000),
    );
  }
}
