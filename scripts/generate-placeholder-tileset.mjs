import { PNG } from "pngjs";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const TILE_W = 128;
const TILE_H = 128;
const COLUMNS = 14;
const ROWS = 7; // 14 * 7 = 98 tiles (matches terrain.tsx tilecount)

const IMAGE_W = TILE_W * COLUMNS; // 1792
const IMAGE_H = TILE_H * ROWS; // 896

const outPath = process.argv[2] ?? resolve(process.cwd(), "public/tiled/terrain.png");

mkdirSync(dirname(outPath), { recursive: true });

const png = new PNG({ width: IMAGE_W, height: IMAGE_H });

const setPixel = (x, y, r, g, b, a = 255) => {
  const idx = (png.width * y + x) << 2;
  png.data[idx] = r;
  png.data[idx + 1] = g;
  png.data[idx + 2] = b;
  png.data[idx + 3] = a;
};

const hashToColor = (n) => {
  // Simple deterministic hash -> pleasant-ish palette.
  let x = (n + 1) * 2654435761;
  x ^= x >>> 13;
  x *= 2246822519;
  x ^= x >>> 16;
  const r = 64 + (x & 0x7f);
  const g = 64 + ((x >>> 8) & 0x7f);
  const b = 64 + ((x >>> 16) & 0x7f);
  return [r, g, b];
};

for (let tileId = 0; tileId < COLUMNS * ROWS; tileId++) {
  const tileX = tileId % COLUMNS;
  const tileY = Math.floor(tileId / COLUMNS);
  const x0 = tileX * TILE_W;
  const y0 = tileY * TILE_H;

  const [r, g, b] = hashToColor(tileId);

  for (let y = 0; y < TILE_H; y++) {
    for (let x = 0; x < TILE_W; x++) {
      const isBorder = x === 0 || y === 0 || x === TILE_W - 1 || y === TILE_H - 1;
      const shade = isBorder ? 0.55 : 1.0;
      setPixel(
        x0 + x,
        y0 + y,
        Math.round(r * shade),
        Math.round(g * shade),
        Math.round(b * shade),
        255,
      );
    }
  }
}

writeFileSync(outPath, PNG.sync.write(png));
console.log(`Wrote placeholder tileset: ${outPath}`);
