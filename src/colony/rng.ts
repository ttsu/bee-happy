/**
 * Small deterministic PRNG shared by seeded systems (succession card rolls, forage fields).
 *
 * Same seed always yields the same sequence, which is what lets a stored save seed rebuild
 * generated content instead of persisting it.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random 32-bit seed for a new colony (not deterministic by design). */
export const randomSeed = (): number => Math.floor(Math.random() * 0xffffffff) >>> 0;
