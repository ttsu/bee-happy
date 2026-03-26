import type { Entity } from "excalibur";
import type { BeeRole } from "./components/colony-components";
import { JobComponent } from "./components/colony-components";

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
