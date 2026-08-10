/**
 * Procedural pollen / nectar forage fields.
 *
 * Two scalar fields over world space are the **source of truth** for foraging: the heat map
 * overlay, bee target selection, and deposit yield are all views of the same data, so visuals
 * can never disagree with the simulation.
 *
 * Pure module (no runtime imports) so it can be unit tested like `colony-demand.ts`. The PRNG is
 * injected rather than imported — see {@link MakeRng}.
 */
import type { Season } from "../seasons";

export type ForageLayer = "pollen" | "nectar";

/** Seeded PRNG factory; production passes `mulberry32` from `src/colony/rng.ts`. */
export type MakeRng = (seed: number) => () => number;

/**
 * Bumping this changes what a stored seed generates. Old versions must keep working or existing
 * colonies silently wake up in a different world — see `generatorVersion` in the save payload.
 */
export const FORAGE_GENERATOR_VERSION = 1 as const;

/** Tunables for field generation and sampling (playtest knobs). */
export const FORAGE = {
  /** Field cells per axis. Aligned 1:1 with the 30x30 Tiled tile grid (64 world px per cell). */
  fieldCells: 30,
  /** World px per field cell: map is 30 tiles * 128px * 0.5 background scale = 1920px across. */
  cellSizePx: 64,
  /** Blooms generated per layer (inclusive range). */
  bloomsPerLayerMin: 5,
  bloomsPerLayerMax: 7,
  /** Gaussian spread of one bloom (world px). Drives {@link targetRadiusPx}. */
  bloomSigmaMinPx: 120,
  bloomSigmaMaxPx: 320,
  /** Peak bloom value before summing and clamping. */
  bloomAmplitudeMin: 0.4,
  bloomAmplitudeMax: 1,
  /** Fraction of amplitude range awarded purely for distance from the hive (richer far out). */
  bloomDistanceAmplitudeBias: 0.35,
  /** No bloom center inside this radius of the hive at (0,0). The only hard placement rule. */
  hiveExclusionPx: 250,
  /** Low-amplitude texture so flat areas are not perfectly dead. */
  noiseFloorAmplitude: 0.06,
  /** Fixed radius of a player forage target (world px). */
  targetRadiusPx: 200,
  /** Quality gate: near band that must contain at least one bloom per layer. */
  nearBandMinPx: 300,
  nearBandMaxPx: 550,
  /** Quality gate: acceptable mean field value across the whole layer. */
  meanFieldMin: 0.08,
  meanFieldMax: 0.45,
  /** Quality gate: max share of a layer's blooms allowed in a single quadrant. */
  maxQuadrantShare: 0.8,
  /** Quality gate: regeneration attempts before accepting the best-scoring one. */
  maxRerolls: 10,
  /**
   * Deposit yield multiplier range mapped from field value 0..1. Midpoint is 1.0 so a bee at an
   * average cell brings back today's flat amount and overall balance is roughly preserved.
   */
  yieldMultiplierMin: 0.4,
  yieldMultiplierMax: 1.6,
  /** Attempts when rejection-sampling a point by field weight before taking the best seen. */
  weightedSampleAttempts: 8,
} as const;

/** Half-extent of the world in px; the hive sits at (0,0) and the map spans -extent..+extent. */
export const worldExtentPx = (): number => (FORAGE.fieldCells * FORAGE.cellSizePx) / 2;

export type Bloom = {
  readonly cx: number;
  readonly cy: number;
  readonly sigma: number;
  readonly amplitude: number;
  /**
   * Season this bloom peaks in. Generated now so the RNG draw order stays stable, but not yet
   * applied to sampled values — seasonal falloff is a later step.
   */
  readonly peakSeason: Season;
};

export type ForageField = {
  readonly layer: ForageLayer;
  readonly blooms: readonly Bloom[];
  /** Row-major `fieldCells * fieldCells` base values, 0..1. */
  readonly base: Float32Array;
};

export type ForageWorld = {
  readonly seed: number;
  readonly generatorVersion: typeof FORAGE_GENERATOR_VERSION;
  readonly pollen: ForageField;
  readonly nectar: ForageField;
};

const SEASONS: readonly Season[] = ["Spring", "Summer", "Fall", "Winter"];

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** World px center of field cell (col,row). */
const cellCenter = (col: number, row: number): { x: number; y: number } => {
  const extent = worldExtentPx();
  return {
    x: -extent + (col + 0.5) * FORAGE.cellSizePx,
    y: -extent + (row + 0.5) * FORAGE.cellSizePx,
  };
};

/** Field cell index containing a world point, clamped to the grid. */
const cellIndexForWorld = (x: number, y: number): { col: number; row: number } => {
  const extent = worldExtentPx();
  const col = Math.floor((x + extent) / FORAGE.cellSizePx);
  const row = Math.floor((y + extent) / FORAGE.cellSizePx);
  const last = FORAGE.fieldCells - 1;
  return {
    col: Math.min(last, Math.max(0, col)),
    row: Math.min(last, Math.max(0, row)),
  };
};

const generateBlooms = (rand: () => number): Bloom[] => {
  const count =
    FORAGE.bloomsPerLayerMin +
    Math.floor(rand() * (FORAGE.bloomsPerLayerMax - FORAGE.bloomsPerLayerMin + 1));
  const extent = worldExtentPx();
  const blooms: Bloom[] = [];
  for (let i = 0; i < count; i++) {
    let cx = 0;
    let cy = 0;
    // Only hard placement rule: keep bloom centers off the hive. Overlap (within a layer and
    // across layers) is deliberately allowed — coincident blooms are a jackpot, and
    // double-targeting one meadow double-drains it, so overlap is self-limiting.
    for (let attempt = 0; attempt < 24; attempt++) {
      cx = (rand() * 2 - 1) * extent;
      cy = (rand() * 2 - 1) * extent;
      if (Math.hypot(cx, cy) >= FORAGE.hiveExclusionPx) {
        break;
      }
    }
    const sigma = lerp(FORAGE.bloomSigmaMinPx, FORAGE.bloomSigmaMaxPx, rand());
    const distanceFraction = Math.min(1, Math.hypot(cx, cy) / extent);
    const amplitudeRoll = rand();
    // Richer the further out, so the long trip can be worth taking.
    const biased =
      amplitudeRoll * (1 - FORAGE.bloomDistanceAmplitudeBias) +
      distanceFraction * FORAGE.bloomDistanceAmplitudeBias;
    const amplitude = lerp(FORAGE.bloomAmplitudeMin, FORAGE.bloomAmplitudeMax, biased);
    const peakSeason = SEASONS[Math.floor(rand() * SEASONS.length)] ?? "Summer";
    blooms.push({ cx, cy, sigma, amplitude, peakSeason });
  }
  return blooms;
};

/** Sums bloom contributions plus a light noise floor into the row-major base grid. */
const rasterizeBlooms = (
  blooms: readonly Bloom[],
  rand: () => number,
): Float32Array => {
  const n = FORAGE.fieldCells;
  const out = new Float32Array(n * n);
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const { x, y } = cellCenter(col, row);
      let v = 0;
      for (const b of blooms) {
        const dx = x - b.cx;
        const dy = y - b.cy;
        const d2 = dx * dx + dy * dy;
        v += b.amplitude * Math.exp(-d2 / (2 * b.sigma * b.sigma));
      }
      v += rand() * FORAGE.noiseFloorAmplitude;
      out[row * n + col] = clamp01(v);
    }
  }
  return out;
};

const meanOf = (grid: Float32Array): number => {
  let sum = 0;
  for (let i = 0; i < grid.length; i++) {
    sum += grid[i]!;
  }
  return grid.length > 0 ? sum / grid.length : 0;
};

/**
 * Quality gate. Replaces placement constraints: blooms may land anywhere relative to each other,
 * but a whole generated layer is rejected if it would play badly.
 *
 * @returns 0..3 checks passed.
 */
export const scoreLayer = (field: ForageField): number => {
  let score = 0;

  const hasNearBloom = field.blooms.some((b) => {
    const d = Math.hypot(b.cx, b.cy);
    return d >= FORAGE.nearBandMinPx && d <= FORAGE.nearBandMaxPx;
  });
  if (hasNearBloom) {
    score += 1;
  }

  const mean = meanOf(field.base);
  if (mean >= FORAGE.meanFieldMin && mean <= FORAGE.meanFieldMax) {
    score += 1;
  }

  const quadrants = [0, 0, 0, 0];
  for (const b of field.blooms) {
    const q = (b.cx >= 0 ? 1 : 0) + (b.cy >= 0 ? 2 : 0);
    quadrants[q] = (quadrants[q] ?? 0) + 1;
  }
  const worstShare = Math.max(...quadrants) / Math.max(1, field.blooms.length);
  if (worstShare <= FORAGE.maxQuadrantShare) {
    score += 1;
  }

  return score;
};

const generateLayer = (
  layer: ForageLayer,
  seed: number,
  makeRng: MakeRng,
): ForageField => {
  const rand = makeRng(seed);
  const blooms = generateBlooms(rand);
  return { layer, blooms, base: rasterizeBlooms(blooms, rand) };
};

/**
 * Generates one layer, rerolling while the quality gate fails. Falls back to the best-scoring
 * attempt so generation always terminates with a usable field.
 */
const generateLayerWithGate = (
  layer: ForageLayer,
  seed: number,
  makeRng: MakeRng,
): ForageField => {
  let best: ForageField | null = null;
  let bestScore = -1;
  for (let attempt = 0; attempt < FORAGE.maxRerolls; attempt++) {
    // Distinct sub-seed per attempt keeps the whole process deterministic in `seed`.
    const candidate = generateLayer(
      layer,
      (seed + attempt * 0x9e3779b1) >>> 0,
      makeRng,
    );
    const score = scoreLayer(candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
    if (score === 3) {
      return candidate;
    }
  }
  return best!;
};

/** Builds both layers deterministically from one save seed. */
export const generateForageWorld = (seed: number, makeRng: MakeRng): ForageWorld => ({
  seed,
  generatorVersion: FORAGE_GENERATOR_VERSION,
  // Distinct sub-seeds so the two layers are independent draws rather than identical fields.
  pollen: generateLayerWithGate("pollen", (seed ^ 0x5bf03635) >>> 0, makeRng),
  nectar: generateLayerWithGate("nectar", (seed ^ 0x27d4eb2f) >>> 0, makeRng),
});

/** Raw cell value by grid index (no interpolation). */
export const fieldValueAtCell = (
  field: ForageField,
  col: number,
  row: number,
): number => {
  const n = FORAGE.fieldCells;
  if (col < 0 || row < 0 || col >= n || row >= n) {
    return 0;
  }
  return field.base[row * n + col] ?? 0;
};

/**
 * Bilinearly interpolated field value at a world point, so the field reads smooth to bees
 * rather than stepping at 64px cell boundaries.
 */
export const sampleFieldAtWorld = (
  field: ForageField,
  x: number,
  y: number,
): number => {
  const extent = worldExtentPx();
  const fx = (x + extent) / FORAGE.cellSizePx - 0.5;
  const fy = (y + extent) / FORAGE.cellSizePx - 0.5;
  const c0 = Math.floor(fx);
  const r0 = Math.floor(fy);
  const tx = fx - c0;
  const ty = fy - r0;
  const v00 = fieldValueAtCell(field, c0, r0);
  const v10 = fieldValueAtCell(field, c0 + 1, r0);
  const v01 = fieldValueAtCell(field, c0, r0 + 1);
  const v11 = fieldValueAtCell(field, c0 + 1, r0 + 1);
  return lerp(lerp(v00, v10, tx), lerp(v01, v11, tx), ty);
};

/**
 * Maps a field value to a deposit multiplier. Midpoint 1.0 keeps an average cell equivalent to
 * the previous flat deposit amount.
 */
export const yieldMultiplierForFieldValue = (value: number): number =>
  lerp(FORAGE.yieldMultiplierMin, FORAGE.yieldMultiplierMax, clamp01(value));

export type ForagePoint = {
  readonly x: number;
  readonly y: number;
  readonly value: number;
};

/**
 * Picks a forage point weighted by field value via rejection sampling, so bees cluster on the
 * good part of wherever they are looking instead of spreading uniformly.
 *
 * @param originX - Center of the search area; the whole map when no target is set.
 * @param radius - Search radius (world px).
 */
export const sampleWeightedPoint = (
  field: ForageField,
  rand: () => number,
  originX: number,
  originY: number,
  radius: number,
): ForagePoint => {
  let best: ForagePoint | null = null;
  for (let i = 0; i < FORAGE.weightedSampleAttempts; i++) {
    // Uniform over the disc: sqrt keeps points from bunching at the center.
    const theta = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * radius;
    const x = originX + Math.cos(theta) * r;
    const y = originY + Math.sin(theta) * r;
    const extent = worldExtentPx();
    if (Math.abs(x) > extent || Math.abs(y) > extent) {
      continue;
    }
    const value = sampleFieldAtWorld(field, x, y);
    if (!best || value > best.value) {
      best = { x, y, value };
    }
    if (rand() < value) {
      return { x, y, value };
    }
  }
  if (best) {
    return best;
  }
  const { x, y } = cellCenter(0, 0);
  return { x, y, value: sampleFieldAtWorld(field, x, y) };
};

/**
 * Whole-map weighted pick, used until the player sets a target for this layer. Already strictly
 * better than a uniform roll over flower tiles.
 */
export const sampleForagePoint = (
  field: ForageField,
  rand: () => number,
): ForagePoint => sampleWeightedPoint(field, rand, 0, 0, worldExtentPx() * Math.SQRT2);

export { cellCenter as forageCellCenter, cellIndexForWorld as forageCellIndexForWorld };
