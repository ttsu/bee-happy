import { System, SystemPriority, SystemType, type World } from "excalibur";
import { asActor } from "../../actor-utils";
import {
  BeeLevelComponent,
  BeeNeedsComponent,
  BeeRoleComponent,
  CellStateComponent,
  JobComponent,
} from "../components/colony-components";
import { getActiveColonyConstants } from "../../colony-active-constants";
import type { ColonyRuntime } from "../../colony-runtime";
import { scaledWorkElapsed } from "../../bee-efficiency";
import { hiveKey } from "../../../grid/hive-levels";
import { hexToWorld } from "../../../grid/hex-grid";
import { JobPriority } from "../../job-priority";
import {
  nectarCellHasHoneyForFeeding,
  nectarCellHasNectarForFeeding,
} from "../../nectar-cell-helpers";
import { releaseJobBees } from "../job-release";
import type { ResourceKind } from "../../../render/resource-dots";

type AdultFeedConsume = {
  kind: ResourceKind;
  count: number;
  cellKey: string;
};

const findEntityById = (world: World, id: number) =>
  asActor(world.entities.find((e) => e.id === id));

const releaseJob = (world: World, job: JobComponent): void => {
  releaseJobBees(world, job);
};

const hasCareJob = (
  world: World,
  kind: "adultFeed" | "feedQueen",
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
 * Hunger, self-feeding workers, queen royal jelly, and honey-processing preemption.
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
    const C = getActiveColonyConstants();
    const ms = elapsed / 1000;
    for (const actor of this.colony.scene.actors) {
      const needs = actor.get(BeeNeedsComponent);
      if (!needs) {
        continue;
      }
      needs.hunger = Math.min(100, needs.hunger + C.hungerPerSec * ms);
      const roleAfter = actor.get(BeeRoleComponent);
      if (
        roleAfter?.role === "queen" &&
        !this.colony.lineageSystemEnabled &&
        needs.hunger >= 99
      ) {
        needs.hunger = 99;
      }
    }

    for (const actor of this.colony.scene.actors) {
      const needs = actor.get(BeeNeedsComponent);
      const role = actor.get(BeeRoleComponent);
      if (
        this.colony.lineageSystemEnabled &&
        role?.role === "queen" &&
        needs &&
        needs.hunger >= 100 &&
        !this.colony.successionModal
      ) {
        this.colony.triggerMandatorySuccession("queenStarved");
        return;
      }
    }

    for (const actor of this.colony.scene.actors) {
      const needs = actor.get(BeeNeedsComponent);
      const role = actor.get(BeeRoleComponent);
      if (!needs || !role) {
        continue;
      }
      if (role.role === "queen") {
        if (
          needs.hunger > C.hungerCareThreshold &&
          !hasCareJob(this.world, "feedQueen", actor.id)
        ) {
          const j = new JobComponent("feedQueen", JobPriority.feedQueen, 0, 0, 0, 1);
          j.adultFeedTargetBeeId = actor.id;
          this.colony.createJob(j);
        }
      } else if (role.role === "worker") {
        if (
          needs.hunger > C.hungerCareThreshold &&
          !hasCareJob(this.world, "adultFeed", actor.id)
        ) {
          const j = new JobComponent("adultFeed", JobPriority.adultFeed, 0, 0, 0, 1);
          j.adultFeedTargetBeeId = actor.id;
          this.colony.createJob(j);
        }
      }
    }

    for (const ent of this.world.entities) {
      const job = ent.get(JobComponent);
      if (!job || job.status === "done") {
        continue;
      }
      if (job.kind === "adultFeed") {
        this.tryAdultFeed(ent, job);
      } else if (job.kind === "feedQueen") {
        this.tryFeedQueen(ent, job, elapsed);
      }
    }
  }

  private tryAdultFeed(ent: import("excalibur").Entity, job: JobComponent): void {
    const C = getActiveColonyConstants();
    const targetId = job.adultFeedTargetBeeId;
    const worker = job.reservedBeeIds[0]
      ? findEntityById(this.world, job.reservedBeeIds[0]!)
      : undefined;
    if (!targetId || !worker || targetId !== worker.id) {
      return;
    }
    const center = hexToWorld({ q: job.targetQ, r: job.targetR }, C.hexSize);
    if (worker.pos.sub(center).size > C.selfFeedWorkRadiusPx) {
      return;
    }
    const feedLevel = worker.get(BeeLevelComponent);
    if (!feedLevel || feedLevel.level !== job.targetLevel) {
      return;
    }
    const consumed = this.consumeSelfFeed(job);
    if (!consumed) {
      return;
    }
    this.colony.resourceDots.spawnTransfer({
      kind: consumed.kind,
      count: consumed.count,
      from: { type: "cell", cellKey: consumed.cellKey },
      to: { type: "bee", beeId: worker.id },
      mode: "consume",
      colony: this.colony,
    });
    const n = worker.get(BeeNeedsComponent)!;
    n.hunger = Math.max(0, n.hunger - C.hungerRelief);
    job.status = "done";
    releaseJob(this.world, job);
    ent.kill();
  }

  /**
   * Consumes one feeding worth of food from preferred cell, then global fallbacks.
   */
  private consumeSelfFeed(job: JobComponent): AdultFeedConsume | null {
    if (job.selfFeedCellKey) {
      const nectar = this.tryConsumeCellNectarAtKey(job.selfFeedCellKey);
      if (nectar) {
        return nectar;
      }
    }
    if (job.selfFeedCellKey) {
      const honey = this.tryConsumeCellHoneyAtKey(job.selfFeedCellKey);
      if (honey) {
        return honey;
      }
    }
    const nectarAny = this.tryConsumeCellNectar();
    if (nectarAny) {
      return nectarAny;
    }
    const honeyAny = this.tryConsumeCellHoney();
    if (honeyAny) {
      return honeyAny;
    }
    if (this.interruptHoneyForNectar()) {
      const nectarAfter = this.tryConsumeCellNectar();
      if (!nectarAfter) {
        return null;
      }
      return nectarAfter;
    }
    if (job.selfFeedCellKey) {
      const pollen = this.tryConsumePollenAtKey(job.selfFeedCellKey);
      if (pollen) {
        return pollen;
      }
    }
    return this.tryConsumePollenAny();
  }

  private tryConsumeCellNectarAtKey(key: string): AdultFeedConsume | null {
    const C = getActiveColonyConstants();
    const cell = this.colony.getCellAt(key);
    if (!cell) {
      return null;
    }
    const st = cell.get(CellStateComponent)!;
    if (nectarCellHasNectarForFeeding(st, C.adultFeedCellNectarCost)) {
      st.nectarStored -= C.adultFeedCellNectarCost;
      return {
        kind: "nectar",
        count: C.adultFeedCellNectarCost,
        cellKey: key,
      };
    }
    return null;
  }

  private tryConsumeCellHoneyAtKey(key: string): AdultFeedConsume | null {
    const C = getActiveColonyConstants();
    const cell = this.colony.getCellAt(key);
    if (!cell) {
      return null;
    }
    const st = cell.get(CellStateComponent)!;
    if (nectarCellHasHoneyForFeeding(st, C.adultFeedHoneyCost)) {
      st.honeyStored -= C.adultFeedHoneyCost;
      return {
        kind: "honey",
        count: C.adultFeedHoneyCost,
        cellKey: key,
      };
    }
    return null;
  }

  private tryConsumePollenAtKey(key: string): AdultFeedConsume | null {
    const C = getActiveColonyConstants();
    const cell = this.colony.getCellAt(key);
    if (!cell) {
      return null;
    }
    const st = cell.get(CellStateComponent)!;
    if (
      st.built &&
      st.cellType === "pollen" &&
      st.pollenStored >= C.adultFeedPollenCost
    ) {
      st.pollenStored -= C.adultFeedPollenCost;
      return {
        kind: "pollen",
        count: C.adultFeedPollenCost,
        cellKey: key,
      };
    }
    return null;
  }

  private tryConsumePollenAny(): AdultFeedConsume | null {
    const C = getActiveColonyConstants();
    for (const [key, e] of this.colony.cellsByKey) {
      const st = e.get(CellStateComponent)!;
      if (
        st.built &&
        st.cellType === "pollen" &&
        st.pollenStored >= C.adultFeedPollenCost
      ) {
        st.pollenStored -= C.adultFeedPollenCost;
        return {
          kind: "pollen",
          count: C.adultFeedPollenCost,
          cellKey: key,
        };
      }
    }
    return null;
  }

  private tryFeedQueen(
    ent: import("excalibur").Entity,
    job: JobComponent,
    elapsed: number,
  ): void {
    const C = getActiveColonyConstants();
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
    const wl = worker.get(BeeLevelComponent);
    const ql = queen.get(BeeLevelComponent);
    if (!wl || !ql || wl.level !== ql.level) {
      job.feedQueenTimerMs = 0;
      return;
    }
    job.feedQueenTimerMs += scaledWorkElapsed(elapsed, worker.get(BeeNeedsComponent));
    if (job.feedQueenTimerMs < C.feedQueenDurationMs) {
      return;
    }
    const n = queen.get(BeeNeedsComponent)!;
    n.hunger = Math.max(0, n.hunger - C.hungerRelief);
    job.status = "done";
    releaseJob(this.world, job);
    ent.kill();
  }

  private tryConsumeCellNectar(): AdultFeedConsume | null {
    const C = getActiveColonyConstants();
    for (const [key, e] of this.colony.cellsByKey) {
      const st = e.get(CellStateComponent)!;
      if (nectarCellHasNectarForFeeding(st, C.adultFeedCellNectarCost)) {
        st.nectarStored -= C.adultFeedCellNectarCost;
        return {
          kind: "nectar",
          count: C.adultFeedCellNectarCost,
          cellKey: key,
        };
      }
    }
    return null;
  }

  private tryConsumeCellHoney(): AdultFeedConsume | null {
    const C = getActiveColonyConstants();
    for (const [key, e] of this.colony.cellsByKey) {
      const st = e.get(CellStateComponent)!;
      if (nectarCellHasHoneyForFeeding(st, C.adultFeedHoneyCost)) {
        st.honeyStored -= C.adultFeedHoneyCost;
        return {
          kind: "honey",
          count: C.adultFeedHoneyCost,
          cellKey: key,
        };
      }
    }
    return null;
  }

  private interruptHoneyForNectar(): boolean {
    const C = getActiveColonyConstants();
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
      if (nectarCellHasNectarForFeeding(st, C.adultFeedCellNectarCost)) {
        st.nectarStored -= C.adultFeedCellNectarCost;
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
