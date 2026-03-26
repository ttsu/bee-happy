import type { Actor, Entity } from "excalibur";
import type { BeeRole } from "./components/colony-components";
import { BeeRoleComponent, JobComponent } from "./components/colony-components";
import {
  getWorkerStagePreferenceDistanceBonusPx,
  getWorkerLifecycleStage,
} from "../worker-lifecycle";

/**
 * Whether a bee role may be reserved for a given job kind (matches `JobAssignmentSystem`).
 */
export const isBeeAssignableToJobKind = (
  role: BeeRole,
  kind: JobComponent["kind"],
): boolean => {
  if (kind === "layEgg") {
    return role === "queen";
  }
  return role === "worker";
};

/**
 * Worker lifecycle no longer hard-gates jobs; this returns true for all worker jobs.
 */
export const isWorkerEligibleForJobKind = (
  _ageMs: number,
  kind: JobComponent["kind"],
): boolean => kind !== "layEgg";

/**
 * Assignment score bonus from worker lifecycle stage preference.
 */
export const workerJobPreferenceDistanceBonusPx = (
  ageMs: number,
  kind: JobComponent["kind"],
): number =>
  getWorkerStagePreferenceDistanceBonusPx(getWorkerLifecycleStage(ageMs), kind);

/**
 * Aggregates whether an open job still needs at least one bee of each role category.
 */
export const computeOpenJobAssignmentSlots = (
  jobEntities: readonly Entity[],
): { worker: boolean; queen: boolean } => {
  let worker = false;
  let queen = false;
  for (const je of jobEntities) {
    const job = je.get(JobComponent);
    if (!job || job.status === "done") {
      continue;
    }
    const still = job.beesNeeded - job.reservedBeeIds.length;
    if (still <= 0) {
      continue;
    }
    if (job.kind === "layEgg") {
      queen = true;
    } else {
      worker = true;
    }
  }
  return { worker, queen };
};

/**
 * True if this bee could still be assigned to at least one open job with free slots.
 */
export const beeIsEligibleForOpenJobs = (
  role: BeeRole,
  slots: { worker: boolean; queen: boolean },
): boolean => (role === "queen" ? slots.queen : slots.worker);

/**
 * For workers: true if some open job exists they could take (with self-feed target match).
 * Queens still use {@link beeIsEligibleForOpenJobs}.
 */
export const workerActorHasAssignableOpenJob = (
  actor: Actor,
  jobEntities: readonly Entity[],
): boolean => {
  const role = actor.get(BeeRoleComponent)?.role;
  if (role !== "worker") {
    return false;
  }
  for (const je of jobEntities) {
    const job = je.get(JobComponent);
    if (!job || job.status === "done") {
      continue;
    }
    const still = job.beesNeeded - job.reservedBeeIds.length;
    if (still <= 0) {
      continue;
    }
    if (!isBeeAssignableToJobKind("worker", job.kind)) {
      continue;
    }
    if (job.kind === "adultFeed") {
      if (job.adultFeedTargetBeeId !== actor.id) {
        continue;
      }
    }
    return true;
  }
  return false;
};
