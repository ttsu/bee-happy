import { Color, Loader } from "excalibur";

/**
 * Excalibur scene loader with Bee Happy styling and reliable progress when assets
 * were already loaded earlier (the base loader only increments an internal counter
 * for resources fetched during {@link DefaultLoader.load}).
 */
export class BeeHappyLoader extends Loader {
  constructor() {
    super();
    this.backgroundColor = "#1b2838";
    this.loadingBarColor = Color.fromHex("#82e0aa");
    this.suppressPlayButton = true;
  }

  override get progress(): number {
    const resources = this.resources;
    if (resources.length === 0) {
      return 1;
    }
    const loaded = resources.filter((r) => r.isLoaded()).length;
    return loaded / resources.length;
  }

  override onDraw(ctx: CanvasRenderingContext2D): void {
    const w = this.engine.canvasWidth / this.engine.pixelRatio;
    const h = this.engine.canvasHeight / this.engine.pixelRatio;

    ctx.fillStyle = "#1b2838";
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "#ecf0f1";
    ctx.font = "bold 26px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Bee Happy", w / 2, h / 2 - 36);

    ctx.font = "14px system-ui, sans-serif";
    ctx.fillStyle = "#bdc3c7";
    ctx.fillText("Loading hive assets…", w / 2, h / 2 - 8);

    const barW = Math.min(280, w * 0.75);
    const barH = 12;
    const x = w / 2 - barW / 2;
    const y = h / 2 + 20;
    const p = this.progress;

    ctx.fillStyle = "rgba(236, 240, 241, 0.15)";
    ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = "#82e0aa";
    ctx.fillRect(x, y, Math.max(2, barW * p), barH);

    ctx.fillStyle = "#bdc3c7";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`${Math.round(p * 100)}%`, w / 2, y + barH + 18);
  }
}
