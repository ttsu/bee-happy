import { Actor, Circle, CollisionType, Color, type Vector } from "excalibur";
import type { BeeRole } from "../colony/ecs/components/colony-components";
import {
  BeeCarryComponent,
  BeeNeedsComponent,
  BeeRoleComponent,
  BeeWorkComponent,
} from "../colony/ecs/components/colony-components";

/**
 * Minimal bee visualization (queen vs worker) with ECS state components attached.
 */
export class BeeActor extends Actor {
  constructor(role: BeeRole, pos: Vector) {
    super({
      pos,
      width: 16,
      height: 16,
      collisionType: CollisionType.PreventCollision,
      name: role === "queen" ? "Queen" : "Worker",
    });
    this.addComponent(new BeeRoleComponent(role));
    this.addComponent(new BeeWorkComponent());
    this.addComponent(new BeeNeedsComponent());
    this.addComponent(new BeeCarryComponent());
    const fill = role === "queen" ? Color.fromHex("#f4d03f") : Color.fromHex("#5dade2");
    this.graphics.use(
      new Circle({
        radius: 7,
        color: fill,
        strokeColor: Color.fromHex("#1a252f"),
        lineWidth: 1,
      }),
    );
  }
}
