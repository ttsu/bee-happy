import { Color, Font, vec, type ExcaliburGraphicsContext, type World } from "excalibur";
import type { ColonyRuntime } from "../colony/colony-runtime";
import {
  BeeAgeComponent,
  BeeLevelComponent,
  BeeRoleComponent,
  BeeWorkComponent,
  JobComponent,
} from "../colony/ecs/components/colony-components";
import { getBeeDayOneBased } from "../colony/worker-lifecycle";

const findJobEntity = (world: World, id: number) =>
  world.entities.find((e) => e.id === id);

/** Offset from bee center (right, slightly below) so labels sit beside the dot. */
const LABEL_OFFSET = vec(10, 5);

const labelFont = new Font({
  size: 8,
  family: "sans-serif",
  color: Color.fromHex("#94a3b8"),
  smoothing: true,
  shadow: {
    blur: 0,
    offset: vec(0.5, 1),
    color: Color.fromRGB(15, 23, 42, 0.55),
  },
});

/**
 * Short, human-readable status for the job UI next to a bee.
 */
const shortJobLabel = (job: JobComponent): string => {
  switch (job.kind) {
    case "buildCell":
      return "build";
    case "layEgg":
      return "lay egg";
    case "feedLarvae":
      switch (job.feedLarvaePhase) {
        case "toPickup":
          return "fetch";
        case "collecting":
          return "gather";
        case "toDeliver":
          return "feed";
        case "depositing":
          return "deposit";
      }
    case "feedQueen":
      return "feed queen";
    case "cleanBrood":
      return "clean";
    case "foragePollen":
    case "forageNectar":
    case "forageWater": {
      // Include what we are foraging so it's easy to read at a glance.
      // (We keep the label short for HUD readability.)
      let forageLabel: "pollen" | "nectar" | "water" = "water";
      if (job.kind === "foragePollen") {
        forageLabel = "pollen";
      } else if (job.kind === "forageNectar") {
        forageLabel = "nectar";
      }

      switch (job.foragePhase) {
        case "outbound":
          return `find ${forageLabel}`;
        case "wait":
          return `forage ${forageLabel}`;
        case "return":
          return `return ${forageLabel}`;
        case "depositing":
          return `deposit ${forageLabel}`;
        case "capacityWait":
          return `hold ${forageLabel}`;
        default:
          return `forage ${forageLabel}`;
      }
    }
    case "depositPollen":
      return "store pollen";
    case "depositNectar":
      return "store nectar";
    case "depositWater":
      return "store water";
    case "honeyProcess":
      return "make honey";
    case "guardHive":
      return "guard";
    case "adultFeed":
      return "eat";
    case "waterDeliver":
      return "hydrate";
    default:
      return "busy";
  }
};

/**
 * Draws a small muted job label beside each bee on the active hive level.
 */
export const drawBeeJobLabels = (
  ctx: ExcaliburGraphicsContext,
  colony: ColonyRuntime,
): void => {
  const active = colony.activeLevel;
  const world = colony.scene.world;
  for (const actor of colony.scene.actors) {
    const w = actor.get(BeeWorkComponent);
    const lvl = actor.get(BeeLevelComponent);
    const role = actor.get(BeeRoleComponent);
    const age = actor.get(BeeAgeComponent);
    if (!w || !lvl || lvl.level !== active) {
      continue;
    }
    let text = "idle";
    if (w.currentJobEntityId != null) {
      const jobEnt = findJobEntity(world, w.currentJobEntityId);
      const job = jobEnt?.get(JobComponent);
      if (job && job.status !== "done") {
        text = shortJobLabel(job);
      }
    }
    if (role?.role === "worker" && age) {
      const d = Math.min(50, getBeeDayOneBased(age.ageMs));
      text = `${text} d${d}`;
    }
    const pos = actor.pos.add(LABEL_OFFSET);
    ctx.save();
    ctx.translate(pos.x, pos.y);
    labelFont.render(ctx, text, labelFont.color, 0, 0);
    ctx.restore();
  }
};
