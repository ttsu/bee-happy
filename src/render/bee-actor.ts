import {
  Actor,
  Animation,
  CollisionType,
  range,
  vec,
  type Engine,
  type Sprite,
  type Vector,
} from "excalibur";
import type { BeeRole } from "../colony/ecs/components/colony-components";
import {
  BeeAgeComponent,
  BeeCarryComponent,
  JobComponent,
  BeeNeedsComponent,
  BeeRoleComponent,
  BeeWorkComponent,
} from "../colony/ecs/components/colony-components";
import { beeSpriteSheet } from "../resources";

/**
 * Minimal bee visualization (queen vs worker) with ECS state components attached.
 */
export class BeeActor extends Actor {
  private static readonly WIGGLE_AMPLITUDE_RADIANS = 0.08;
  private static readonly WIGGLE_CYCLES_PER_SECOND = 8;
  private readonly groundedSprite: Sprite;
  private readonly wingFlapAnimation: Animation;
  private readonly lastPos: Vector;
  private usingWingFlap = false;
  private wiggleTimeMs = 0;

  constructor(role: BeeRole, pos: Vector) {
    super({
      pos,
      width: 24,
      height: 24,
      scale: role === "queen" ? vec(0.5, 0.5) : vec(0.25, 0.25),
      collisionType: CollisionType.PreventCollision,
      name: role === "queen" ? "Queen" : "Worker",
    });
    this.addComponent(new BeeRoleComponent(role));
    this.addComponent(new BeeWorkComponent());
    this.addComponent(new BeeNeedsComponent());
    this.addComponent(new BeeCarryComponent());
    if (role === "worker") {
      this.addComponent(new BeeAgeComponent(0));
    }
    this.groundedSprite = beeSpriteSheet.getSprite(0, 0)!;
    this.wingFlapAnimation = Animation.fromSpriteSheet(beeSpriteSheet, range(0, 3), 20);
    this.lastPos = pos.clone();
    this.graphics.use(this.groundedSprite);
  }

  override onPreUpdate(_engine: Engine, elapsed: number): void {
    const delta = this.pos.sub(this.lastPos);
    const movingEnough = delta.size > 0.01;
    if (movingEnough) {
      // Sprite art is oriented upward at rotation 0.
      this.wiggleTimeMs += elapsed;
      const wigglePhase =
        this.wiggleTimeMs * 0.001 * Math.PI * 2 * BeeActor.WIGGLE_CYCLES_PER_SECOND;
      const wiggleOffset = Math.sin(wigglePhase) * BeeActor.WIGGLE_AMPLITUDE_RADIANS;
      this.rotation = Math.atan2(delta.y, delta.x) + Math.PI / 2 + wiggleOffset;
    } else {
      this.wiggleTimeMs = 0;
    }
    this.lastPos.x = this.pos.x;
    this.lastPos.y = this.pos.y;

    const flying = this.isForageFlight();
    if (flying === this.usingWingFlap) {
      return;
    }
    this.usingWingFlap = flying;
    this.graphics.use(flying ? this.wingFlapAnimation : this.groundedSprite);
  }

  private isForageFlight(): boolean {
    const work = this.get(BeeWorkComponent);
    if (!work?.currentJobEntityId || !this.scene) {
      return false;
    }
    const job = this.scene.world.entities
      .find((entity) => entity.id === work.currentJobEntityId)
      ?.get(JobComponent);
    if (!job) {
      return false;
    }
    const isForageJob =
      job.kind === "foragePollen" ||
      job.kind === "forageNectar" ||
      job.kind === "forageWater";
    if (!isForageJob) {
      return false;
    }
    return (
      job.foragePhase === "outbound" ||
      job.foragePhase === "depositing" ||
      job.foragePhase === "return" ||
      job.foragePhase === "wait"
    );
  }
}
