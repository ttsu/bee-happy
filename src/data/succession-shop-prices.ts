import { z } from "zod";

export const successionShopPricesSchema = z.object({
  unlockSlot: z.number().nonnegative(),
  upgradeRarityByTier: z.record(z.string(), z.number().nonnegative()),
});

export type SuccessionShopPrices = z.infer<typeof successionShopPricesSchema>;

/** Default prices (royal jelly units); tune in data. */
export const DEFAULT_SUCCESSION_SHOP_PRICES: SuccessionShopPrices = {
  unlockSlot: 12,
  upgradeRarityByTier: {
    "1": 6,
    "2": 10,
    "3": 15,
    "4": 22,
    "5": 0,
  },
};

export const successionShopPrices = successionShopPricesSchema.parse(
  DEFAULT_SUCCESSION_SHOP_PRICES,
);
