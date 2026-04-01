import { useCallback, useEffect, useMemo, useState } from "react";
import type { ColonyUiSnapshot } from "../colony/events/colony-events";
import { getColonyBridge } from "../colony-bridge";
import { successionShopPrices } from "../data/succession-shop-prices";
import {
  primaryMagnitudeForTier,
  rollPupaOptions,
  tradeoffMagnitudeForTier,
  type RolledPupaOption,
} from "../data/lineage-affixes";
import type { RarityTier } from "../colony/meta/meta-progress";
import { successionReasonShortLabel } from "../data/succession-reason-copy";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const tierLabel = (t: RarityTier): string => {
  const names: Record<RarityTier, string> = {
    1: "Common",
    2: "Uncommon",
    3: "Rare",
    4: "Epic",
    5: "Legendary",
  };
  return names[t];
};

type Props = {
  readonly snap: ColonyUiSnapshot;
  readonly onPersist: () => void;
};

/**
 * Full-screen succession flow: three pupae, optional honey rerolls / rarity upgrade.
 */
export const SuccessionModal = ({ snap, onPersist }: Props) => {
  const modal = snap.successionModal;
  const [options, setOptions] = useState<RolledPupaOption[]>([]);
  const [seed, setSeed] = useState(0);
  const [rerollCount, setRerollCount] = useState(0);
  const [honeyLeft, setHoneyLeft] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    if (!modal) {
      return;
    }
    const s = Math.floor(modal.honeyBudget * 1000 + modal.colonyDay + Date.now());
    setSeed(s);
    setRerollCount(0);
    setHoneyLeft(modal.honeyBudget);
    setSelected(null);
    const rng = mulberry32(s);
    setOptions(rollPupaOptions(rng, 3));
  }, [modal]);

  const rerollCost = useMemo(() => {
    return (
      successionShopPrices.rerollAllBase +
      successionShopPrices.rerollAllEscalation * rerollCount
    );
  }, [rerollCount]);

  const doReroll = useCallback(() => {
    if (honeyLeft < rerollCost) {
      return;
    }
    setHoneyLeft((h) => h - rerollCost);
    setRerollCount((c) => c + 1);
    const rng = mulberry32(seed + rerollCount + 999);
    setOptions(rollPupaOptions(rng, 3));
    setSelected(null);
  }, [honeyLeft, rerollCost, seed, rerollCount]);

  const upgradeCostForTier = (tier: RarityTier): number => {
    if (tier >= 5) {
      return Infinity;
    }
    return successionShopPrices.upgradeRarityByTier[String(tier)] ?? 8;
  };

  const upgradeCard = useCallback(
    (index: number) => {
      const opt = options[index];
      if (!opt || opt.tier >= 5) {
        return;
      }
      const cost = upgradeCostForTier(opt.tier);
      if (honeyLeft < cost) {
        return;
      }
      setHoneyLeft((h) => h - cost);
      setOptions((prev) => {
        const next = [...prev];
        const o = next[index];
        if (!o || o.tier >= 5) {
          return prev;
        }
        const newTier = (o.tier + 1) as RarityTier;
        next[index] = {
          ...o,
          tier: newTier,
          magnitude: primaryMagnitudeForTier(o.affix, newTier),
          tradeoffMagnitude: tradeoffMagnitudeForTier(o.affix, newTier),
        };
        return next;
      });
    },
    [honeyLeft, options],
  );

  const confirm = useCallback(() => {
    if (selected == null || !modal) {
      return;
    }
    const opt = options[selected];
    if (!opt) {
      return;
    }
    const colony = getColonyBridge();
    if (!colony) {
      return;
    }
    colony.applySuccessionChoice({
      affixId: opt.affix.id,
      displayName: opt.affix.displayName,
      tier: opt.tier,
      magnitude: opt.magnitude,
      successionReason: modal.reason,
      recordedAtIso: new Date().toISOString(),
    });
    onPersist();
  }, [modal, onPersist, options, selected]);

  const dismiss = useCallback(() => {
    if (!modal?.mandatory) {
      getColonyBridge()?.dismissSuccessionModal();
    }
  }, [modal]);

  if (!modal) {
    return null;
  }

  return (
    <div
      className="succession-backdrop"
      role="dialog"
      aria-modal
      aria-labelledby="succession-title"
    >
      <div className="succession-card">
        <h2 id="succession-title" className="succession-title">
          Choose the next queen
        </h2>
        <p className="succession-reason">{successionReasonShortLabel[modal.reason]}</p>
        <p className="succession-honey">
          Honey to spend: {honeyLeft.toFixed(0)} (stored in nectar cells at succession)
        </p>
        <div className="succession-pupa-row">
          {options.map((opt, i) => (
            <div
              key={`${opt.affix.id}-${i}-${seed}`}
              className={`succession-pupa ${selected === i ? "is-selected" : ""} tier-${opt.tier}`}
            >
              <button
                type="button"
                className="succession-pupa-select"
                onClick={() => setSelected(i)}
              >
                <span className="succession-tier">{tierLabel(opt.tier)}</span>
                <span className="succession-name">{opt.affix.displayName}</span>
                <span className="succession-primary">
                  {opt.affix.formatPrimaryLine(opt.magnitude)}
                </span>
                <span className="succession-trade">
                  {opt.affix.formatTradeoffLine(opt.tradeoffMagnitude)}
                </span>
              </button>
              <button
                type="button"
                className="succession-upgrade"
                disabled={opt.tier >= 5 || honeyLeft < upgradeCostForTier(opt.tier)}
                onClick={() => upgradeCard(i)}
              >
                Upgrade rarity ({upgradeCostForTier(opt.tier)} 🍯)
              </button>
            </div>
          ))}
        </div>
        <div className="succession-actions">
          <button
            type="button"
            className="succession-reroll"
            disabled={honeyLeft < rerollCost}
            onClick={doReroll}
          >
            Reroll all ({rerollCost} 🍯)
          </button>
          <button
            type="button"
            className="succession-confirm"
            disabled={selected == null}
            onClick={confirm}
          >
            Hatch selected pupa
          </button>
          {!modal.mandatory ? (
            <button type="button" className="succession-dismiss" onClick={dismiss}>
              Not now
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
