/**
 * Here I Stand — Two-Player Variant, Phase 4a (Online 2-player)
 *
 * Two humans play the variant remotely (one Papacy, one Protestant). Covers the
 * engine's 2-player power-assignment default (no DEFAULT_POWER_ASSIGNMENTS[2]
 * exists) and the per-player hand masking the online relay relies on.
 */

import { describe, it, expect } from 'vitest';
import { buildInitialState } from './state/state-init.js';
import { getVisibleState } from './state/state-visible.js';

const TWO_SEATS = [
  { id: 'pA', nickname: 'Alice', isHost: true },
  { id: 'pB', nickname: 'Bob', isHost: false }
];
const ONE_SEAT = [{ id: 'p1', nickname: 'Host', isHost: true }];

describe('Two-player online — power-assignment default', () => {
  it('gives two seats one side each (seat order: P0 Protestant, P1 Papacy)', () => {
    const st = buildInitialState(TWO_SEATS, { variant: 'two_player', rngSeed: 1 });
    expect(st.variant).toBe('two_player');
    expect(st.powersForPlayer.pA).toEqual(['protestant']);
    expect(st.powersForPlayer.pB).toEqual(['papacy']);
  });

  it('keeps the single-seat hotseat assignment (both sides)', () => {
    const st = buildInitialState(ONE_SEAT, { variant: 'two_player', rngSeed: 1 });
    expect(st.powersForPlayer.p1).toEqual(['papacy', 'protestant']);
  });

  it('respects an explicit powerAssignment override', () => {
    const st = buildInitialState(TWO_SEATS, {
      variant: 'two_player', powerAssignment: [['papacy'], ['protestant']], rngSeed: 1
    });
    expect(st.powersForPlayer.pA).toEqual(['papacy']);
    expect(st.powersForPlayer.pB).toEqual(['protestant']);
  });

  it('does not affect a standard game', () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, nickname: `P${i}`, isHost: i === 0 }));
    const st = buildInitialState(six, { rngSeed: 1 });
    expect(st.variant).toBe('standard');
    // Each of the 6 seats controls exactly one power (standard assignment).
    expect(Object.values(st.powersForPlayer).every((pw) => pw.length === 1)).toBe(true);
  });
});

describe('Two-player online — per-player hand masking (relay)', () => {
  it('masks the opponent diplomacy hand for each seat', () => {
    const st = buildInitialState(TWO_SEATS, { variant: 'two_player', rngSeed: 1 });
    st.diplomacyHands = { protestant: [201, 205], papacy: [212] };

    const visA = getVisibleState(st, 'pA'); // Alice = Protestant
    expect(visA.diplomacyHands.protestant).toEqual([201, 205]);
    expect(visA.diplomacyHands.papacy).toBe(1); // opponent masked to a count

    const visB = getVisibleState(st, 'pB'); // Bob = Papacy
    expect(visB.diplomacyHands.papacy).toEqual([212]);
    expect(visB.diplomacyHands.protestant).toBe(2);
  });
});
