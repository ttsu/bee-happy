import { System, SystemPriority, SystemType, type World } from "excalibur";
import { asActor } from "../../actor-utils";
import {
  BeeNeedsComponent,
  BeeWorkComponent,
  CellStateComponent,
  ColonyResourcesComponent,
  JobComponent,
} from "../components/colony-components";
import { COLONY } from "../../constants";
import type { ColonyRuntime } from "../../colony-runtime";
import { hiveKey } from "../../../grid/hive-levels";
import { JobPriority } from "../../job-priority";
import {
  nectarCellHasHoneyForFeeding,
  nectarCellHasNectarForFeeding,
} from "../../nectar-cell-helpers";

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

const hasCareJob = (
  world: World,
  kind: "adultFeed" | "waterDeliver",
  beeId: number,
): boolean =>
  world.entities.some((e) => {
    const j = e.get(JobComponent);
    return (
      j && j.kind === kind && j.status !== "done" && j.adultFeedTargetBeeId === beeId
    );
  });

/**
 * Hunger, thirst, adult feeding, water delivery, and honey-processing preemption for nectar in cells.
 */
export class AdultCareSystem extends System {
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
    const ms = elapsed / 1000;
    for (const actor of this.colony.scene.actors) {
      const needs = actor.get(BeeNeedsComponent);
      if (!needs) {
        continue;
      }
      needs.hunger = Math.min(100, needs.hunger + COLONY.hungerPerSec * ms);
      needs.thirst = Math.min(100, needs.thirst + COLONY.thirstPerSec * ms);
    }

    for (const actor of this.colony.scene.actors) {
      const needs = actor.get(BeeNeedsComponent);
      if (!needs) {
        continue;
      }
      if (
        needs.hunger > COLONY.hungerCareThreshold &&
        !hasCareJob(this.world, "adultFeed", actor.id)
      ) {
        const j = new JobComponent("adultFeed", JobPriority.adultFeed, 0, 0, 0, 1);
        j.adultFeedTargetBeeId = actor.id;
        this.colony.createJob(j);
      }
      if (
        needs.thirst > COLONY.thirstCareThreshold &&
        !hasCareJob(this.world, "waterDeliver", actor.id)
      ) {
        const j = new JobComponent(
          "waterDeliver",
          JobPriority.waterDeliver,
          0,
          0,
          0,
          1,
        );
        j.adultFeedTargetBeeId = actor.id;
        this.colony.createJob(j);
      }
    }

    for (const ent of this.world.entities) {
      const job = ent.get(JobComponent);
      if (!job || job.status === "done") {
        continue;
      }
      if (job.kind === "adultFeed") {
        this.tryAdultFeed(ent, job, res);
      } else if (job.kind === "waterDeliver") {
        this.tryWater(ent, job);
      }
    }
  }

  private tryAdultFeed(
    ent: import("excalibur").Entity,
    job: JobComponent,
    res: ColonyResourcesComponent,
  ): void {
    const target = job.adultFeedTargetBeeId
      ? findEntityById(this.world, job.adultFeedTargetBeeId)
      : undefined;
    const worker = job.reservedBeeIds[0]
      ? findEntityById(this.world, job.reservedBeeIds[0]!)
      : undefined;
    if (!target || !worker) {
      return;
    }
    if (worker.pos.sub(target.pos).size > 38) {
      return;
    }
    if (res.colonyNectar >= COLONY.adultFeedColonyNectarCost) {
      res.colonyNectar -= COLONY.adultFeedColonyNectarCost;
    } else if (this.tryConsumeCellNectar()) {
      /* consumed stored nectar */
    } else if (this.tryConsumeCellHoney()) {
      /* consumed cell honey (nutrient-dense vs nectar) */
    } else if (this.interruptHoneyForNectar()) {
      if (!this.tryConsumeCellNectar()) {
        return;
      }
    } else {
      return;
    }
    const n = target.get(BeeNeedsComponent)!;
    n.hunger = Math.max(0, n.hunger - COLONY.hungerRelief);
    job.status = "done";
    releaseJob(this.world, job);
    ent.kill();
  }

  private tryWater(ent: import("excalibur").Entity, job: JobComponent): void {
    const target = job.adultFeedTargetBeeId
      ? findEntityById(this.world, job.adultFeedTargetBeeId)
      : undefined;
    const worker = job.reservedBeeIds[0]
      ? findEntityById(this.world, job.reservedBeeIds[0]!)
      : undefined;
    if (!target || !worker) {
      return;
    }
    if (worker.pos.sub(target.pos).size > 38) {
      return;
    }
    const n = target.get(BeeNeedsComponent)!;
    n.thirst = Math.max(0, n.thirst - COLONY.thirstRelief);
    job.status = "done";
    releaseJob(this.world, job);
    ent.kill();
  }

  private tryConsumeCellNectar(): boolean {
    for (const [, e] of this.colony.cellsByKey) {
      const st = e.get(CellStateComponent)!;
      if (nectarCellHasNectarForFeeding(st, COLONY.adultFeedCellNectarCost)) {
        st.nectarStored -= COLONY.adultFeedCellNectarCost;
        return true;
      }
    }
    return false;
  }

  private tryConsumeCellHoney(): boolean {
    for (const [, e] of this.colony.cellsByKey) {
      const st = e.get(CellStateComponent)!;
      if (nectarCellHasHoneyForFeeding(st, COLONY.adultFeedHoneyCost)) {
        st.honeyStored -= COLONY.adultFeedHoneyCost;
        return true;
      }
    }
    return false;
  }

  private interruptHoneyForNectar(): boolean {
    for (const e of this.world.entities) {
      const j = e.get(JobComponent);
      if (!j || j.kind !== "honeyProcess" || j.status === "done") {
        continue;
      }
      const key = hiveKey({
        q: j.targetQ,
        r: j.targetR,
        level: j.targetLevel,
      });
      const cell = this.colony.getCellAt(key);
      if (!cell) {
        continue;
      }
      const st = cell.get(CellStateComponent)!;
      if (nectarCellHasNectarForFeeding(st, COLONY.adultFeedCellNectarCost)) {
        st.nectarStored -= COLONY.adultFeedCellNectarCost;
        st.honeyProcessingDirty = true;
        this.colony.events.emit({
          type: "HoneyProcessingInterrupted",
          cellKey: key,
        });
        j.status = "done";
        releaseJob(this.world, j);
        e.kill();
        return true;
      }
    }
    return false;
  }
}
