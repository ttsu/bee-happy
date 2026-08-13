import type { RarityTier } from "../colony/meta/meta-progress";

export type LineageAffixBonusKind = "fraction" | "flat";

export type LineageAffixDef = {
  id: string;
  displayName: string;
  bonusKind: LineageAffixBonusKind;
  /** Base magnitude at tier 1 for fraction affixes (0–1 scale). */
  baseMagnitude: number;
  /** Base flat bonus at tier 1 for flat affixes (whole units). */
  baseFlatMagnitude?: number;
  /** Defaults to fraction when omitted. */
  tradeoffKind?: LineageAffixBonusKind;
  /** Base flat tradeoff at tier 1 when tradeoffKind is flat. */
  baseFlatTradeoff?: number;
  /** Full primary stat line; value is fraction (0–1) or whole units depending on bonusKind. */
  formatPrimaryLine: (primaryValue: number) => string;
  /** Full tradeoff line; value is fraction (0–1) or whole units depending on tradeoffKind. */
  formatTradeoffLine: (tradeoffValue: number) => string;
};

const pct = (fraction: number): string => (fraction * 100).toFixed(0);

export const LINEAGE_AFFIX_POOL: LineageAffixDef[] = [
  {
    id: "food_cell_cap",
    displayName: "Deep Pantry",
    bonusKind: "flat",
    baseMagnitude: 0.06,
    baseFlatMagnitude: 1,
    formatPrimaryLine: (n) => `+${n} food cell capacity (pollen & nectar)`,
    formatTradeoffLine: (f) => `${pct(f)}% slower honey processing`,
  },
  {
    id: "swift_forage",
    displayName: "Swift Forager",
    bonusKind: "fraction",
    baseMagnitude: 0.07,
    tradeoffKind: "flat",
    baseFlatTradeoff: 1,
    formatPrimaryLine: (f) => `${pct(f)}% shorter forage trips`,
    formatTradeoffLine: (n) => `-${n} nectar cell capacity`,
  },
  {
    id: "brood_pulse",
    displayName: "Brood Pulse",
    bonusKind: "fraction",
    baseMagnitude: 0.06,
    formatPrimaryLine: (f) => `${pct(f)}% faster brood cycles`,
    formatTradeoffLine: (f) => `${pct(f)}% faster worker hunger`,
  },
  {
    id: "honey_press",
    displayName: "Honey Press",
    bonusKind: "fraction",
    baseMagnitude: 0.06,
    formatPrimaryLine: (f) => `${pct(f)}% faster honey processing`,
    formatTradeoffLine: (f) => `${pct(f)}% slower egg laying`,
  },
  {
    id: "heavy_haul",
    displayName: "Heavy Haul",
    bonusKind: "flat",
    baseMagnitude: 0.05,
    baseFlatMagnitude: 1,
    formatPrimaryLine: (n) => `+${n} pollen/nectar per forage deposit`,
    formatTradeoffLine: (f) => `${pct(f)}% slower move speed`,
  },
  {
    id: "calm_metabolism",
    displayName: "Calm Metabolism",
    bonusKind: "fraction",
    baseMagnitude: 0.06,
    formatPrimaryLine: (f) => `${pct(f)}% slower hunger`,
    formatTradeoffLine: (f) => `${pct(f)}% slower cell building`,
  },
  {
    id: "mason_wing",
    displayName: "Mason Wing",
    bonusKind: "fraction",
    baseMagnitude: 0.07,
    tradeoffKind: "flat",
    baseFlatTradeoff: 1,
    formatPrimaryLine: (f) => `${pct(f)}% faster cell building`,
    formatTradeoffLine: (n) => `-${n} starting pollen`,
  },
  {
    id: "nectar_cell_cap",
    displayName: "Nectar Vault",
    bonusKind: "flat",
    baseMagnitude: 0.06,
    baseFlatMagnitude: 1,
    formatPrimaryLine: (n) => `+${n} nectar cell capacity`,
    formatTradeoffLine: (f) => `${pct(f)}% slower foraging`,
  },
];

const AFFIX_BY_ID: ReadonlyMap<string, LineageAffixDef> = new Map(
  LINEAGE_AFFIX_POOL.map((a) => [a.id, a]),
);

export function getLineageAffixById(id: string): LineageAffixDef | undefined {
  return AFFIX_BY_ID.get(id);
}

/** Primary bonus: higher rarity → stronger effect. */
const TIER_SCALE_PRIMARY: Record<RarityTier, number> = {
  1: 1,
  2: 1.25,
  3: 1.5,
  4: 1.85,
  5: 2.2,
};

/**
 * Tradeoff penalty: higher rarity → milder downside (smaller fraction).
 * Uses the inverse shape of {@link TIER_SCALE_PRIMARY} so top tier stays attractive.
 */
const TIER_SCALE_TRADEOFF: Record<RarityTier, number> = {
  1: 1.2,
  2: 1.05,
  3: 0.9,
  4: 0.72,
  5: 0.55,
};

/** Rarity roll weights (per slot). */
const RARITY_WEIGHTS: { tier: RarityTier; w: number }[] = [
  { tier: 1, w: 55 },
  { tier: 2, w: 28 },
  { tier: 3, w: 12 },
  { tier: 4, w: 4 },
  { tier: 5, w: 1 },
];

export function rollRarityTier(rng: () => number): RarityTier {
  const total = RARITY_WEIGHTS.reduce((s, x) => s + x.w, 0);
  let r = rng() * total;
  for (const { tier, w } of RARITY_WEIGHTS) {
    r -= w;
    if (r <= 0) {
      return tier;
    }
  }
  return 1;
}

export function primaryMagnitudeForTier(
  def: LineageAffixDef,
  tier: RarityTier,
): number {
  if (def.bonusKind === "flat") {
    const base = def.baseFlatMagnitude ?? 1;
    return Math.max(1, Math.round(base * TIER_SCALE_PRIMARY[tier]));
  }
  return def.baseMagnitude * TIER_SCALE_PRIMARY[tier];
}

export function tradeoffMagnitudeForTier(
  def: LineageAffixDef,
  tier: RarityTier,
): number {
  return def.baseMagnitude * TIER_SCALE_TRADEOFF[tier];
}

/** Tradeoff penalty for simulation and UI (fraction 0–1 or whole units). */
export function tradeoffPenaltyForTier(def: LineageAffixDef, tier: RarityTier): number {
  if (def.tradeoffKind === "flat") {
    const base = def.baseFlatTradeoff ?? 1;
    return Math.max(1, Math.round(base * TIER_SCALE_TRADEOFF[tier]));
  }
  return tradeoffMagnitudeForTier(def, tier);
}

export type RolledPupaOption = {
  affix: LineageAffixDef;
  tier: RarityTier;
  /** Primary bonus value (fraction 0–1 or whole units, depending on affix bonusKind). */
  magnitude: number;
  /** Tradeoff fractional penalty for UI (scales down with higher rarity). */
  tradeoffMagnitude: number;
};

export function rollPupaOptions(rng: () => number, count = 3): RolledPupaOption[] {
  const pool = [...LINEAGE_AFFIX_POOL];
  const out: RolledPupaOption[] = [];
  for (let i = 0; i < count; i++) {
    if (pool.length === 0) {
      break;
    }
    const idx = Math.floor(rng() * pool.length);
    const affix = pool.splice(idx, 1)[0]!;
    const tier = rollRarityTier(rng);
    const magnitude = primaryMagnitudeForTier(affix, tier);
    const tradeoffMagnitude = tradeoffPenaltyForTier(affix, tier);
    out.push({ affix, tier, magnitude, tradeoffMagnitude });
  }
  return out;
}
