import type { LineageEntry, RarityTier } from "./meta-progress";

/** Base stats used when converting legacy fractional magnitudes to flat bonuses. */
const LEGACY_FLAT_BASE_BY_AFFIX: Record<string, number> = {
  food_cell_cap: 12,
  nectar_cell_cap: 12,
  heavy_haul: 4,
};

/**
 * Primary bonuses and tradeoff penalties applied on top of {@link COLONY}.
 * Multipliers use 1 = no change; fraction penalties are 0 = none.
 */
export type LineageMultipliers = {
  pollenCellCapacityFlat: number;
  nectarCellCapacityFlat: number;
  foragePollenDepositFlat: number;
  forageNectarDepositFlat: number;
  forageTimeMul: number;
  broodCycleMul: number;
  honeyProcessRateMul: number;
  needsDrainMul: number;
  cellBuildMul: number;
  tradeoffHoneyProcessFrac: number;
  tradeoffNectarCapacityFlat: number;
  tradeoffNeedsDrainFrac: number;
  tradeoffQueenLayIntervalFrac: number;
  tradeoffBeeSpeedFrac: number;
  tradeoffCellBuildFrac: number;
  tradeoffInitialPollenFlat: number;
  tradeoffForageTimeFrac: number;
};

const IDENTITY: LineageMultipliers = {
  pollenCellCapacityFlat: 0,
  nectarCellCapacityFlat: 0,
  foragePollenDepositFlat: 0,
  forageNectarDepositFlat: 0,
  forageTimeMul: 1,
  broodCycleMul: 1,
  honeyProcessRateMul: 1,
  needsDrainMul: 1,
  cellBuildMul: 1,
  tradeoffHoneyProcessFrac: 0,
  tradeoffNectarCapacityFlat: 0,
  tradeoffNeedsDrainFrac: 0,
  tradeoffQueenLayIntervalFrac: 0,
  tradeoffBeeSpeedFrac: 0,
  tradeoffCellBuildFrac: 0,
  tradeoffInitialPollenFlat: 0,
  tradeoffForageTimeFrac: 0,
};

type FractionAxis = Exclude<
  keyof LineageMultipliers,
  | "pollenCellCapacityFlat"
  | "nectarCellCapacityFlat"
  | "foragePollenDepositFlat"
  | "forageNectarDepositFlat"
  | "tradeoffNectarCapacityFlat"
  | "tradeoffInitialPollenFlat"
>;

type FractionTradeoffAxis = Extract<
  keyof LineageMultipliers,
  | "tradeoffHoneyProcessFrac"
  | "tradeoffNeedsDrainFrac"
  | "tradeoffQueenLayIntervalFrac"
  | "tradeoffBeeSpeedFrac"
  | "tradeoffCellBuildFrac"
  | "tradeoffForageTimeFrac"
>;

type FlatTradeoffAxis = Extract<
  keyof LineageMultipliers,
  "tradeoffNectarCapacityFlat" | "tradeoffInitialPollenFlat"
>;

/** Affix families for diminishing stacking (same key stacks with diminishing returns). */
const FRACTION_AFFIX_AXIS: Record<string, FractionAxis> = {
  swift_forage: "forageTimeMul",
  brood_pulse: "broodCycleMul",
  honey_press: "honeyProcessRateMul",
  calm_metabolism: "needsDrainMul",
  mason_wing: "cellBuildMul",
};

type FlatAxis =
  | "pollenCellCapacityFlat"
  | "nectarCellCapacityFlat"
  | "foragePollenDepositFlat"
  | "forageNectarDepositFlat";

const FLAT_AFFIX_AXIS: Record<string, FlatAxis | FlatAxis[]> = {
  food_cell_cap: ["pollenCellCapacityFlat", "nectarCellCapacityFlat"],
  nectar_cell_cap: "nectarCellCapacityFlat",
  heavy_haul: ["foragePollenDepositFlat", "forageNectarDepositFlat"],
};

const FRACTION_TRADEOFF_AXIS: Record<string, FractionTradeoffAxis> = {
  food_cell_cap: "tradeoffHoneyProcessFrac",
  brood_pulse: "tradeoffNeedsDrainFrac",
  honey_press: "tradeoffQueenLayIntervalFrac",
  heavy_haul: "tradeoffBeeSpeedFrac",
  calm_metabolism: "tradeoffCellBuildFrac",
  nectar_cell_cap: "tradeoffForageTimeFrac",
};

const FLAT_TRADEOFF_AXIS: Record<string, FlatTradeoffAxis> = {
  swift_forage: "tradeoffNectarCapacityFlat",
  mason_wing: "tradeoffInitialPollenFlat",
};

/** Mirrors {@link TIER_SCALE_TRADEOFF} in lineage-affixes (tradeoff penalty tier scaling). */
const TRADEOFF_TIER_SCALE: Record<RarityTier, number> = {
  1: 1.2,
  2: 1.05,
  3: 0.9,
  4: 0.72,
  5: 0.55,
};

/** Fractional tradeoff base magnitudes (tier 1), aligned with lineage-affix defs. */
const FRACTION_TRADEOFF_BASE: Record<string, number> = {
  food_cell_cap: 0.06,
  brood_pulse: 0.06,
  honey_press: 0.06,
  heavy_haul: 0.05,
  calm_metabolism: 0.06,
  nectar_cell_cap: 0.06,
};

function tradeoffPenaltyForEntry(entry: LineageEntry): number {
  if (FLAT_TRADEOFF_AXIS[entry.affixId]) {
    return Math.max(1, Math.round(TRADEOFF_TIER_SCALE[entry.tier]));
  }
  const base = FRACTION_TRADEOFF_BASE[entry.affixId];
  if (!base) {
    return 0;
  }
  return base * TRADEOFF_TIER_SCALE[entry.tier];
}

/** Per-axis fractional bonus cap after combining picks (e.g. 0.35 = +35% max). */
const SOFT_CAP_PER_AXIS = 0.35;

/** Max stacked flat bonus per axis (roughly matches the old ~35% cap on base stats). */
const SOFT_CAP_FLAT: Record<FlatAxis, number> = {
  pollenCellCapacityFlat: 4,
  nectarCellCapacityFlat: 4,
  foragePollenDepositFlat: 2,
  forageNectarDepositFlat: 2,
};

const SOFT_CAP_FLAT_TRADEOFF: Record<FlatTradeoffAxis, number> = {
  tradeoffNectarCapacityFlat: 4,
  tradeoffInitialPollenFlat: 6,
};

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

function combineFlatBonuses(values: number[], cap: number): number {
  return Math.min(
    cap,
    values.reduce((sum, value) => sum + value, 0),
  );
}

/**
 * Legacy saves stored fractional magnitudes for capacity/deposit affixes.
 * Convert those to a guaranteed minimum flat bonus of 1.
 */
function legacyFractionToFlat(magnitude: number, baseStat: number): number {
  return Math.max(1, Math.round(magnitude * baseStat));
}

function entryPrimaryFlatBonus(
  entry: LineageEntry,
): { axis: FlatAxis; bonus: number }[] {
  const axes = FLAT_AFFIX_AXIS[entry.affixId];
  if (!axes) {
    return [];
  }
  const axisList = Array.isArray(axes) ? axes : [axes];
  const isLegacyFraction = entry.magnitude > 0 && entry.magnitude < 1;
  const bonus = isLegacyFraction
    ? legacyFractionToFlat(
        entry.magnitude,
        LEGACY_FLAT_BASE_BY_AFFIX[entry.affixId] ?? 1,
      )
    : Math.max(0, Math.round(entry.magnitude));
  return axisList.map((axis) => ({ axis, bonus }));
}

/**
 * Maps each lineage entry’s affix to a fractional **primary** bonus from magnitude (already tier-scaled).
 */
function entryPrimaryFraction(
  entry: LineageEntry,
): { axis: FractionAxis; fraction: number } | null {
  const axis = FRACTION_AFFIX_AXIS[entry.affixId];
  if (!axis) {
    return null;
  }
  return { axis, fraction: Math.max(0, entry.magnitude) };
}

function entryTradeoffPenalty(
  entry: LineageEntry,
):
  | { axis: FractionTradeoffAxis; fraction: number }
  | { axis: FlatTradeoffAxis; penalty: number }
  | null {
  const penalty = tradeoffPenaltyForEntry(entry);
  const flatAxis = FLAT_TRADEOFF_AXIS[entry.affixId];
  if (flatAxis) {
    return { axis: flatAxis, penalty: Math.max(1, Math.round(penalty)) };
  }
  const fractionAxis = FRACTION_TRADEOFF_AXIS[entry.affixId];
  if (!fractionAxis) {
    return null;
  }
  return { axis: fractionAxis, fraction: Math.max(0, penalty) };
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

  const flatByAxis = new Map<FlatAxis, number[]>();
  const fractionByAxis = new Map<FractionAxis, number[]>();
  const flatTradeoffByAxis = new Map<FlatTradeoffAxis, number[]>();
  const fractionTradeoffByAxis = new Map<FractionTradeoffAxis, number[]>();

  for (const entry of lineage) {
    for (const { axis, bonus } of entryPrimaryFlatBonus(entry)) {
      const list = flatByAxis.get(axis) ?? [];
      list.push(bonus);
      flatByAxis.set(axis, list);
    }

    const mapped = entryPrimaryFraction(entry);
    if (mapped) {
      const list = fractionByAxis.get(mapped.axis) ?? [];
      list.push(mapped.fraction);
      fractionByAxis.set(mapped.axis, list);
    }

    const tradeoff = entryTradeoffPenalty(entry);
    if (tradeoff) {
      if ("penalty" in tradeoff) {
        const list = flatTradeoffByAxis.get(tradeoff.axis) ?? [];
        list.push(tradeoff.penalty);
        flatTradeoffByAxis.set(tradeoff.axis, list);
      } else {
        const list = fractionTradeoffByAxis.get(tradeoff.axis) ?? [];
        list.push(tradeoff.fraction);
        fractionTradeoffByAxis.set(tradeoff.axis, list);
      }
    }
  }

  const out: LineageMultipliers = { ...IDENTITY };

  for (const [axis, values] of flatByAxis) {
    out[axis] = combineFlatBonuses(values, SOFT_CAP_FLAT[axis]);
  }

  const capMul = (axis: FractionAxis, fractions: number[]): void => {
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

  for (const [axis, fractions] of fractionByAxis) {
    capMul(axis, fractions);
  }

  for (const [axis, values] of flatTradeoffByAxis) {
    out[axis] = combineFlatBonuses(values, SOFT_CAP_FLAT_TRADEOFF[axis]);
  }

  for (const [axis, fractions] of fractionTradeoffByAxis) {
    out[axis] = combineFractionalBonuses(fractions);
  }

  return out;
}
