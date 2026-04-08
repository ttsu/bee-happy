/**
 * Cubic ease-out on `[0, 1]`: `1 - (1-t)³` (derivative goes to 0 at `t === 1`).
 */
function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

/**
 * Eased speed along a straight path segment.
 *
 * Leg progress `p` goes from 0 (start) to 1 (end). We apply {@link easeOutCubic} to `(1 - p)`
 * so the multiplier eases out toward the segment end (deceleration into each waypoint).
 *
 * @param remainingDist - Current distance to the segment end (world px).
 * @param legInitialDist - Distance to the segment end when this leg began (world px).
 * @param minMultiplier - Floor multiplier in `[0, 1]` so motion never fully stops mid-leg.
 * @returns Multiplier in `[minMultiplier, 1]` to apply to base step length.
 */
export function pathLegSpeedMultiplier(
  remainingDist: number,
  legInitialDist: number,
  minMultiplier: number,
): number {
  const L = Math.max(legInitialDist, 1e-3);
  const p = Math.min(1, Math.max(0, 1 - remainingDist / L));
  const eased = easeOutCubic(1 - p);
  return minMultiplier + (1 - minMultiplier) * eased;
}
