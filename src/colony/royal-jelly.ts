/**
 * Royal jelly earned from the colony happiness score: `round(happinessPct * percent / 100)`.
 */
export const royalJellyFromHappiness = (
  happinessPct: number,
  percentOfHappiness: number,
): number => Math.round((happinessPct * percentOfHappiness) / 100);
