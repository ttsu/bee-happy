import {
  Color,
  Engine,
  Scene,
  SceneActivationContext,
  vec,
  type DefaultLoader,
  type ExcaliburGraphicsContext,
} from "excalibur";
import { worldToHex } from "./grid/hex-grid";
import { COLONY } from "./colony/constants";
import { ColonyRuntime } from "./colony/colony-runtime";
import { ActiveLevelComponent } from "./colony/ecs/components/colony-components";
import { setColonyBridge } from "./colony-bridge";
import { drawHiveCells } from "./render/cell-renderer-actor";

/**
 * Main hive scene: camera pan vs tap placement, colony simulation, and UI snapshots.
 */
export class MyLevel extends Scene {
  readonly colony = new ColonyRuntime();
  private lastPanScreen: { x: number; y: number } | null = null;
  private dragScreen = 0;
  private wasDown = false;

  override onInitialize(engine: Engine): void {
    this.backgroundColor = Color.fromHex("#1b2838");
    this.camera.pos = vec(0, 0);
    this.colony.initialize(this, engine);
    setColonyBridge(this.colony);
  }

  override onPreLoad(loader: DefaultLoader): void {
    void loader;
  }

  override onActivate(_context: SceneActivationContext<unknown>): void {}

  override onDeactivate(_context: SceneActivationContext): void {}

  override onPreUpdate(engine: Engine, elapsed: number): void {
    void elapsed;
    const ctrl = this.colony.controllerEntity.get(ActiveLevelComponent)!;
    if (ctrl.transition !== "idle") {
      this.lastPanScreen = null;
      this.dragScreen = 0;
      this.wasDown = false;
      return;
    }
    const pointers = engine.input.pointers;
    const down = pointers.isDown(0);
    const primary = pointers.primary;
    if (down) {
      if (!this.wasDown) {
        this.dragScreen = 0;
      }
      if (this.lastPanScreen) {
        const w0 = engine.screenToWorldCoordinates(
          vec(this.lastPanScreen.x, this.lastPanScreen.y),
        );
        const w1 = engine.screenToWorldCoordinates(primary.lastScreenPos);
        this.camera.pos = this.camera.pos.add(w0.sub(w1));
        this.dragScreen += primary.lastScreenPos.sub(
          vec(this.lastPanScreen.x, this.lastPanScreen.y),
        ).size;
      }
      this.lastPanScreen = { x: primary.lastScreenPos.x, y: primary.lastScreenPos.y };
    } else {
      if (
        this.wasDown &&
        this.dragScreen < COLONY.panTapThresholdPx &&
        !pointers.isDragging(0)
      ) {
        const w = primary.lastWorldPos;
        const h = worldToHex(w, COLONY.hexSize);
        this.colony.handlePlacementIntent({
          q: h.q,
          r: h.r,
          level: this.colony.activeLevel,
        });
      }
      this.lastPanScreen = null;
      this.dragScreen = 0;
    }
    this.wasDown = down;
  }

  override onPostUpdate(engine: Engine, elapsed: number): void {
    void engine;
    this.colony.lastUiEmit += elapsed;
    if (this.colony.lastUiEmit >= COLONY.uiSnapshotMs) {
      this.colony.lastUiEmit = 0;
      this.colony.events.emit({
        type: "ColonySnapshot",
        snapshot: this.colony.getUiSnapshot(),
      });
    }
  }

  override onPostDraw(ctx: ExcaliburGraphicsContext, _elapsed: number): void {
    // Custom draw runs in screen space unless the camera transform is applied; match world actors.
    ctx.save();
    ctx.resetTransform();
    this.camera.draw(ctx);
    drawHiveCells(ctx, this.colony);
    ctx.restore();
  }
}
