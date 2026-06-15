/**
 * Turn display helper.
 *
 * Games disagree on which state field is the human-facing turn number:
 *  - UNO / Werewolf use `turnNumber` (incremented once per turn).
 *  - Here I Stand uses `turn`; its `turnNumber` is a per-action impulse counter
 *    (siege timing) that climbs every move and must NOT be shown as the turn.
 *
 * Prefer `turn` when present, else `turnNumber`, else 1.
 *
 * @param {Object} state
 * @returns {number}
 */
export function displayTurnNumber(state) {
  return (state && (state.turn ?? state.turnNumber)) ?? 1;
}
