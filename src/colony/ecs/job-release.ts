import type { World } from "excalibur";
import { asActor } from "../actor-utils";
import {
  BeeLevelComponent,
  BeeWorkComponent,
  JobComponent,
} from "./components/colony-components";

const findActorById = (world: World, id: number) =>
  asActor(world.entities.find((e) => e.id === id));

/**
 * Clears reservations on a job and sets affected bees back to available.
 */
export const releaseJobBees = (world: World, job: JobComponent): void => {
  for (const id of job.reservedBeeIds) {
    const bee = findActorById(world, id);
    const w = bee?.get(BeeWorkComponent);
    if (w) {
      w.availability = "available";
      w.currentJobEntityId = null;
      w.pathIndex = 0;
      w.idleWanderTarget = null;
      w.idleWanderPauseRemainingMs = 0;
    }
    const lvl = bee?.get(BeeLevelComponent);
    if (lvl) {
      lvl.verticalTransitionTargetLevel = null;
      lvl.verticalTransitionElapsedMs = 0;
    }
  }
  job.reservedBeeIds = [];
};

/**
 * Releases every job that reserved {@link beeId} (e.g. bee death).
 */
export const releaseBeeFromAllJobs = (world: World, beeId: number): void => {
  for (const ent of world.entities) {
    const job = ent.get(JobComponent);
    if (!job || job.status === "done") {
      continue;
    }
    const idx = job.reservedBeeIds.indexOf(beeId);
    if (idx < 0) {
      continue;
    }
    job.reservedBeeIds.splice(idx, 1);
    const bee = findActorById(world, beeId);
    const w = bee?.get(BeeWorkComponent);
    if (w) {
      w.availability = "available";
      w.currentJobEntityId = null;
      w.pathIndex = 0;
      w.idleWanderTarget = null;
      w.idleWanderPauseRemainingMs = 0;
    }
    const lvl = bee?.get(BeeLevelComponent);
    if (lvl) {
      lvl.verticalTransitionTargetLevel = null;
      lvl.verticalTransitionElapsedMs = 0;
    }
    if (job.reservedBeeIds.length === 0) {
      job.status = "open";
    }
  }
};
