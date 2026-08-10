import { GraphicsComponent, type Engine, type Material, type TileMap } from "excalibur";

/**
 * Luminance-only fragment shader.
 *
 * Excalibur image alphas are pre-multiplied, so RGB is scaled by alpha already; taking the
 * luminance of the pre-multiplied color and passing alpha through keeps that invariant.
 */
const GREYSCALE_FRAGMENT_SOURCE = `#version 300 es
precision mediump float;

in vec2 v_uv;
uniform sampler2D u_graphic;
out vec4 fragColor;

void main() {
  vec4 color = texture(u_graphic, v_uv);
  float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
  fragColor = vec4(vec3(luminance), color.a);
}
`;

let material: Material | null = null;

/**
 * Desaturates the terrain tile layers so the forage heat map reads against them, or restores
 * full color. Safe to call every frame — reapplying the same material is a no-op.
 *
 * @param tilemaps - Background tile layers from the Tiled resource.
 * @param greyscale - True while a heat map layer is active.
 */
export const setTerrainGreyscale = (
  engine: Engine,
  tilemaps: readonly TileMap[],
  greyscale: boolean,
): void => {
  if (greyscale && !material) {
    material = engine.graphicsContext.createMaterial({
      name: "terrain-greyscale",
      fragmentSource: GREYSCALE_FRAGMENT_SOURCE,
    });
  }
  const next = greyscale ? material : null;
  for (const tilemap of tilemaps) {
    const graphics = tilemap.get(GraphicsComponent);
    if (graphics && graphics.material !== next) {
      graphics.material = next;
    }
  }
};
