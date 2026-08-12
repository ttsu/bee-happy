import { useCallback, useEffect, useState } from "react";
import type { ColonyUiSnapshot } from "../colony/events/colony-events";
import { useColonyBridge } from "./colony-bridge-context";
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

type SuccessionSlot =
  | { readonly status: "locked" }
  | { readonly status: "unlocked"; readonly option: RolledPupaOption };

type Props = {
  readonly snap: ColonyUiSnapshot;
  readonly onPersist: () => void;
};

const SLOT_COUNT = 3;

/**
 * Full-screen succession flow: unlock up to three pupae with royal jelly, then upgrade rarity.
 */
export const SuccessionModal = ({ snap, onPersist }: Props) => {
  const colony = useColonyBridge();
  const modal = snap.successionModal;
  const [seed, setSeed] = useState(0);
  const [unlockCount, setUnlockCount] = useState(0);
  const [royalJellyLeft, setRoyalJellyLeft] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [slots, setSlots] = useState<SuccessionSlot[]>(
    Array.from({ length: SLOT_COUNT }, () => ({ status: "locked" as const })),
  );

  useEffect(() => {
    if (!modal) {
      return;
    }
    const s = Math.floor(modal.royalJellyBudget * 1000 + modal.colonyDay + Date.now());
    setSeed(s);
    setUnlockCount(0);
    setRoyalJellyLeft(modal.royalJellyBudget);
    setSelected(null);
    setSlots(Array.from({ length: SLOT_COUNT }, () => ({ status: "locked" })));
  }, [modal]);

  const unlockCost = successionShopPrices.unlockSlot;

  const upgradeCostForTier = (tier: RarityTier): number => {
    if (tier >= 5) {
      return Infinity;
    }
    return successionShopPrices.upgradeRarityByTier[String(tier)] ?? 8;
  };

  const unlockSlot = useCallback(
    (index: number) => {
      if (royalJellyLeft < unlockCost) {
        return;
      }
      setRoyalJellyLeft((j) => j - unlockCost);
      setUnlockCount((c) => c + 1);
      const rng = mulberry32(seed + index * 7919 + unlockCount);
      const rolled = rollPupaOptions(rng, 1)[0];
      if (!rolled) {
        return;
      }
      setSlots((prev) => {
        const next = [...prev];
        next[index] = { status: "unlocked", option: rolled };
        return next;
      });
      setSelected(null);
    },
    [royalJellyLeft, unlockCost, seed, unlockCount],
  );

  const upgradeCard = useCallback(
    (index: number) => {
      const slot = slots[index];
      if (slot?.status !== "unlocked" || slot.option.tier >= 5) {
        return;
      }
      const cost = upgradeCostForTier(slot.option.tier);
      if (royalJellyLeft < cost) {
        return;
      }
      setRoyalJellyLeft((j) => j - cost);
      setSlots((prev) => {
        const next = [...prev];
        const current = next[index];
        if (current?.status !== "unlocked" || current.option.tier >= 5) {
          return prev;
        }
        const newTier = (current.option.tier + 1) as RarityTier;
        next[index] = {
          status: "unlocked",
          option: {
            ...current.option,
            tier: newTier,
            magnitude: primaryMagnitudeForTier(current.option.affix, newTier),
            tradeoffMagnitude: tradeoffMagnitudeForTier(current.option.affix, newTier),
          },
        };
        return next;
      });
    },
    [royalJellyLeft, slots],
  );

  const confirm = useCallback(() => {
    if (selected == null || !modal) {
      return;
    }
    const slot = slots[selected];
    if (slot?.status !== "unlocked" || !colony) {
      return;
    }
    const opt = slot.option;
    const royalJellySpent = Math.max(0, modal.royalJellyBudget - royalJellyLeft);
    colony.applySuccessionChoice(
      {
        affixId: opt.affix.id,
        displayName: opt.affix.displayName,
        tier: opt.tier,
        magnitude: opt.magnitude,
        successionReason: modal.reason,
        recordedAtIso: new Date().toISOString(),
      },
      royalJellySpent,
    );
    onPersist();
  }, [colony, modal, onPersist, royalJellyLeft, selected, slots]);

  const dismiss = useCallback(() => {
    if (!modal?.mandatory) {
      colony?.dismissSuccessionModal();
    }
  }, [colony, modal]);

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
          Royal jelly to spend: {royalJellyLeft.toFixed(0)} (earned from hive happiness)
        </p>
        <div className="succession-pupa-row">
          {slots.map((slot, i) => (
            <div
              key={`slot-${i}-${seed}`}
              className={`succession-pupa ${
                selected === i ? "is-selected" : ""
              } ${slot.status === "unlocked" ? `tier-${slot.option.tier}` : "is-locked"}`}
            >
              {slot.status === "locked" ? (
                <button
                  type="button"
                  className="succession-unlock"
                  disabled={royalJellyLeft < unlockCost}
                  onClick={() => unlockSlot(i)}
                >
                  Unlock pupa ({unlockCost} royal jelly)
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="succession-pupa-select"
                    onClick={() => setSelected(i)}
                  >
                    <span className="succession-tier">
                      {tierLabel(slot.option.tier)}
                    </span>
                    <span className="succession-name">
                      {slot.option.affix.displayName}
                    </span>
                    <span className="succession-primary">
                      {slot.option.affix.formatPrimaryLine(slot.option.magnitude)}
                    </span>
                    <span className="succession-trade">
                      {slot.option.affix.formatTradeoffLine(
                        slot.option.tradeoffMagnitude,
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="succession-upgrade"
                    disabled={
                      slot.option.tier >= 5 ||
                      royalJellyLeft < upgradeCostForTier(slot.option.tier)
                    }
                    onClick={() => upgradeCard(i)}
                  >
                    Upgrade rarity ({upgradeCostForTier(slot.option.tier)} royal jelly)
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="succession-actions">
          <button
            type="button"
            className="succession-confirm"
            disabled={selected == null || slots[selected]?.status !== "unlocked"}
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
