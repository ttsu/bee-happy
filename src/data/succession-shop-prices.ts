import { z } from "zod";

export const successionShopPricesSchema = z.object({
  unlockSlot: z.number().nonnegative(),
  upgradeRarityByTier: z.record(z.string(), z.number().nonnegative()),
});

export type SuccessionShopPrices = z.infer<typeof successionShopPricesSchema>;

/** Default prices (royal jelly units); tune in data. */
export const DEFAULT_SUCCESSION_SHOP_PRICES: SuccessionShopPrices = {
  unlockSlot: 6,
  upgradeRarityByTier: {
    "1": 5,
    "2": 8,
    "3": 12,
    "4": 18,
    "5": 0,
  },
};

export const successionShopPrices = successionShopPricesSchema.parse(
  DEFAULT_SUCCESSION_SHOP_PRICES,
);
