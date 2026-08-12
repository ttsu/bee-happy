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
  BeeLevelComponent,
  ColonyTimeComponent,
  JobComponent,
  BeeNeedsComponent,
  BeeRoleComponent,
  BeeWorkComponent,
} from "../colony/ecs/components/colony-components";
import { COLONY } from "../colony/constants";
import { getSeasonForColonyDay, type Season } from "../colony/seasons";
import { winterClusterActivityBurst } from "../colony/winter-cluster";
import { getWorkerVisualScale } from "../colony/worker-lifecycle";
import { getColonyBridge } from "../colony-bridge";
import { beeSpriteSheet } from "../resources";

/**
 * Minimal bee visualization (queen vs worker) with ECS state components attached.
 */
export class BeeActor extends Actor {
  private static readonly WORKER_BASE_SCALE = 0.25;
  private static readonly OUTSIDE_HIVE_SCALE_MULTIPLIER = 0.4;
  private static readonly WIGGLE_AMPLITUDE_RADIANS = 0.08;
  private static readonly WIGGLE_CYCLES_PER_SECOND = 8;
  private static readonly IDLE_WIGGLE_AMPLITUDE_RADIANS = 0.06;
  private static readonly IDLE_WIGGLE_CYCLES_PER_SECOND = 4;
  private static readonly IDLE_POSITION_WIGGLE_AMPLITUDE_PX = 1.5;
  private static readonly WINTER_IDLE_WIGGLE_AMPLITUDE_RADIANS = 0.1;
  private static readonly WINTER_IDLE_WIGGLE_CYCLES_PER_SECOND = 14;
  private static readonly WINTER_IDLE_POSITION_WIGGLE_AMPLITUDE_PX = 2.5;
  private static readonly HIVE_ZOOM_BAND_INNER_PX = 40;
  private static readonly HIVE_ZOOM_BAND_OUTER_PX = 220;
  private readonly groundedSprite: Sprite;
  private readonly wingFlapAnimation: Animation;
  private readonly lastPos: Vector;
  private usingWingFlap = false;
  private wiggleTimeMs = 0;
  private idleStationaryBaseRotation = 0;
  private idleStationaryActive = false;

  constructor(role: BeeRole, pos: Vector) {
    const workerStartScale =
      role === "worker" ? BeeActor.WORKER_BASE_SCALE * getWorkerVisualScale(0) : 0;
    super({
      pos,
      width: 24,
      height: 24,
      scale: role === "queen" ? vec(0.5, 0.5) : vec(workerStartScale, workerStartScale),
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
    const idling = this.isIdling();
    const winterShiver =
      idling && this.getCurrentSeason() === "Winter" && this.isInsideHive();
    if (movingEnough) {
      this.idleStationaryActive = false;
      // Sprite art is oriented upward at rotation 0.
      this.wiggleTimeMs += elapsed;
      const burst = winterShiver ? this.getWinterShiverBurst() : 0;
      const cyclesPerSecond = winterShiver
        ? BeeActor.WIGGLE_CYCLES_PER_SECOND * (0.75 + burst * 0.65)
        : BeeActor.WIGGLE_CYCLES_PER_SECOND;
      const wiggleAmplitude = winterShiver
        ? BeeActor.WIGGLE_AMPLITUDE_RADIANS * (0.85 + burst * 0.75)
        : BeeActor.WIGGLE_AMPLITUDE_RADIANS;
      const wigglePhase = this.wiggleTimeMs * 0.001 * Math.PI * 2 * cyclesPerSecond;
      const wiggleOffset = Math.sin(wigglePhase) * wiggleAmplitude;
      this.rotation = Math.atan2(delta.y, delta.x) + Math.PI / 2 + wiggleOffset;
      this.offset = vec(0, 0);
    } else if (idling) {
      if (!this.idleStationaryActive) {
        this.idleStationaryActive = true;
        this.idleStationaryBaseRotation = this.rotation;
      }
      this.wiggleTimeMs += elapsed;
      const burst = winterShiver ? this.getWinterShiverBurst() : 0;
      const cyclesPerSecond = winterShiver
        ? BeeActor.WINTER_IDLE_WIGGLE_CYCLES_PER_SECOND * (0.65 + burst * 0.55)
        : BeeActor.IDLE_WIGGLE_CYCLES_PER_SECOND;
      const rotAmplitude = winterShiver
        ? BeeActor.WINTER_IDLE_WIGGLE_AMPLITUDE_RADIANS * (0.55 + burst * 0.65)
        : BeeActor.IDLE_WIGGLE_AMPLITUDE_RADIANS;
      const posAmplitude = winterShiver
        ? BeeActor.WINTER_IDLE_POSITION_WIGGLE_AMPLITUDE_PX * (0.5 + burst * 0.7)
        : BeeActor.IDLE_POSITION_WIGGLE_AMPLITUDE_PX;
      const phase = this.wiggleTimeMs * 0.001 * Math.PI * 2 * cyclesPerSecond;
      this.rotation = this.idleStationaryBaseRotation + Math.sin(phase) * rotAmplitude;
      const posPhase = phase * 1.31;
      this.offset = vec(
        Math.sin(posPhase) * posAmplitude,
        Math.cos(posPhase * 0.87) * posAmplitude,
      );
    } else {
      this.idleStationaryActive = false;
      this.wiggleTimeMs = 0;
      this.offset = vec(0, 0);
    }
    this.lastPos.x = this.pos.x;
    this.lastPos.y = this.pos.y;

    const flying = this.isForageFlight() || this.isVerticalLevelTransition();
    if (flying !== this.usingWingFlap) {
      this.usingWingFlap = flying;
      this.graphics.use(flying ? this.wingFlapAnimation : this.groundedSprite);
    }

    const vertScale = this.verticalTransitionScaleMultiplier();
    const hiveScale = this.hiveProximityScaleMultiplier();
    const age = this.get(BeeAgeComponent);
    if (age) {
      const s = getWorkerVisualScale(age.ageMs);
      const b = BeeActor.WORKER_BASE_SCALE;
      this.scale = vec(b * s * vertScale * hiveScale, b * s * vertScale * hiveScale);
    } else {
      this.scale = vec(0.5 * vertScale * hiveScale, 0.5 * vertScale * hiveScale);
    }
  }

  private hiveProximityScaleMultiplier(): number {
    // Keep this purely location-based (not scoped to the current job/phase).
    if (this.get(BeeRoleComponent)?.role !== "worker") {
      return 1;
    }

    const colony = getColonyBridge();
    if (!colony) {
      return 1;
    }

    const beeLevel = this.get(BeeLevelComponent)?.level ?? colony.activeLevel;
    const combOuter = colony.getBuiltCombOuterRadiusPx(beeLevel);
    if (combOuter <= 0) {
      return 1;
    }

    // Smoothly transition scale based on distance from the comb edge.
    const d = this.pos.size;
    const inner = combOuter + BeeActor.HIVE_ZOOM_BAND_INNER_PX;
    const outer = combOuter + BeeActor.HIVE_ZOOM_BAND_OUTER_PX;
    const tRaw = (d - inner) / Math.max(1, outer - inner);
    const t = Math.min(1, Math.max(0, tRaw));
    const smooth = t * t * (3 - 2 * t); // smoothstep

    return 1 - smooth * (1 - BeeActor.OUTSIDE_HIVE_SCALE_MULTIPLIER);
  }

  private isIdling(): boolean {
    const work = this.get(BeeWorkComponent);
    if (!work) {
      return false;
    }
    return work.currentJobEntityId === null && work.availability === "available";
  }

  private getCurrentSeason(): Season | null {
    const colony = getColonyBridge();
    if (!colony) {
      return null;
    }
    const time = colony.controllerEntity.get(ColonyTimeComponent);
    if (!time) {
      return null;
    }
    const msPerBeeDay = COLONY.workerLifespanMs / 50;
    const currentColonyDay = Math.floor(time.colonyElapsedMs / msPerBeeDay) + 1;
    return getSeasonForColonyDay(currentColonyDay, colony.daysPerSeason).season;
  }

  private isInsideHive(): boolean {
    const colony = getColonyBridge();
    if (!colony) {
      return true;
    }
    const beeLevel = this.get(BeeLevelComponent)?.level ?? colony.activeLevel;
    const combOuter = colony.getBuiltCombOuterRadiusPx(beeLevel);
    if (combOuter <= 0) {
      return true;
    }
    return this.pos.size <= combOuter + BeeActor.HIVE_ZOOM_BAND_INNER_PX;
  }

  private getWinterShiverBurst(): number {
    const colony = getColonyBridge();
    if (!colony) {
      return 0.5;
    }
    const time = colony.controllerEntity.get(ColonyTimeComponent);
    if (!time) {
      return 0.5;
    }
    return winterClusterActivityBurst(time.colonyElapsedMs);
  }

  private isVerticalLevelTransition(): boolean {
    return this.get(BeeLevelComponent)?.verticalTransitionTargetLevel != null;
  }

  /** Smooth bump 1 → 1+peak → 1 over the cross-level hold (sine half-period). */
  private verticalTransitionScaleMultiplier(): number {
    const lvl = this.get(BeeLevelComponent);
    if (!lvl || lvl.verticalTransitionTargetLevel === null) {
      return 1;
    }
    const t = Math.min(
      1,
      lvl.verticalTransitionElapsedMs / COLONY.beeLevelTransitionMs,
    );
    const peak = COLONY.beeLevelTransitionZoomPeak;
    return 1 + Math.sin(t * Math.PI) * peak;
  }

  private isForageFlight(): boolean {
    const job = this.getActiveJob();
    if (!job) {
      return false;
    }
    const isForageJob = job.kind === "foragePollen" || job.kind === "forageNectar";
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

  private getActiveJob(): JobComponent | null {
    const work = this.get(BeeWorkComponent);
    if (!work?.currentJobEntityId || !this.scene) {
      return null;
    }
    return (
      this.scene.world.entities
        .find((entity) => entity.id === work.currentJobEntityId)
        ?.get(JobComponent) ?? null
    );
  }
}
