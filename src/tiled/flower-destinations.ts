import type { Vector } from "excalibur";
import type { TiledResource } from "@excaliburjs/plugin-tiled";

export const getFlowerDestinations = (map: TiledResource): Vector[] => {
  // Tiled custom properties can come through as boolean true or string "true"
  // depending on source format/export options.
  const tiles = [
    ...map.getTilesByProperty("flower", true),
    ...map.getTilesByProperty("flower", "true"),
  ];
  const unique = new Map<string, Vector>();

  for (const t of tiles) {
    const c = t.exTile.center;
    unique.set(`${Math.round(c.x)},${Math.round(c.y)}`, c);
  }

  return [...unique.values()];
};
