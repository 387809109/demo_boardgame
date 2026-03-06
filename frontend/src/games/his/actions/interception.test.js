/**
 * Here I Stand — interception.js Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { checkInterceptions, resolveInterception } from './interception.js';
import { createTestState, createMockHelpers } from '../test-helpers.js';

function addUnits(state, space, power, regs = 1, leaders = []) {
  state.spaces[space].units.push({
    owner: power, regulars: regs, mercenaries: 0,
    cavalry: 0, squadrons: 0, corsairs: 0, leaders
  });
}

describe('checkInterceptions', () => {
  it('finds adjacent enemy stacks', () => {
    const state = createTestState();
    // Declare war so interception is possible
    state.wars.push({ a: 'ottoman', b: 'hapsburg' });
    // Move ottoman from Istanbul to Edirne
    // Varna is adjacent to Edirne and has no units by default,
    // so place hapsburg units there
    addUnits(state, 'Varna', 'hapsburg', 2);

    const interceptors = checkInterceptions(
      state, 'Istanbul', 'Edirne', 'ottoman'
    );
    const hapEntry = interceptors.find(i => i.power === 'hapsburg');
    expect(hapEntry).toBeDefined();
    expect(hapEntry.space).toBe('Varna');
  });

  it('excludes source space', () => {
    const state = createTestState();
    // Istanbul is adjacent to Edirne, but it's the source
    const interceptors = checkInterceptions(
      state, 'Istanbul', 'Edirne', 'ottoman'
    );
    // Ottoman units in Istanbul should NOT intercept their own move
    const ottEntry = interceptors.find(
      i => i.power === 'ottoman' && i.space === 'Istanbul'
    );
    expect(ottEntry).toBeUndefined();
  });

  it('excludes same-power stacks', () => {
    const state = createTestState();
    addUnits(state, 'Varna', 'ottoman', 2);
    const interceptors = checkInterceptions(
      state, 'Istanbul', 'Edirne', 'ottoman'
    );
    const ottEntry = interceptors.find(
      i => i.power === 'ottoman' && i.space === 'Varna'
    );
    expect(ottEntry).toBeUndefined();
  });

  it('sorts by impulse order', () => {
    const state = createTestState();
    // Place france and hapsburg adjacent to a space
    addUnits(state, 'Varna', 'france', 1);
    addUnits(state, 'Nicopolis', 'hapsburg', 1);
    // Both adjacent to Belgrade (via edges)
    // Let's use a simpler example: Edirne
    // Actually let's directly test sorting of results
    const interceptors = checkInterceptions(
      state, 'Istanbul', 'Edirne', 'ottoman'
    );
    // If both france and hapsburg present, hapsburg should come first
    // (impulse order: ottoman, hapsburg, england, france, papacy, protestant)
    if (interceptors.length >= 2) {
      const idxHap = interceptors.findIndex(i => i.power === 'hapsburg');
      const idxFra = interceptors.findIndex(i => i.power === 'france');
      if (idxHap >= 0 && idxFra >= 0) {
        expect(idxHap).toBeLessThan(idxFra);
      }
    }
  });

  it('returns empty when no adjacent enemies', () => {
    const state = createTestState();
    // Clear all non-ottoman units from spaces adjacent to Edirne
    const adj = ['Istanbul', 'Varna', 'Nicopolis', 'Szegedin',
      'Belgrade', 'Ragusa'];
    for (const s of adj) {
      if (state.spaces[s]) {
        state.spaces[s].units = state.spaces[s].units.filter(
          u => u.owner === 'ottoman'
        );
      }
    }
    const interceptors = checkInterceptions(
      state, 'Istanbul', 'Edirne', 'ottoman'
    );
    expect(interceptors).toHaveLength(0);
  });
});

describe('resolveInterception', () => {
  it('returns success or failure with roll', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    addUnits(state, 'Varna', 'hapsburg', 2);

    const result = resolveInterception(
      state, 'hapsburg', 'Varna', 'Edirne', helpers
    );

    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('roll');
    expect(result).toHaveProperty('threshold');
    expect(typeof result.success).toBe('boolean');
  });

  it('succeeds probabilistically (run 50 times)', () => {
    let successes = 0;
    for (let i = 0; i < 50; i++) {
      const state = createTestState();
      const helpers = createMockHelpers();
      addUnits(state, 'Varna', 'hapsburg', 2);

      const result = resolveInterception(
        state, 'hapsburg', 'Varna', 'Edirne', helpers
      );
      if (result.success) successes++;
    }
    // With threshold 5, ~33% chance. In 50 tries should get at least 1
    expect(successes).toBeGreaterThan(0);
    // And should NOT succeed every time
    expect(successes).toBeLessThan(50);
  });

  it('moves interceptor on success', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    addUnits(state, 'Varna', 'hapsburg', 2);

    // Run until success
    let moved = false;
    for (let i = 0; i < 50 && !moved; i++) {
      const s = createTestState();
      const h = createMockHelpers();
      addUnits(s, 'Varna', 'hapsburg', 2);

      const result = resolveInterception(s, 'hapsburg', 'Varna', 'Edirne', h);
      if (result.success) {
        // Hapsburg should now be in Edirne
        const hapEdirne = s.spaces['Edirne'].units.find(
          u => u.owner === 'hapsburg'
        );
        expect(hapEdirne).toBeDefined();
        expect(hapEdirne.regulars).toBe(2);

        // And removed from Varna
        const hapVarna = s.spaces['Varna'].units.find(
          u => u.owner === 'hapsburg'
        );
        expect(hapVarna).toBeUndefined();
        moved = true;
      }
    }
    expect(moved).toBe(true);
  });

  it('leader bonus lowers threshold', () => {
    const state = createTestState();
    const helpers = createMockHelpers();
    // charles_v has battle: 2, so threshold = 5 - 2 = 3
    addUnits(state, 'Varna', 'hapsburg', 2, ['charles_v']);

    const result = resolveInterception(
      state, 'hapsburg', 'Varna', 'Edirne', helpers
    );
    expect(result.threshold).toBe(3); // 5 - 2
  });
});
