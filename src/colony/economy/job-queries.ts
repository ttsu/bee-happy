import type { World } from "excalibur";
import { asActor } from "../actor-utils";
import { JobComponent } from "../ecs/components/colony-components";
import { releaseJobBees } from "../ecs/job-release";

export const findEntityById = (world: World, id: number) =>
  asActor(world.entities.find((e) => e.id === id));

export const releaseJob = (world: World, job: JobComponent): void => {
  releaseJobBees(world, job);
};

export const countOpenJobsByKind = (world: World, kind: JobComponent["kind"]): number =>
  world.entities.filter((e) => {
    const j = e.get(JobComponent);
    return j && j.kind === kind && j.status !== "done";
  }).length;
