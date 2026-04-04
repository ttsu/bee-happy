import { Entity, vec } from "excalibur";
import type { ColonyRuntime } from "../colony-runtime";
import { getActiveColonyConstants } from "../colony-active-constants";
import { worldToHex } from "../../grid/hex-grid";
import { BeeActor } from "../../render/bee-actor";
import {
  ActiveLevelComponent,
  BeeAgeComponent,
  BeeCarryComponent,
  BeeNeedsComponent,
  BeeWorkComponent,
  CellStateComponent,
  ColonyTimeComponent,
  HoneyRunComponent,
  JobComponent,
  QueenTimerComponent,
  YearlyStatsComponent,
} from "../ecs/components/colony-components";
import { gameSettingsFromSave } from "../game-settings";
import { refreshActiveColonyConstantsFromMeta } from "../colony-active-constants";
import { applyCellStateJson, newJobFromJson } from "./colony-save-codec";
import type { LoadPayload } from "./colony-save-types";

/**
 * Clears seeded content and applies a save. Call after {@link ColonyRuntime.initialize}
 * with `{ mode: "load" }` so the world only has the controller + systems.
 */
export function applyColonySave(colony: ColonyRuntime, payload: LoadPayload): void {
  const { data, seasonSystem } = payload;
  const scene = colony.scene;
  const world = scene.world;

  for (const e of [...world.entities]) {
    e.kill();
  }
  for (const a of [...scene.actors]) {
    a.kill();
  }
  colony.cellsByKey.clear();

  const gs = gameSettingsFromSave(data.gameSettings);
  colony.applyRuntimeGameSettings(gs);
  refreshActiveColonyConstantsFromMeta(colony.lineageSystemEnabled);

  colony.controllerEntity = new Entity({
    name: "colony-controller",
    components: [
      Object.assign(new ActiveLevelComponent(), data.activeLevel),
      Object.assign(new QueenTimerComponent(), data.queenTimer),
      Object.assign(new ColonyTimeComponent(), data.colonyTime),
      Object.assign(new YearlyStatsComponent(), data.yearly),
      new HoneyRunComponent(),
    ],
  });
  colony.controllerEntity.addTag("colonyController");
  world.add(colony.controllerEntity);

  colony.applySeasonSystemStateForLoad(seasonSystem);

  for (const c of data.cells) {
    const ent = colony.createCellEntity(c.coord, {});
    applyCellStateJson(ent.get(CellStateComponent)!, c.state);
  }

  const jobMap = new Map<number, number>();
  for (const { entityId: oldId, job: j } of data.jobs) {
    const ent = colony.createJob(newJobFromJson(j));
    jobMap.set(oldId, ent.id);
  }

  const beeMap = new Map<number, number>();
  const beeWorkOldJobIds: { actor: BeeActor; oldJobId: number | null }[] = [];
  for (const { entityId: oldBeeId, bee: b } of data.bees) {
    const pos = vec(b.pos.x, b.pos.y);
    const hex = worldToHex(pos, getActiveColonyConstants().hexSize);
    const actor = colony.spawnBee(b.role, b.level, hex);
    actor.rotation = b.rotation;
    actor.pos = pos;
    const work = actor.get(BeeWorkComponent)!;
    work.availability = b.work.availability;
    work.pathIndex = b.work.pathIndex;
    work.idleWanderTarget = b.work.idleWanderTarget
      ? vec(b.work.idleWanderTarget.x, b.work.idleWanderTarget.y)
      : null;
    work.idleWanderPauseRemainingMs = b.work.idleWanderPauseRemainingMs;
    beeWorkOldJobIds.push({ actor, oldJobId: b.work.currentJobEntityId });
    actor.get(BeeCarryComponent)!.carry = b.carry;
    const needs = actor.get(BeeNeedsComponent)!;
    needs.hunger = b.needs.hunger;
    needs.thirst = b.needs.thirst;
    if (b.ageMs != null) {
      const age = actor.get(BeeAgeComponent);
      if (age) {
        age.ageMs = b.ageMs;
      }
    }
    beeMap.set(oldBeeId, actor.id);
  }

  for (const { actor, oldJobId } of beeWorkOldJobIds) {
    const work = actor.get(BeeWorkComponent)!;
    work.currentJobEntityId = oldJobId != null ? (jobMap.get(oldJobId) ?? null) : null;
  }

  scene.camera.pos = vec(data.camera.x, data.camera.y);

  colony.pendingCellTypeKey = data.runtime.pendingCellTypeKey;
  colony.cellTypeChangeError = data.runtime.cellTypeChangeError;
  colony.cellTypeChangeDiscardTarget = data.runtime.cellTypeChangeDiscardTarget;
  colony.transitionOverlay = data.runtime.transitionOverlay;
  colony.selectedPlacementCellType = data.runtime.selectedPlacementCellType ?? "brood";

  for (const e of world.entities) {
    const job = e.get(JobComponent);
    if (!job) {
      continue;
    }
    job.reservedBeeIds = job.reservedBeeIds
      .map((id) => beeMap.get(id))
      .filter((id): id is number => id != null);
    job.adultFeedTargetBeeId = beeMap.get(job.adultFeedTargetBeeId ?? -1) ?? null;
  }

  colony.emitUiSnapshotImmediate();
}
