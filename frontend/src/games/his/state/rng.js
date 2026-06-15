/**
 * Here I Stand — Seedable RNG (deck reproducibility)
 *
 * Module-level RNG used by the card-deck shuffle so a full-bot test run can be
 * reproduced (same card draws) by passing `options.rngSeed` to a new game.
 *
 * Default (unseeded) behaviour is `Math.random` — production is unchanged
 * unless a seed is supplied. The RNG is module-level (not on game state), so it
 * is clone-safe (state is JSON-cloned each move) but NOT restored on save/load;
 * reproducibility is for fresh runs started from the same seed.
 */

let _rng = Math.random;

/**
 * Deterministic PRNG (mulberry32). Small, fast, good enough for shuffles.
 * @param {number} a - 32-bit seed
 * @returns {() => number} generator returning [0, 1)
 */
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Seed the deck RNG. Pass null/undefined to restore Math.random.
 * @param {number|null|undefined} seed
 */
export function seedRng(seed) {
  _rng = (seed == null) ? Math.random : mulberry32(seed >>> 0);
}

/** @returns {number} next pseudo-random value in [0, 1) */
export function rng() {
  return _rng();
}
