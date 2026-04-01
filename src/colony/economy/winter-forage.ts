import type { World } from "excalibur";
import { JobComponent } from "../ecs/components/colony-components";
import { releaseJob } from "./job-queries";

/**
 * Cancels outbound pollen/nectar forage jobs during winter.
 */
export const cancelWinterForageJobs = (world: World): void => {
  for (const ent of world.entities) {
    const job = ent.get(JobComponent);
    if (!job || job.status === "done") {
      continue;
    }
    if (job.kind === "foragePollen" || job.kind === "forageNectar") {
      releaseJob(world, job);
      ent.kill();
    }
  }
};
