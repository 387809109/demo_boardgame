/**
 * Here I Stand — UI gating coverage (render-contract invariants)
 *
 * Exhaustive, deterministic, node-env checks of the pure UI-gating decisions
 * (ui-gating.js). This is the UI analog of the engine's gate-parity coverage
 * test: instead of relying on a live Playwright playthrough to stumble onto a
 * panel by luck, we enumerate {phase × power × pending-overlay} and assert the
 * "what may this power do / see" contract directly.
 *
 * Includes explicit regressions for the two 2026-06-15 Playwright-found bugs:
 *  - UI-2: hand cards must be playable during diet_of_worms (not only 'action').
 *  - panel routing must show the Diet panel (not "waiting") to the awaiting power.
 */

import { describe, it, expect } from 'vitest';
import { handCanPlay, isActionPanelActive, activePanelKey } from './ui-gating.js';

const POWERS = ['ottoman', 'hapsburg', 'england', 'france', 'papacy', 'protestant'];

/** Diet state where every power except `pending` has already submitted. */
function dietState(pending) {
  const cards = {};
  for (const p of POWERS) if (p !== pending) cards[p] = 10;
  return { phase: 'diet_of_worms', activePower: 'protestant', pendingDietOfWorms: { cards } };
}

describe('handCanPlay', () => {
  it('action phase: only the active power may play', () => {
    const s = { phase: 'action', activePower: 'france' };
    expect(handCanPlay(s, 'france')).toBe(true);
    for (const p of POWERS.filter(x => x !== 'france')) {
      expect(handCanPlay(s, p)).toBe(false);
    }
  });

  it('UI-2 regression: diet_of_worms lets the awaiting power play a card', () => {
    const s = dietState('protestant');
    expect(s.phase).not.toBe('action'); // the exact condition the old bug missed
    expect(handCanPlay(s, 'protestant')).toBe(true);
  });

  it('diet_of_worms: a power that already submitted may not play', () => {
    expect(handCanPlay(dietState('protestant'), 'hapsburg')).toBe(false);
  });

  it('response window: only the responding power may play (any phase)', () => {
    const s = {
      phase: 'action', activePower: 'france',
      pendingResponse: { respondingPower: 'protestant', validCards: [32] }
    };
    expect(handCanPlay(s, 'protestant')).toBe(true); // responder, though not active
    expect(handCanPlay(s, 'england')).toBe(false);
  });

  it('non-card phases never allow hand play', () => {
    for (const phase of ['card_draw', 'diplomacy', 'spring_deployment', 'winter', 'luther_95']) {
      const s = { phase, activePower: 'protestant' };
      for (const p of POWERS) expect(handCanPlay(s, p)).toBe(false);
    }
  });

  it('guards null/empty input', () => {
    expect(handCanPlay(null, 'france')).toBe(false);
    expect(handCanPlay({ phase: 'action', activePower: 'france' }, null)).toBe(false);
  });
});

describe('isActionPanelActive', () => {
  it('diplomacy: follows canActInSegment (segment set + not yet acted)', () => {
    const base = { phase: 'diplomacy', diplomacySegment: 'negotiation', diplomacyActed: {} };
    expect(isActionPanelActive(base, 'protestant')).toBe(true);
    expect(isActionPanelActive({ ...base, diplomacyActed: { protestant: true } }, 'protestant')).toBe(false);
    expect(isActionPanelActive({ ...base, diplomacySegment: null }, 'protestant')).toBe(false);
  });

  it('diplomacy excommunication segment: only papacy is active', () => {
    const s = { phase: 'diplomacy', diplomacySegment: 'excommunication', diplomacyActed: {} };
    expect(isActionPanelActive(s, 'papacy')).toBe(true);
    expect(isActionPanelActive(s, 'protestant')).toBe(false);
  });

  it('diet_of_worms: active until this power submits', () => {
    expect(isActionPanelActive(dietState('protestant'), 'protestant')).toBe(true);
    expect(isActionPanelActive(dietState('protestant'), 'france')).toBe(false);
  });

  it('action / spring / luther: active iff this power is activePower', () => {
    for (const phase of ['action', 'spring_deployment', 'luther_95']) {
      const s = { phase, activePower: 'protestant' };
      expect(isActionPanelActive(s, 'protestant')).toBe(true);
      expect(isActionPanelActive(s, 'ottoman')).toBe(false);
    }
  });
});

describe('activePanelKey', () => {
  it('response window outranks everything', () => {
    const s = {
      phase: 'action', activePower: 'protestant',
      pendingResponse: { respondingPower: 'england' }, pendingBattle: {}
    };
    expect(activePanelKey(s, 'protestant')).toBe('response');
  });

  it('inactive power sees "waiting"', () => {
    expect(activePanelKey({ phase: 'action', activePower: 'france' }, 'protestant')).toBe('waiting');
  });

  it('UI-2 regression: awaiting power sees the diet panel, not "waiting"', () => {
    expect(activePanelKey(dietState('protestant'), 'protestant')).toBe('diet_of_worms');
  });

  it('pending sub-interactions outrank the base phase, in precedence order', () => {
    const base = { phase: 'action', activePower: 'protestant' };
    expect(activePanelKey({ ...base, pendingReformation: {} }, 'protestant')).toBe('reformation');
    expect(activePanelKey({ ...base, pendingDebate: {} }, 'protestant')).toBe('debate');
    expect(activePanelKey({ ...base, pendingBattle: {} }, 'protestant')).toBe('battle');
    expect(activePanelKey({ ...base, pendingInterception: {} }, 'protestant')).toBe('interception');
    // reformation outranks debate outranks battle outranks interception
    expect(activePanelKey({ ...base, pendingReformation: {}, pendingDebate: {}, pendingBattle: {} }, 'protestant'))
      .toBe('reformation');
  });

  it('plain active phase returns the phase key', () => {
    expect(activePanelKey({ phase: 'action', activePower: 'protestant' }, 'protestant')).toBe('action');
    expect(activePanelKey({ phase: 'spring_deployment', activePower: 'protestant' }, 'protestant')).toBe('spring_deployment');
  });
});

describe('exhaustive consistency sweep', () => {
  const PHASES = ['card_draw', 'luther_95', 'diet_of_worms', 'diplomacy', 'spring_deployment', 'action', 'winter'];
  const OVERLAYS = [
    {}, { pendingReformation: {} }, { pendingDebate: {} }, { pendingBattle: {} },
    { pendingInterception: {} }, { pendingResponse: { respondingPower: 'protestant' } }
  ];

  it('no function throws and the three predicates stay mutually consistent', () => {
    for (const phase of PHASES) {
      for (const overlay of OVERLAYS) {
        for (const power of POWERS) {
          const s = {
            phase, activePower: 'protestant',
            diplomacySegment: 'negotiation', diplomacyActed: {},
            pendingDietOfWorms: phase === 'diet_of_worms' ? { cards: {} } : undefined,
            ...overlay
          };
          const key = activePanelKey(s, power);
          const active = isActionPanelActive(s, power);

          if (s.pendingResponse) {
            expect(key).toBe('response');
          } else if (!active) {
            expect(key).toBe('waiting');
          } else {
            // active and no response → never "waiting"/"response"
            expect(key).not.toBe('waiting');
            expect(key).not.toBe('response');
          }

          // handCanPlay only ever true in action(active) / diet(awaiting) / response
          if (handCanPlay(s, power)) {
            const ok = (phase === 'action' && s.activePower === power) ||
              (phase === 'diet_of_worms') ||
              (s.pendingResponse && s.pendingResponse.respondingPower === power);
            expect(ok).toBe(true);
          }
        }
      }
    }
  });
});
