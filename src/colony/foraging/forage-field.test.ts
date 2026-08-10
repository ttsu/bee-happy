import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mulberry32 } from "../rng.ts";
import {
  FORAGE,
  FORAGE_GENERATOR_VERSION,
  generateForageWorld,
  sampleFieldAtWorld,
  sampleForagePoint,
  sampleWeightedPoint,
  scoreLayer,
  worldExtentPx,
  yieldMultiplierForFieldValue,
  type Bloom,
  type ForageField,
} from "./forage-field.ts";

const SEEDS = [1, 7, 42, 1337, 90210, 0xdecafbad];

describe("generateForageWorld", () => {
  it("is deterministic in the seed", () => {
    for (const seed of SEEDS) {
      const a = generateForageWorld(seed, mulberry32);
      const b = generateForageWorld(seed, mulberry32);
      assert.deepEqual([...a.pollen.base], [...b.pollen.base]);
      assert.deepEqual([...a.nectar.base], [...b.nectar.base]);
      assert.deepEqual(a.pollen.blooms, b.pollen.blooms);
    }
  });

  it("produces different fields for different seeds", () => {
    const a = generateForageWorld(1, mulberry32);
    const b = generateForageWorld(2, mulberry32);
    assert.notDeepEqual([...a.pollen.base], [...b.pollen.base]);
  });

  it("generates independent pollen and nectar layers from one seed", () => {
    for (const seed of SEEDS) {
      const w = generateForageWorld(seed, mulberry32);
      assert.notDeepEqual([...w.pollen.base], [...w.nectar.base]);
    }
  });

  it("stamps the generator version so retuning cannot silently move old worlds", () => {
    assert.equal(
      generateForageWorld(1, mulberry32).generatorVersion,
      FORAGE_GENERATOR_VERSION,
    );
  });

  it("keeps bloom centers off the hive and inside the world", () => {
    const extent = worldExtentPx();
    for (const seed of SEEDS) {
      const w = generateForageWorld(seed, mulberry32);
      for (const layer of [w.pollen, w.nectar]) {
        for (const b of layer.blooms) {
          assert.ok(
            Math.hypot(b.cx, b.cy) >= FORAGE.hiveExclusionPx,
            `bloom at ${b.cx},${b.cy} sits on the hive`,
          );
          assert.ok(Math.abs(b.cx) <= extent && Math.abs(b.cy) <= extent);
        }
      }
    }
  });

  it("emits values clamped to 0..1", () => {
    const w = generateForageWorld(99, mulberry32);
    for (const layer of [w.pollen, w.nectar]) {
      for (const v of layer.base) {
        assert.ok(v >= 0 && v <= 1, `value ${v} out of range`);
      }
    }
  });

  it("allows overlap between layers rather than forcing them apart", () => {
    // Regression guard for a deliberate design choice: nothing may push nectar blooms away
    // from pollen blooms. Across many seeds at least one pair should land close together.
    let sawClosePair = false;
    for (let seed = 0; seed < 60 && !sawClosePair; seed++) {
      const w = generateForageWorld(seed, mulberry32);
      for (const p of w.pollen.blooms) {
        for (const n of w.nectar.blooms) {
          if (Math.hypot(p.cx - n.cx, p.cy - n.cy) < 200) {
            sawClosePair = true;
          }
        }
      }
    }
    assert.ok(
      sawClosePair,
      "no overlapping blooms found; is anti-correlation leaking in?",
    );
  });
});

describe("scoreLayer", () => {
  const fieldFromBlooms = (blooms: Bloom[], base: number[]): ForageField => ({
    layer: "pollen",
    blooms,
    base: Float32Array.from(base),
  });

  const flatBase = (v: number): number[] =>
    new Array(FORAGE.fieldCells * FORAGE.fieldCells).fill(v);

  const bloomAt = (cx: number, cy: number): Bloom => ({
    cx,
    cy,
    sigma: 200,
    amplitude: 0.7,
    peakSeason: "Summer",
  });

  it("passes a well-formed layer", () => {
    const blooms = [bloomAt(400, 0), bloomAt(-700, 300), bloomAt(200, -800)];
    assert.equal(scoreLayer(fieldFromBlooms(blooms, flatBase(0.2))), 3);
  });

  it("fails a layer with nothing in the near band", () => {
    const blooms = [bloomAt(900, 0), bloomAt(-800, 400), bloomAt(100, -900)];
    assert.ok(scoreLayer(fieldFromBlooms(blooms, flatBase(0.2))) < 3);
  });

  it("fails a starved layer and a saturated one", () => {
    const blooms = [bloomAt(400, 0), bloomAt(-700, 300), bloomAt(200, -800)];
    assert.ok(scoreLayer(fieldFromBlooms(blooms, flatBase(0.0))) < 3);
    assert.ok(scoreLayer(fieldFromBlooms(blooms, flatBase(0.95))) < 3);
  });

  it("fails a layer crammed into one quadrant", () => {
    const blooms = [bloomAt(400, 400), bloomAt(500, 600), bloomAt(700, 500)];
    assert.ok(scoreLayer(fieldFromBlooms(blooms, flatBase(0.2))) < 3);
  });

  it("gates generated layers to a passing score", () => {
    for (const seed of SEEDS) {
      const w = generateForageWorld(seed, mulberry32);
      assert.equal(
        scoreLayer(w.pollen),
        3,
        `pollen layer failed gate for seed ${seed}`,
      );
      assert.equal(
        scoreLayer(w.nectar),
        3,
        `nectar layer failed gate for seed ${seed}`,
      );
    }
  });
});

describe("sampleFieldAtWorld", () => {
  it("interpolates between cells instead of stepping", () => {
    const w = generateForageWorld(5, mulberry32);
    const step = FORAGE.cellSizePx / 4;
    let sawIntermediate = false;
    for (let x = -400; x < 400; x += step) {
      const a = sampleFieldAtWorld(w.pollen, x, 0);
      const b = sampleFieldAtWorld(w.pollen, x + step, 0);
      if (a !== b) {
        sawIntermediate = true;
      }
    }
    assert.ok(sawIntermediate);
  });

  it("clamps outside the world rather than throwing", () => {
    const w = generateForageWorld(5, mulberry32);
    const far = worldExtentPx() * 4;
    for (const [x, y] of [
      [far, 0],
      [-far, 0],
      [0, far],
      [-far, -far],
    ]) {
      const v = sampleFieldAtWorld(w.pollen, x!, y!);
      assert.ok(Number.isFinite(v) && v >= 0 && v <= 1);
    }
  });

  it("reads highest at a bloom center", () => {
    const w = generateForageWorld(11, mulberry32);
    const strongest = [...w.pollen.blooms].sort(
      (a, b) => b.amplitude - a.amplitude,
    )[0]!;
    const atCenter = sampleFieldAtWorld(w.pollen, strongest.cx, strongest.cy);
    const offset = strongest.sigma * 3;
    const away = sampleFieldAtWorld(w.pollen, strongest.cx + offset, strongest.cy);
    assert.ok(atCenter > away, "bloom center should read hotter than its far edge");
  });
});

describe("sampleWeightedPoint", () => {
  it("stays inside the target radius", () => {
    const w = generateForageWorld(3, mulberry32);
    const rand = mulberry32(77);
    for (let i = 0; i < 400; i++) {
      const p = sampleWeightedPoint(w.pollen, rand, 300, -200, FORAGE.targetRadiusPx);
      const d = Math.hypot(p.x - 300, p.y + 200);
      assert.ok(d <= FORAGE.targetRadiusPx + 1e-6, `sampled ${d}px from target center`);
    }
  });

  it("favors richer ground over a uniform pick", () => {
    const w = generateForageWorld(23, mulberry32);
    const rand = mulberry32(4);
    let weighted = 0;
    let uniform = 0;
    const n = 800;
    for (let i = 0; i < n; i++) {
      weighted += sampleForagePoint(w.pollen, rand).value;
      const extent = worldExtentPx();
      uniform += sampleFieldAtWorld(
        w.pollen,
        (rand() * 2 - 1) * extent,
        (rand() * 2 - 1) * extent,
      );
    }
    assert.ok(
      weighted / n > uniform / n,
      `weighted ${weighted / n} should beat uniform ${uniform / n}`,
    );
  });

  it("returns finite in-world points", () => {
    const w = generateForageWorld(8, mulberry32);
    const rand = mulberry32(9);
    const extent = worldExtentPx();
    for (let i = 0; i < 200; i++) {
      const p = sampleForagePoint(w.nectar, rand);
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
      assert.ok(Math.abs(p.x) <= extent && Math.abs(p.y) <= extent);
    }
  });
});

describe("yieldMultiplierForFieldValue", () => {
  it("keeps an average cell equivalent to the previous flat deposit", () => {
    assert.equal(yieldMultiplierForFieldValue(0.5), 1);
  });

  it("spans the configured range and clamps beyond it", () => {
    assert.equal(yieldMultiplierForFieldValue(0), FORAGE.yieldMultiplierMin);
    assert.equal(yieldMultiplierForFieldValue(1), FORAGE.yieldMultiplierMax);
    assert.equal(yieldMultiplierForFieldValue(-5), FORAGE.yieldMultiplierMin);
    assert.equal(yieldMultiplierForFieldValue(5), FORAGE.yieldMultiplierMax);
  });
});
