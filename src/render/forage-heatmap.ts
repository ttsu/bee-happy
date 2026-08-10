import { ImageSource, type ExcaliburGraphicsContext, type Sprite } from "excalibur";
import type { ColonyRuntime } from "../colony/colony-runtime";
import {
  FORAGE,
  worldExtentPx,
  type ForageField,
  type ForageLayer,
  type ForageWorld,
} from "../colony/foraging/forage-field";

/**
 * Per-layer ramp end color.
 *
 * Pollen matches its HUD icon (#f7dc6f). Nectar is pushed from the HUD green (#82e0aa) toward
 * teal: over the grass terrain the HUD green is nearly invisible.
 */
const LAYER_RGB: Readonly<Record<ForageLayer, [number, number, number]>> = {
  pollen: [247, 220, 111],
  nectar: [78, 216, 214],
};

/** Alpha at field value 1. Kept well under opaque so terrain stays readable through it. */
const MAX_ALPHA = 0.72;
/** Below this the ramp is fully transparent, so dead ground reads as "nothing here". */
const VALUE_FLOOR = 0.04;

type HeatmapCache = {
  readonly world: ForageWorld;
  readonly layer: ForageLayer;
  readonly image: ImageSource;
  /** Built lazily once {@link ImageSource.isLoaded} flips true. */
  sprite: Sprite | null;
};

let cache: HeatmapCache | null = null;

/**
 * Rasterizes one field into a `fieldCells` square image, one pixel per field cell.
 *
 * Drawn scaled up with Excalibur's default `Blended` filtering, so the tiny source becomes a
 * smooth gradient for free instead of needing a per-pixel blur.
 */
const buildHeatmapImage = (field: ForageField, layer: ForageLayer): ImageSource => {
  const n = FORAGE.fieldCells;
  const canvas = document.createElement("canvas");
  canvas.width = n;
  canvas.height = n;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(n, n);
  const [r, g, b] = LAYER_RGB[layer];
  for (let i = 0; i < n * n; i++) {
    const v = field.base[i] ?? 0;
    const t = v <= VALUE_FLOOR ? 0 : (v - VALUE_FLOOR) / (1 - VALUE_FLOOR);
    const o = i * 4;
    img.data[o] = r;
    img.data[o + 1] = g;
    img.data[o + 2] = b;
    // sqrt ramp: typical field values sit near 0.1-0.45, so a linear or squared ramp would
    // render most of the map almost invisible while still leaving hot spots distinct.
    img.data[o + 3] = Math.round(Math.sqrt(t) * MAX_ALPHA * 255);
  }
  ctx.putImageData(img, 0, 0);
  return ImageSource.fromHtmlCanvasElement(canvas);
};

/**
 * Draws the active forage heat map across the whole world rect.
 *
 * Called from `Scene.onPreDraw` alongside the hive cells, so it sits above the terrain tilemap
 * and below bees. No-op when the overlay is off.
 *
 * The image is rebuilt only when the generated world or the selected layer changes — currently
 * new game, load, and layer toggle. Local depletion will need to invalidate this too.
 */
export const drawForageHeatmap = (
  ctx: ExcaliburGraphicsContext,
  colony: ColonyRuntime,
): void => {
  const layer = colony.forageHeatmapLayer;
  if (!layer) {
    return;
  }
  const world = colony.forageWorld;
  if (!cache || cache.world !== world || cache.layer !== layer) {
    const field = layer === "pollen" ? world.pollen : world.nectar;
    cache = { world, layer, image: buildHeatmapImage(field, layer), sprite: null };
  }
  // `fromHtmlCanvasElement` decodes asynchronously; skip until the texture is ready.
  if (!cache.image.isLoaded()) {
    return;
  }
  const extent = worldExtentPx();
  if (!cache.sprite) {
    // Draw through a Sprite rather than `ctx.drawImage`: the graphics context only renders
    // images it owns, so a raw HTMLImageElement silently no-ops.
    cache.sprite = cache.image.toSprite({
      destSize: { width: extent * 2, height: extent * 2 },
    });
  }
  cache.sprite.draw(ctx, -extent, -extent);
};

/** Drops the cached texture (tests / teardown). */
export const resetForageHeatmapCache = (): void => {
  cache = null;
};
