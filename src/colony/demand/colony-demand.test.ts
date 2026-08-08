import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COLONY } from "../constants.ts";
import {
  computeColonyDemand,
  computeWinterHoneyNeed,
  type ColonyDemandConstants,
  type ColonyDemandInput,
} from "./colony-demand.ts";

const baseConstants = (): ColonyDemandConstants => ({
  workerLifespanMs: COLONY.workerLifespanMs,
  hungerPerSec: COLONY.hungerPerSec,
  hungerRelief: COLONY.hungerRelief,
  adultFeedHoneyCost: COLONY.adultFeedHoneyCost,
  adultFeedPollenCost: COLONY.adultFeedPollenCost,
  larvaePollenUnitsNeeded: COLONY.larvaePollenUnitsNeeded,
  larvaeNectarUnitsNeeded: COLONY.larvaeNectarUnitsNeeded,
  honeyNutrientMultiplier: COLONY.honeyNutrientMultiplier,
});

const baseInput = (over: Partial<ColonyDemandInput> = {}): ColonyDemandInput => ({
  beesTotal: 0,
  pollenStored: 0,
  pollenCapacity: 0,
  nectarStored: 0,
  honeyStored: 0,
  honeyCapacity: 0,
  broodTotal: 0,
  broodEmpty: 0,
  eggCount: 0,
  larvaePollenBacklog: 0,
  larvaeNectarBacklog: 0,
  daysPerSeason: 15,
  season: "Spring",
  constants: baseConstants(),
  ...over,
});

describe("computeWinterHoneyNeed", () => {
  it("scales with bee count and season length", () => {
    const C = baseConstants();
    const oneBee = computeWinterHoneyNeed(1, 15, C);
    const twoBees = computeWinterHoneyNeed(2, 15, C);
    const longer = computeWinterHoneyNeed(1, 30, C);
    assert.ok(oneBee > 0);
    assert.equal(twoBees, oneBee * 2);
    assert.equal(longer, oneBee * 2);
  });
});

describe("computeColonyDemand", () => {
  it("returns zero-ish demand for an empty hive with no bees", () => {
    const r = computeColonyDemand(baseInput());
    assert.equal(r.demandPollen, 0);
    assert.equal(r.demandNectar, 0);
    assert.equal(r.demandBrood, 0);
    assert.equal(r.winterHoneyNeed, 0);
  });

  it("raises pollen demand from larvae backlog vs tiny capacity", () => {
    const r = computeColonyDemand(
      baseInput({
        larvaePollenBacklog: 12,
        pollenCapacity: 12,
        pollenStored: 0,
      }),
    );
    // needed at least 12 vs capacity 12 → capacityFactor 1 → full demand
    assert.equal(r.demandPollen, 1);
  });

  it("sets brood demand to 0 when food cannot grow a full brood", () => {
    const r = computeColonyDemand(
      baseInput({
        broodTotal: 4,
        broodEmpty: 0,
        pollenStored: 0,
        nectarStored: 0,
        honeyStored: 0,
      }),
    );
    assert.equal(r.demandBrood, 0);
  });

  it("sets high brood demand when food is enough and no empty slots", () => {
    const r = computeColonyDemand(
      baseInput({
        broodTotal: 2,
        broodEmpty: 0,
        pollenStored: 20,
        nectarStored: 10,
        honeyStored: 0,
      }),
    );
    assert.equal(r.demandBrood, 1);
  });

  it("keeps brood demand low when empty slots exist even with food", () => {
    const r = computeColonyDemand(
      baseInput({
        broodTotal: 4,
        broodEmpty: 4,
        pollenStored: 40,
        nectarStored: 20,
      }),
    );
    assert.equal(r.demandBrood, 0);
  });

  it("increases nectar demand in Fall via winter plan weight", () => {
    const spring = computeColonyDemand(
      baseInput({
        beesTotal: 10,
        honeyCapacity: 12,
        season: "Spring",
        daysPerSeason: 15,
      }),
    );
    const fall = computeColonyDemand(
      baseInput({
        beesTotal: 10,
        honeyCapacity: 12,
        season: "Fall",
        daysPerSeason: 15,
      }),
    );
    assert.ok(fall.demandNectar >= spring.demandNectar);
    assert.ok(fall.winterHoneyNeed > 0);
    assert.equal(fall.winterHoneyNeed, spring.winterHoneyNeed);
  });
});
