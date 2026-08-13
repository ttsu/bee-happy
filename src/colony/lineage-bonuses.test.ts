import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COLONY } from "./constants.ts";
import { aggregateLineageMultipliers } from "./meta/lineage-aggregate.ts";
import type { LineageEntry } from "./meta/meta-progress.ts";

const entry = (
  affixId: string,
  magnitude: number,
  tier: 1 | 2 | 3 | 4 | 5 = 1,
): LineageEntry => ({
  affixId,
  displayName: affixId,
  tier,
  magnitude,
  successionReason: "hiveExpanded",
  recordedAtIso: "2026-01-01T00:00:00.000Z",
  generationIndex: 0,
});

describe("aggregateLineageMultipliers flat bonuses", () => {
  it("adds whole-unit capacity for Deep Pantry", () => {
    const m = aggregateLineageMultipliers([entry("food_cell_cap", 1)]);
    assert.equal(m.pollenCellCapacityFlat, 1);
    assert.equal(m.nectarCellCapacityFlat, 1);
    assert.equal(
      COLONY.pollenCellCapacity + m.pollenCellCapacityFlat,
      COLONY.pollenCellCapacity + 1,
    );
  });

  it("adds whole-unit deposit yield for Heavy Haul", () => {
    const m = aggregateLineageMultipliers([entry("heavy_haul", 1)]);
    assert.equal(m.foragePollenDepositFlat, 1);
    assert.equal(m.forageNectarDepositFlat, 1);
    assert.equal(
      COLONY.foragePollenDepositAmount + m.foragePollenDepositFlat,
      COLONY.foragePollenDepositAmount + 1,
    );
  });

  it("converts legacy fractional capacity magnitudes to at least +1", () => {
    const m = aggregateLineageMultipliers([entry("nectar_cell_cap", 0.06)]);
    assert.equal(m.nectarCellCapacityFlat, 1);
  });
});

describe("aggregateLineageMultipliers tradeoffs", () => {
  it("applies honey processing penalty for Deep Pantry", () => {
    const m = aggregateLineageMultipliers([entry("food_cell_cap", 1)]);
    assert.ok(m.tradeoffHoneyProcessFrac > 0);
  });

  it("applies flat nectar capacity penalty for Swift Forager", () => {
    const m = aggregateLineageMultipliers([entry("swift_forage", 0.07)]);
    assert.equal(m.tradeoffNectarCapacityFlat, 1);
  });

  it("applies hunger drain penalty for Brood Pulse", () => {
    const m = aggregateLineageMultipliers([entry("brood_pulse", 0.06)]);
    assert.ok(m.tradeoffNeedsDrainFrac > 0);
  });

  it("applies move speed penalty for Heavy Haul", () => {
    const m = aggregateLineageMultipliers([entry("heavy_haul", 1)]);
    assert.ok(m.tradeoffBeeSpeedFrac > 0);
  });

  it("applies starting pollen penalty for Mason Wing", () => {
    const m = aggregateLineageMultipliers([entry("mason_wing", 0.07)]);
    assert.equal(m.tradeoffInitialPollenFlat, 1);
  });
});
