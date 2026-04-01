import type { LineageEntry } from "./meta-progress";

/**
 * Multipliers applied on top of {@link COLONY} (1 = no change).
 * Primary bonuses use values >1 where “more is better”; drain uses <1 for slower drain.
 */
export type LineageMultipliers = {
  pollenCellCapacityMul: number;
  nectarCellCapacityMul: number;
  forageTimeMul: number;
  broodCycleMul: number;
  honeyProcessRateMul: number;
  depositYieldMul: number;
  needsDrainMul: number;
  cellBuildMul: number;
};

const IDENTITY: LineageMultipliers = {
  pollenCellCapacityMul: 1,
  nectarCellCapacityMul: 1,
  forageTimeMul: 1,
  broodCycleMul: 1,
  honeyProcessRateMul: 1,
  depositYieldMul: 1,
  needsDrainMul: 1,
  cellBuildMul: 1,
};

/** Affix families for diminishing stacking (same key stacks with diminishing returns). */
const AFFIX_AXIS: Record<string, keyof LineageMultipliers> = {
  food_cell_cap: "pollenCellCapacityMul",
  nectar_cell_cap: "nectarCellCapacityMul",
  swift_forage: "forageTimeMul",
  brood_pulse: "broodCycleMul",
  honey_press: "honeyProcessRateMul",
  heavy_haul: "depositYieldMul",
  calm_metabolism: "needsDrainMul",
  mason_wing: "cellBuildMul",
};

/** Per-axis fractional bonus cap after combining picks (e.g. 0.35 = +35% max). */
const SOFT_CAP_PER_AXIS = 0.35;

/**
 * Combines fractional bonuses b_i with diminishing product: 1 - ∏(1 - clamp(b_i)).
 */
function combineFractionalBonuses(fractions: number[]): number {
  let product = 1;
  for (const f of fractions) {
    const x = Math.max(0, Math.min(0.99, f));
    product *= 1 - x;
  }
  return Math.min(SOFT_CAP_PER_AXIS, 1 - product);
}

/**
 * Maps each lineage entry’s affix to a fractional **primary** bonus from magnitude (already tier-scaled).
 */
function entryPrimaryFraction(
  entry: LineageEntry,
): { axis: keyof LineageMultipliers; fraction: number } | null {
  const axis = AFFIX_AXIS[entry.affixId];
  if (!axis) {
    return null;
  }
  return { axis, fraction: Math.max(0, entry.magnitude) };
}

/**
 * For axes where lower multiplier is better (forage time, brood cycle, needs drain), convert bonus fraction f to mul = 1 - combined(f).
 */
export function aggregateLineageMultipliers(
  lineage: LineageEntry[],
): LineageMultipliers {
  if (lineage.length === 0) {
    return { ...IDENTITY };
  }

  const byAxis = new Map<keyof LineageMultipliers, number[]>();
  for (const e of lineage) {
    const mapped = entryPrimaryFraction(e);
    if (!mapped) {
      continue;
    }
    const list = byAxis.get(mapped.axis) ?? [];
    list.push(mapped.fraction);
    byAxis.set(mapped.axis, list);
    if (e.affixId === "food_cell_cap") {
      const nList = byAxis.get("nectarCellCapacityMul") ?? [];
      nList.push(mapped.fraction);
      byAxis.set("nectarCellCapacityMul", nList);
    }
  }

  const out: LineageMultipliers = { ...IDENTITY };

  const capMul = (axis: keyof LineageMultipliers, fractions: number[]): void => {
    const combined = combineFractionalBonuses(fractions);
    if (
      axis === "forageTimeMul" ||
      axis === "broodCycleMul" ||
      axis === "needsDrainMul"
    ) {
      (out as Record<string, number>)[axis] = Math.max(0.65, 1 - combined);
    } else {
      (out as Record<string, number>)[axis] = 1 + combined;
    }
  };

  for (const [axis, frs] of byAxis) {
    capMul(axis, frs);
  }

  return out;
}
