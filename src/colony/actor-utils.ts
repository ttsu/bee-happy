import { Actor, type Entity } from "excalibur";

/**
 * Narrows an ECS entity to an {@link Actor} when it participates in the scene transform.
 */
export const asActor = (e: Entity | undefined): Actor | undefined =>
  e instanceof Actor ? e : undefined;
