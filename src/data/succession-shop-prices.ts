import { z } from "zod";

export const successionShopPricesSchema = z.object({
  rerollAllBase: z.number().nonnegative(),
  rerollAllEscalation: z.number().nonnegative(),
  upgradeRarityByTier: z.record(z.string(), z.number().nonnegative()),
  rerollOneSlot: z.number().nonnegative(),
  lockCard: z.number().nonnegative(),
});

export type SuccessionShopPrices = z.infer<typeof successionShopPricesSchema>;

/** Default prices (honey units); tune in data. */
export const DEFAULT_SUCCESSION_SHOP_PRICES: SuccessionShopPrices = {
  rerollAllBase: 8,
  rerollAllEscalation: 6,
  upgradeRarityByTier: {
    "1": 5,
    "2": 8,
    "3": 12,
    "4": 18,
    "5": 0,
  },
  rerollOneSlot: 5,
  lockCard: 4,
};

export const successionShopPrices = successionShopPricesSchema.parse(
  DEFAULT_SUCCESSION_SHOP_PRICES,
);
