import { System, SystemPriority, SystemType, type World } from "excalibur";
import { asActor } from "../../actor-utils";
import {
  BeeLevelComponent,
  BeeWorkComponent,
  JobComponent,
} from "../components/colony-components";
import { COLONY } from "../../constants";
import type { ColonyRuntime } from "../../colony-runtime";
import { hexToWorld } from "../../../grid/hex-grid";

const findEntityById = (world: World, id: number) =>
  asActor(world.entities.find((e) => e.id === id));

/**
 * Moves reserved bees along shared job paths.
 */
export class MovementSystem extends System {
  static override priority = SystemPriority.Average;
  public readonly systemType = SystemType.Update;

  constructor(
    public world: World,
    private readonly colony: ColonyRuntime,
  ) {
    super();
  }

  override update(elapsed: number): void {
    for (const actor of this.colony.scene.actors) {
      const w = actor.get(BeeWorkComponent);
      if (!w?.currentJobEntityId) {
        continue;
      }
      const jobEnt = findEntityById(this.world, w.currentJobEntityId);
      if (!jobEnt) {
        continue;
      }
      const job = jobEnt.get(JobComponent)!;
      if (job.status === "done") {
        continue;
      }
      if (
        job.kind === "foragePollen" ||
        job.kind === "forageNectar" ||
        job.kind === "forageWater"
      ) {
        continue;
      }
      if (job.kind === "adultFeed" || job.kind === "waterDeliver") {
        const target = job.adultFeedTargetBeeId
          ? findEntityById(this.world, job.adultFeedTargetBeeId)
          : undefined;
        if (target) {
          const to = target.pos.sub(actor.pos);
          const step = COLONY.beeSpeed * elapsed;
          if (to.size > step + 2) {
            actor.pos = actor.pos.add(to.normalize().scale(step));
          } else {
            actor.pos = target.pos.clone();
          }
        }
        continue;
      }
      if (!job.pathPoints.length) {
        continue;
      }
      const idx = Math.min(w.pathIndex, job.pathPoints.length - 1);
      const target = job.pathPoints[idx]!;
      const to = target.sub(actor.pos);
      const dist = to.size;
      const step = COLONY.beeSpeed * elapsed;
      if (dist <= step + 2) {
        actor.pos = target.clone();
        if (w.pathIndex < job.pathPoints.length - 1) {
          w.pathIndex += 1;
        }
      } else {
        actor.pos = actor.pos.add(to.normalize().scale(step));
      }
      const lvl = actor.get(BeeLevelComponent)!;
      if (lvl.level !== job.targetLevel) {
        lvl.level = job.targetLevel;
      }
      const cellCenter = hexToWorld({ q: job.targetQ, r: job.targetR }, COLONY.hexSize);
      if (actor.pos.sub(cellCenter).size < COLONY.buildReachPx * 0.4) {
        lvl.level = job.targetLevel;
      }
    }
  }
}
