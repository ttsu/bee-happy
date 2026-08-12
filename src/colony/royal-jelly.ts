/**
 * Fractional royal jelly per colony day from happiness: `happinessPct * percent / 100`.
 */
export const royalJellyPerDayFromHappiness = (
  happinessPct: number,
  percentOfHappiness: number,
): number => (happinessPct * percentOfHappiness) / 100;

/**
 * Adds fractional daily accrual into {@link buffer}, minting whole jelly into {@link stored}.
 */
export const accrueRoyalJellyFromBuffer = (
  stored: number,
  buffer: number,
  perDay: number,
  days: number,
): { stored: number; buffer: number } => {
  if (days <= 0 || perDay <= 0) {
    return { stored, buffer };
  }
  let nextBuffer = buffer + perDay * days;
  const whole = Math.floor(nextBuffer);
  if (whole > 0) {
    stored += whole;
    nextBuffer -= whole;
  }
  return { stored, buffer: nextBuffer };
};
