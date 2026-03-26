import { System, SystemPriority, SystemType, type World } from "excalibur";
import {
  ActiveLevelComponent,
  BeeLevelComponent,
} from "../components/colony-components";
import type { ColonyRuntime } from "../../colony-runtime";
import { COLONY } from "../../constants";

/**
 * Level transitions (fade + zoom) and visibility toggles for bee actors.
 */
export class LevelSystem extends System {
  static override priority = SystemPriority.Highest;
  public readonly systemType = SystemType.Update;

  constructor(
    public world: World,
    private readonly colony: ColonyRuntime,
  ) {
    super();
  }

  override update(elapsed: number): void {
    const ctrl = this.colony.controllerEntity.get(ActiveLevelComponent)!;
    if (ctrl.transition === "idle") {
      this.colony.transitionOverlay = 0;
      this.applyBeeVisibility(ctrl.activeLevel);
      return;
    }
    ctrl.transitionT += elapsed;
    const half = COLONY.levelFadeMs;
    const scene = this.colony.scene;
    if (ctrl.transition === "fadeOut") {
      const t = Math.min(1, ctrl.transitionT / half);
      this.colony.transitionOverlay = t;
      scene.camera.zoom = 1 + (COLONY.levelZoomPeak - 1) * t;
      if (ctrl.transitionT >= half) {
        ctrl.activeLevel = ctrl.pendingLevel ?? ctrl.activeLevel;
        ctrl.pendingLevel = null;
        ctrl.transition = "fadeIn";
        ctrl.transitionT = 0;
        this.colony.events.emit({
          type: "LevelChanged",
          level: ctrl.activeLevel,
        });
        this.applyBeeVisibility(ctrl.activeLevel);
      }
    } else if (ctrl.transition === "fadeIn") {
      const t = Math.min(1, ctrl.transitionT / half);
      this.colony.transitionOverlay = 1 - t;
      scene.camera.zoom = COLONY.levelZoomPeak - (COLONY.levelZoomPeak - 1) * t;
      if (ctrl.transitionT >= half) {
        ctrl.transition = "idle";
        ctrl.transitionT = 0;
        this.colony.transitionOverlay = 0;
        scene.camera.zoom = 1;
      }
    }
  }

  private applyBeeVisibility(activeLevel: number): void {
    for (const a of this.colony.scene.actors) {
      const lvl = a.get(BeeLevelComponent);
      if (!lvl) {
        continue;
      }
      a.graphics.visible = lvl.level === activeLevel;
    }
  }
}
