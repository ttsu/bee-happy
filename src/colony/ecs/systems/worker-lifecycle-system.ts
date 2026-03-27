import { System, SystemPriority, SystemType, type World } from "excalibur";
import { COLONY } from "../../constants";
import type { ColonyRuntime } from "../../colony-runtime";
import {
  BeeAgeComponent,
  BeeNeedsComponent,
  BeeRoleComponent,
  ColonyTimeComponent,
  YearlyStatsComponent,
} from "../components/colony-components";
import { releaseBeeFromAllJobs } from "../job-release";

/**
 * Advances colony clock, worker age, happy-bee-seconds tally, and removes workers that exceeded lifespan.
 */
export class WorkerLifecycleSystem extends System {
  static override priority = SystemPriority.Highest;
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

    const time = this.colony.controllerEntity.get(ColonyTimeComponent);
    const yearly = this.colony.controllerEntity.get(YearlyStatsComponent);
    if (time) {
      time.colonyElapsedMs += elapsed;
    }

    if (yearly) {
      const sec = elapsed / 1000;
      for (const actor of this.colony.scene.actors) {
        const needs = actor.get(BeeNeedsComponent);
        if (!needs) {
          continue;
        }
        if (
          needs.hunger <= COLONY.happyHungerMax &&
          needs.thirst <= COLONY.happyThirstMax
        ) {
          yearly.happyBeeSecondsTotal += sec;
        }
      }
    }

    for (const actor of this.colony.scene.actors) {
      const role = actor.get(BeeRoleComponent);
      const age = actor.get(BeeAgeComponent);
      if (role?.role !== "worker" || !age) {
        continue;
      }
      age.ageMs += elapsed;
      if (age.ageMs >= COLONY.workerLifespanMs) {
        releaseBeeFromAllJobs(this.world, actor.id);
        actor.kill();
      }
    }
  }
}
