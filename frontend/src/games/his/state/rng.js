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

// ── State-backed RNG (multiplayer-deterministic) ───────────────────
//
// The deck `_rng` above is module-level, so it is NOT part of the cloned/synced
// game state. For lockstep multiplayer, every roll a move makes must be
// reproducible when the SAME move is re-executed against the SAME state on the
// other client. So combat / reformation / debate / event rolls draw from a PRNG
// whose seed lives on `state.rngState` and advances in place — re-executing a
// move from an identical state yields identical dice, keeping clients in sync.
//
// To avoid threading `state` through ~70 roll call sites, the engine sets the
// "active" state at the processMove / initialize boundary (setActiveRngState),
// and rollDie/randInt advance that state's `rngState`. When no active state is
// set (legacy/standalone calls), it falls back to Math.random — production rolls
// outside a move are unaffected.

let _active = null;

/**
 * Mark `state` as the active RNG owner for the duration of a move; returns the
 * previous owner so the caller can restore it (re-entrancy-safe).
 * @param {Object|null} state
 * @returns {Object|null} previous active state
 */
export function setActiveRngState(state) {
  const prev = _active;
  _active = state || null;
  return prev;
}

/**
 * Restore a previously-active RNG owner (pair with setActiveRngState).
 * @param {Object|null} prev
 */
export function restoreActiveRngState(prev) {
  _active = prev || null;
}

/**
 * Next value in [0, 1) from the active state's PRNG (stateful mulberry32 step),
 * or Math.random() when no state is active.
 * @returns {number}
 */
export function nextRandom() {
  if (!_active) return Math.random();
  let a = (_active.rngState ?? 0) | 0;
  a = (a + 0x6D2B79F5) | 0;
  _active.rngState = a;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Roll one six-sided die from the active state-backed PRNG.
 * @returns {number} 1–6
 */
export function rollDie() {
  return Math.floor(nextRandom() * 6) + 1;
}

/**
 * Random integer in [0, n) from the active state-backed PRNG.
 * @param {number} n
 * @returns {number}
 */
export function randInt(n) {
  return Math.floor(nextRandom() * n);
}
