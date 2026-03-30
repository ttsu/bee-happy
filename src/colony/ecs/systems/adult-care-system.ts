import { System, SystemPriority, SystemType, type World } from "excalibur";
import { asActor } from "../../actor-utils";
import {
  BeeNeedsComponent,
  BeeRoleComponent,
  CellStateComponent,
  JobComponent,
} from "../components/colony-components";
import { COLONY } from "../../constants";
import type { ColonyRuntime } from "../../colony-runtime";
import { hiveKey } from "../../../grid/hive-levels";
import { hexToWorld } from "../../../grid/hex-grid";
import { JobPriority } from "../../job-priority";
import {
  nectarCellHasHoneyForFeeding,
  nectarCellHasNectarForFeeding,
} from "../../nectar-cell-helpers";
import { releaseJobBees } from "../job-release";

const findEntityById = (world: World, id: number) =>
  asActor(world.entities.find((e) => e.id === id));

const releaseJob = (world: World, job: JobComponent): void => {
  releaseJobBees(world, job);
};

const hasCareJob = (
  world: World,
  kind: "adultFeed" | "waterDeliver" | "feedQueen",
  targetBeeId: number,
): boolean =>
  world.entities.some((e) => {
    const j = e.get(JobComponent);
    return (
      j &&
      j.kind === kind &&
      j.status !== "done" &&
      j.adultFeedTargetBeeId === targetBeeId
    );
  });

/**
 * Hunger, thirst, self-feeding workers, queen royal jelly, water delivery, and honey-processing preemption.
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
    if (this.colony.isSimulationPaused()) {
      return;
    }
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
      const role = actor.get(BeeRoleComponent);
      if (!needs || !role) {
        continue;
      }
      if (role.role === "queen") {
        if (
          needs.hunger > COLONY.hungerCareThreshold &&
          !hasCareJob(this.world, "feedQueen", actor.id)
        ) {
          const j = new JobComponent("feedQueen", JobPriority.feedQueen, 0, 0, 0, 1);
          j.adultFeedTargetBeeId = actor.id;
          this.colony.createJob(j);
        }
      } else if (role.role === "worker") {
        if (
          needs.hunger > COLONY.hungerCareThreshold &&
          !hasCareJob(this.world, "adultFeed", actor.id)
        ) {
          const j = new JobComponent("adultFeed", JobPriority.adultFeed, 0, 0, 0, 1);
          j.adultFeedTargetBeeId = actor.id;
          this.colony.createJob(j);
        }
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
        this.tryAdultFeed(ent, job);
      } else if (job.kind === "waterDeliver") {
        this.tryWater(ent, job);
      } else if (job.kind === "feedQueen") {
        this.tryFeedQueen(ent, job, elapsed);
      }
    }
  }

  private tryAdultFeed(ent: import("excalibur").Entity, job: JobComponent): void {
    const targetId = job.adultFeedTargetBeeId;
    const worker = job.reservedBeeIds[0]
      ? findEntityById(this.world, job.reservedBeeIds[0]!)
      : undefined;
    if (!targetId || !worker || targetId !== worker.id) {
      return;
    }
    const center = hexToWorld({ q: job.targetQ, r: job.targetR }, COLONY.hexSize);
    if (worker.pos.sub(center).size > COLONY.selfFeedWorkRadiusPx) {
      return;
    }
    if (!this.consumeSelfFeed(job)) {
      return;
    }
    const n = worker.get(BeeNeedsComponent)!;
    n.hunger = Math.max(0, n.hunger - COLONY.hungerRelief);
    job.status = "done";
    releaseJob(this.world, job);
    ent.kill();
  }

  /**
   * Consumes one feeding worth of food from preferred cell, then global fallbacks.
   */
  private consumeSelfFeed(job: JobComponent): boolean {
    if (job.selfFeedCellKey && this.tryConsumeCellNectarAtKey(job.selfFeedCellKey)) {
      return true;
    }
    if (job.selfFeedCellKey && this.tryConsumeCellHoneyAtKey(job.selfFeedCellKey)) {
      return true;
    }
    if (this.tryConsumeCellNectar()) {
      return true;
    }
    if (this.tryConsumeCellHoney()) {
      return true;
    }
    if (this.interruptHoneyForNectar()) {
      if (!this.tryConsumeCellNectar()) {
        return false;
      }
      return true;
    }
    if (job.selfFeedCellKey && this.tryConsumePollenAtKey(job.selfFeedCellKey)) {
      return true;
    }
    if (this.tryConsumePollenAny()) {
      return true;
    }
    return false;
  }

  private tryConsumeCellNectarAtKey(key: string): boolean {
    const cell = this.colony.getCellAt(key);
    if (!cell) {
      return false;
    }
    const st = cell.get(CellStateComponent)!;
    if (nectarCellHasNectarForFeeding(st, COLONY.adultFeedCellNectarCost)) {
      st.nectarStored -= COLONY.adultFeedCellNectarCost;
      return true;
    }
    return false;
  }

  private tryConsumeCellHoneyAtKey(key: string): boolean {
    const cell = this.colony.getCellAt(key);
    if (!cell) {
      return false;
    }
    const st = cell.get(CellStateComponent)!;
    if (nectarCellHasHoneyForFeeding(st, COLONY.adultFeedHoneyCost)) {
      st.honeyStored -= COLONY.adultFeedHoneyCost;
      return true;
    }
    return false;
  }

  private tryConsumePollenAtKey(key: string): boolean {
    const cell = this.colony.getCellAt(key);
    if (!cell) {
      return false;
    }
    const st = cell.get(CellStateComponent)!;
    if (
      st.built &&
      st.cellType === "pollen" &&
      st.pollenStored >= COLONY.adultFeedPollenCost
    ) {
      st.pollenStored -= COLONY.adultFeedPollenCost;
      return true;
    }
    return false;
  }

  private tryConsumePollenAny(): boolean {
    for (const [, e] of this.colony.cellsByKey) {
      const st = e.get(CellStateComponent)!;
      if (
        st.built &&
        st.cellType === "pollen" &&
        st.pollenStored >= COLONY.adultFeedPollenCost
      ) {
        st.pollenStored -= COLONY.adultFeedPollenCost;
        return true;
      }
    }
    return false;
  }

  private tryFeedQueen(
    ent: import("excalibur").Entity,
    job: JobComponent,
    elapsed: number,
  ): void {
    const queen = job.adultFeedTargetBeeId
      ? findEntityById(this.world, job.adultFeedTargetBeeId)
      : undefined;
    const worker = job.reservedBeeIds[0]
      ? findEntityById(this.world, job.reservedBeeIds[0]!)
      : undefined;
    if (!queen || !worker) {
      return;
    }
    if (worker.pos.sub(queen.pos).size > 38) {
      job.feedQueenTimerMs = 0;
      return;
    }
    job.feedQueenTimerMs += elapsed;
    if (job.feedQueenTimerMs < COLONY.feedQueenDurationMs) {
      return;
    }
    const n = queen.get(BeeNeedsComponent)!;
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
