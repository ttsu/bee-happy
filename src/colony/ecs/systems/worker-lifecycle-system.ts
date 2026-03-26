import { System, SystemPriority, SystemType, type World } from "excalibur";
import { COLONY } from "../../constants";
import type { ColonyRuntime } from "../../colony-runtime";
import {
  BeeAgeComponent,
  BeeRoleComponent,
  ColonyTimeComponent,
} from "../components/colony-components";
import { releaseBeeFromAllJobs } from "../job-release";

/**
 * Advances colony clock, worker age, and removes workers that exceeded lifespan.
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
    const time = this.colony.controllerEntity.get(ColonyTimeComponent);
    if (time) {
      time.colonyElapsedMs += elapsed;
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
