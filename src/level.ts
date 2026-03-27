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
import { drawBeeJobLabels } from "./render/bee-job-label";
import { drawHiveCells } from "./render/cell-renderer-actor";

/**
 * Main hive scene: camera pan vs tap placement, colony simulation, and UI snapshots.
 */
export class MyLevel extends Scene {
  readonly colony = new ColonyRuntime();
  private lastPanScreen: { x: number; y: number } | null = null;
  private dragScreen = 0;
  private wasDown = false;
  /**
   * iOS often reports a bogus screen position on the first frame after touchstart,
   * then corrects it on the next frame. If we accumulate that delta into `dragScreen`,
   * a tap looks like a huge drag. Skip one frame of pan/drag accumulation after down.
   */
  private reseedPanAfterTouchStart = false;

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
      this.reseedPanAfterTouchStart = false;
      this.colony.updateHoverFromPointer();
      return;
    }
    const pointers = engine.input.pointers;
    const down = pointers.isDown(0);
    const primary = pointers.primary;
    const page = primary.lastPagePos;
    const screen = engine.screen.pageToScreenCoordinates(page);

    if (down) {
      if (!this.wasDown) {
        this.dragScreen = 0;
        this.lastPanScreen = { x: screen.x, y: screen.y };
        this.reseedPanAfterTouchStart = true;
      } else if (this.lastPanScreen) {
        if (this.reseedPanAfterTouchStart) {
          this.lastPanScreen = { x: screen.x, y: screen.y };
          this.reseedPanAfterTouchStart = false;
        } else {
          // Standard "drag to pan" mapping: convert finger delta in screen space
          // into world delta using camera zoom.
          const dx = screen.x - this.lastPanScreen.x;
          const dy = screen.y - this.lastPanScreen.y;
          const z = this.camera.zoom ?? 1;

          // Map-style panning: invert sign so the world moves with the finger
          // (drag direction matches finger motion).
          this.camera.pos = this.camera.pos.sub(vec(dx / z, dy / z));
          this.dragScreen += vec(dx, dy).size;
          this.lastPanScreen = { x: screen.x, y: screen.y };
        }
      } else {
        this.lastPanScreen = { x: screen.x, y: screen.y };
      }
    } else {
      if (
        this.wasDown &&
        this.dragScreen < COLONY.panTapThresholdPx &&
        !pointers.isDragging(0)
      ) {
        const w = engine.screen.pageToWorldCoordinates(primary.lastPagePos);
        const h = worldToHex(w, COLONY.hexSize);
        this.colony.handleTapIntent({
          q: h.q,
          r: h.r,
          level: this.colony.activeLevel,
        });
      }
      this.lastPanScreen = null;
      this.dragScreen = 0;
      this.reseedPanAfterTouchStart = false;
    }
    this.wasDown = down;
    this.colony.updateHoverFromPointer();
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

  /**
   * Draw hive cells before actors so bees render on top (scene order: preDraw → world draw → postDraw).
   */
  override onPreDraw(ctx: ExcaliburGraphicsContext, _elapsed: number): void {
    ctx.save();
    ctx.resetTransform();
    this.camera.draw(ctx);
    drawHiveCells(ctx, this.colony);
    ctx.restore();
  }

  /** Job labels after actors so they appear above bees and cells. */
  override onPostDraw(ctx: ExcaliburGraphicsContext, _elapsed: number): void {
    ctx.save();
    ctx.resetTransform();
    this.camera.draw(ctx);
    drawBeeJobLabels(ctx, this.colony);
    ctx.restore();
  }
}
