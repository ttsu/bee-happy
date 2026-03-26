import { Color, Font, vec, type ExcaliburGraphicsContext, type World } from "excalibur";
import type { ColonyRuntime } from "../colony/colony-runtime";
import {
  BeeLevelComponent,
  BeeWorkComponent,
  JobComponent,
} from "../colony/ecs/components/colony-components";

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
    case "cleanBrood":
      return "clean";
    case "foragePollen":
    case "forageNectar":
    case "forageWater":
      switch (job.foragePhase) {
        case "outbound":
          return "forage";
        case "wait":
          return "wait";
        case "return":
          return "return";
        default:
          return "forage";
      }
    case "depositPollen":
    case "depositNectar":
    case "depositWater":
      return "deposit";
    case "honeyProcess":
      return "honey";
    case "adultFeed":
      return "tend";
    case "waterDeliver":
      return "water";
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
    const pos = actor.pos.add(LABEL_OFFSET);
    // Font.render applies translate(x,y) then draws at coordinates that include x,y again.
    // Pass world coords only via ctx.translate; use 0,0 like Text._drawImage does.
    ctx.save();
    ctx.translate(pos.x, pos.y);
    labelFont.render(ctx, text, labelFont.color, 0, 0);
    ctx.restore();
  }
};
