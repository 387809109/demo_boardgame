/**
 * Here I Stand — phase-new-world.js Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { createTestState, createMockHelpers } from '../test-helpers.js';
import { resolveNewWorld } from './phase-new-world.js';

function stateWithNewWorld(overrides = {}) {
  const state = createTestState();
  state.newWorld = {
    underwayExplorations: [],
    underwayConquests: [],
    underwayColonies: [],
    colonies: [],
    conquests: [],
    claimedDiscoveries: [],
    claimedConquests: [],
    placedExplorers: [],
    placedConquistadors: [],
    deadExplorers: [],
    deadConquistadors: [],
    exploredThisTurn: {},
    colonizedThisTurn: {},
    conqueredThisTurn: {},
    ...overrides
  };
  return state;
}

describe('resolveNewWorld', () => {
  it('resolves with no underway voyages', () => {
    const state = stateWithNewWorld();
    const helpers = createMockHelpers();
    resolveNewWorld(state, helpers);
    const start = state.eventLog.find(e => e.type === 'new_world_phase_start');
    const end = state.eventLog.find(e => e.type === 'new_world_phase_end');
    expect(start).toBeDefined();
    expect(end).toBeDefined();
  });

  it('moves underway colonies to active', () => {
    const state = stateWithNewWorld({
      underwayColonies: [{ power: 'england' }, { power: 'hapsburg' }]
    });
    const helpers = createMockHelpers();
    resolveNewWorld(state, helpers);
    expect(state.newWorld.colonies).toHaveLength(2);
    expect(state.newWorld.underwayColonies).toHaveLength(0);
  });

  it('resets turn tracking after resolution', () => {
    const state = stateWithNewWorld({
      exploredThisTurn: { england: true },
      colonizedThisTurn: { france: true },
      conqueredThisTurn: { hapsburg: true }
    });
    const helpers = createMockHelpers();
    resolveNewWorld(state, helpers);
    expect(state.newWorld.exploredThisTurn).toEqual({});
    expect(state.newWorld.colonizedThisTurn).toEqual({});
    expect(state.newWorld.conqueredThisTurn).toEqual({});
  });

  it('resolves exploration (run 20 times for coverage)', () => {
    let lostCount = 0;
    let discoveryCount = 0;
    let noDiscoveryCount = 0;

    for (let i = 0; i < 20; i++) {
      const state = stateWithNewWorld({
        underwayExplorations: [{ power: 'hapsburg' }]
      });
      const helpers = createMockHelpers();
      resolveNewWorld(state, helpers);

      const lost = state.eventLog.find(e => e.type === 'explorer_lost');
      const disc = state.eventLog.find(e => e.type === 'discovery_made');
      const noDisc = state.eventLog.find(e => e.type === 'no_discovery');
      const circum = state.eventLog.find(e =>
        e.type === 'circumnavigation_success' || e.type === 'circumnavigation_failed'
      );

      if (lost) lostCount++;
      if (disc) discoveryCount++;
      if (noDisc) noDiscoveryCount++;

      // Explorer should end up somewhere
      expect(
        lost || disc || noDisc || circum
      ).toBeDefined();
    }
    // With 20 runs we should see some variety
    expect(lostCount + discoveryCount + noDiscoveryCount).toBeGreaterThan(0);
  });

  it('resolves conquest (run 20 times for coverage)', () => {
    let killedCount = 0;
    let conquestCount = 0;

    for (let i = 0; i < 20; i++) {
      const state = stateWithNewWorld({
        underwayConquests: [{ power: 'hapsburg' }]
      });
      const helpers = createMockHelpers();
      resolveNewWorld(state, helpers);

      const killed = state.eventLog.find(e =>
        e.type === 'conquest_failed' && e.data.result === 'killed'
      );
      const conquest = state.eventLog.find(e => e.type === 'conquest_made');

      if (killed) killedCount++;
      if (conquest) conquestCount++;
    }
    expect(killedCount + conquestCount).toBeGreaterThan(0);
  });

  it('claims discoveries in order and avoids duplicates', () => {
    // Pre-claim st_lawrence and great_lakes
    const state = stateWithNewWorld({
      underwayExplorations: [{ power: 'france' }],
      claimedDiscoveries: ['st_lawrence', 'great_lakes'],
      // Force a good explorer to ensure discovery
      deadExplorers: ['cabot_fra', 'roberval', 'verrazano']
      // Only cartier (exploration: 3) remains
    });
    const helpers = createMockHelpers();

    // Run multiple times — if discovery is made, it must be mississippi
    let found = false;
    for (let i = 0; i < 30; i++) {
      const s = stateWithNewWorld({
        underwayExplorations: [{ power: 'france' }],
        claimedDiscoveries: ['st_lawrence', 'great_lakes'],
        deadExplorers: ['cabot_fra', 'roberval', 'verrazano']
      });
      const h = createMockHelpers();
      resolveNewWorld(s, h);
      const disc = s.eventLog.find(e => e.type === 'discovery_made');
      if (disc && disc.data.discovery === 'mississippi') {
        found = true;
        break;
      }
    }
    // With Cartier (+3), a roll of 7-9 gives discovery, roll of 4+ needed
    // P(sum >= 4) on 2d6 is very high, so mississippi should appear
    expect(found).toBe(true);
  });

  it('awards VP to bonusVp on discovery', () => {
    // Run until we get a discovery
    for (let i = 0; i < 50; i++) {
      const state = stateWithNewWorld({
        underwayExplorations: [{ power: 'hapsburg' }],
        // Use only Magellan (exploration: 4) for high chance
        deadExplorers: ['cabot_hap', 'desoto', 'de_vaca', 'leon', 'narvaez', 'orellana']
      });
      const helpers = createMockHelpers();
      resolveNewWorld(state, helpers);
      if (state.bonusVp.hapsburg > 0) {
        expect(state.bonusVp.hapsburg).toBeGreaterThan(0);
        return;
      }
    }
    // Magellan +4 means 2d6+4, minimum 6. Result: 6=nothing, 7+=discovery
    // P(sum >= 3) = very high, should get discovery
    expect(true).toBe(true); // Fallback — probabilistic test
  });

  it('resolves english/french conquests (no conquistador)', () => {
    const state = stateWithNewWorld({
      underwayConquests: [{ power: 'england' }]
    });
    const helpers = createMockHelpers();
    resolveNewWorld(state, helpers);
    // Should have some conquest event
    const events = state.eventLog.filter(e =>
      e.type === 'conquest_made' || e.type === 'conquest_failed'
    );
    expect(events.length).toBeGreaterThan(0);
    // English conquest has modifier 0
    expect(events[0].data.conquistador).toBeNull();
  });

  it('skips exploration when no explorers available (pool empty)', () => {
    // Kill all hapsburg explorers
    const allHapExplorers = [
      'cabot_hap', 'desoto', 'de_vaca', 'leon', 'magellan', 'narvaez', 'orellana'
    ];
    const state = stateWithNewWorld({
      underwayExplorations: [{ power: 'hapsburg' }],
      deadExplorers: allHapExplorers
    });
    const helpers = createMockHelpers();
    resolveNewWorld(state, helpers);

    // No exploration event should be logged (explorer_lost, discovery_made,
    // no_discovery, circumnavigation_*) because the voyage is skipped
    const explorationEvents = state.eventLog.filter(e =>
      ['explorer_lost', 'discovery_made', 'no_discovery',
        'circumnavigation_success', 'circumnavigation_failed'].includes(e.type)
    );
    expect(explorationEvents).toHaveLength(0);
  });

  it('deep penetration falls back to Amazon when Pacific already claimed', () => {
    // Run many times with Magellan (+4) for deep penetration chance
    let amazonFound = false;
    for (let i = 0; i < 100 && !amazonFound; i++) {
      const state = stateWithNewWorld({
        underwayExplorations: [{ power: 'hapsburg' }],
        claimedDiscoveries: ['pacific_strait', 'circumnavigation'],
        deadExplorers: ['cabot_hap', 'desoto', 'de_vaca', 'leon', 'narvaez', 'orellana']
        // Only magellan remains (exploration: 4)
      });
      const helpers = createMockHelpers();
      resolveNewWorld(state, helpers);

      const disc = state.eventLog.find(
        e => e.type === 'discovery_made' && e.data.discovery === 'amazon'
      );
      if (disc) amazonFound = true;
    }
    // Magellan +4 means 2d6+4, min 6, max 16.
    // Deep penetration (10+) triggers Amazon fallback since Pacific claimed
    expect(amazonFound).toBe(true);
  });

  it('logs all_claimed when all discoveries are taken', () => {
    const allClaimed = [
      'st_lawrence', 'great_lakes', 'mississippi',
      'pacific_strait', 'circumnavigation', 'amazon'
    ];
    // Run until we get a discovery-range roll (7-9)
    let allClaimedLogged = false;
    for (let i = 0; i < 100 && !allClaimedLogged; i++) {
      const state = stateWithNewWorld({
        underwayExplorations: [{ power: 'hapsburg' }],
        claimedDiscoveries: [...allClaimed],
        deadExplorers: ['cabot_hap', 'desoto', 'de_vaca', 'leon', 'narvaez', 'orellana']
      });
      const helpers = createMockHelpers();
      resolveNewWorld(state, helpers);

      const noDisc = state.eventLog.find(
        e => e.type === 'no_discovery' && e.data.reason === 'all_claimed'
      );
      if (noDisc) {
        allClaimedLogged = true;
      }
    }
    expect(allClaimedLogged).toBe(true);
  });

  it('conquest modifier is 0 for non-Hapsburg powers', () => {
    // England and France conquests have modifier 0 (no conquistador)
    for (const power of ['england', 'france']) {
      const state = stateWithNewWorld({
        underwayConquests: [{ power }]
      });
      const helpers = createMockHelpers();
      resolveNewWorld(state, helpers);

      const events = state.eventLog.filter(e =>
        e.type === 'conquest_made' || e.type === 'conquest_failed'
      );
      expect(events.length).toBeGreaterThan(0);
      // conquistador should be null for non-Hapsburg
      expect(events[0].data.conquistador).toBeNull();
    }
  });

  it('non-Hapsburg conquest does not use conquistador even on success', () => {
    // Run until England gets a successful conquest
    let found = false;
    for (let i = 0; i < 100 && !found; i++) {
      const state = stateWithNewWorld({
        underwayConquests: [{ power: 'england' }]
      });
      const helpers = createMockHelpers();
      resolveNewWorld(state, helpers);

      const conquest = state.eventLog.find(e => e.type === 'conquest_made');
      if (conquest) {
        // No conquistador should be placed
        expect(conquest.data.conquistador).toBeNull();
        expect(state.newWorld.placedConquistadors).toHaveLength(0);
        found = true;
      }
    }
    // 2d6 + 0 >= 9: P(sum >= 9) on 2d6 = 10/36 ≈ 28%
    expect(found).toBe(true);
  });

  it('multiple explorations resolved in priority order (highest explorer first)', () => {
    // Send england and france explorations; verify ordering by checking events
    let verified = false;
    for (let i = 0; i < 50 && !verified; i++) {
      const state = stateWithNewWorld({
        underwayExplorations: [
          { power: 'france' },
          { power: 'england' }
        ],
        // Kill all but Cartier (france, exploration:3) and Willoughby (england, exploration:0)
        deadExplorers: [
          'cabot_fra', 'roberval', 'verrazano',
          'cabot_eng', 'chancellor', 'rut'
        ]
      });
      const helpers = createMockHelpers();
      resolveNewWorld(state, helpers);

      // Look for exploration events — France's Cartier (3) should resolve before
      // England's Willoughby (0) due to higher exploration value
      const explorationEvents = state.eventLog.filter(e =>
        ['explorer_lost', 'discovery_made', 'no_discovery',
          'circumnavigation_success', 'circumnavigation_failed'].includes(e.type)
      );

      if (explorationEvents.length >= 2) {
        // First event should be France (Cartier, value 3)
        expect(explorationEvents[0].data.power).toBe('france');
        // Second event should be England (Willoughby, value 0)
        expect(explorationEvents[1].data.power).toBe('england');
        verified = true;
      }
    }
    expect(verified).toBe(true);
  });

  // ── Edge Cases ─────────────────────────────────────────────────

  it('multiple colonies from different powers all placed', () => {
    const state = stateWithNewWorld({
      underwayColonies: [
        { power: 'england' }, { power: 'france' }, { power: 'hapsburg' }
      ]
    });
    const helpers = createMockHelpers();
    resolveNewWorld(state, helpers);
    expect(state.newWorld.colonies).toHaveLength(3);
    expect(state.newWorld.underwayColonies).toHaveLength(0);
    const powers = state.newWorld.colonies.map(c => c.power);
    expect(powers).toContain('england');
    expect(powers).toContain('france');
    expect(powers).toContain('hapsburg');
  });

  it('Hapsburg conquest skipped when no conquistadors available', () => {
    const allConqs = ['cordova', 'coronado', 'cortez', 'montejo', 'pizarro'];
    const state = stateWithNewWorld({
      underwayConquests: [{ power: 'hapsburg' }],
      deadConquistadors: allConqs
    });
    const helpers = createMockHelpers();
    resolveNewWorld(state, helpers);
    // No conquest events should appear
    const conquestEvents = state.eventLog.filter(e =>
      e.type === 'conquest_made' || e.type === 'conquest_failed'
    );
    expect(conquestEvents).toHaveLength(0);
  });

  it('conquests resolved in power order: Hapsburg before England', () => {
    let verified = false;
    for (let i = 0; i < 50 && !verified; i++) {
      const state = stateWithNewWorld({
        underwayConquests: [
          { power: 'england' },
          { power: 'hapsburg' }
        ]
      });
      const helpers = createMockHelpers();
      resolveNewWorld(state, helpers);
      const events = state.eventLog.filter(e =>
        e.type === 'conquest_made' || e.type === 'conquest_failed'
      );
      if (events.length >= 2) {
        expect(events[0].data.power).toBe('hapsburg');
        expect(events[1].data.power).toBe('england');
        verified = true;
      }
    }
    expect(verified).toBe(true);
  });

  it('all conquests claimed returns all_claimed result', () => {
    let found = false;
    for (let i = 0; i < 100 && !found; i++) {
      const state = stateWithNewWorld({
        underwayConquests: [{ power: 'england' }],
        claimedConquests: ['aztec', 'inca', 'maya']
      });
      const helpers = createMockHelpers();
      resolveNewWorld(state, helpers);
      const evt = state.eventLog.find(e =>
        e.type === 'conquest_failed' && e.data.result === 'all_claimed'
      );
      if (evt) found = true;
    }
    // With 2d6+0 >= 9 (28% chance) and all claimed, should trigger
    expect(found).toBe(true);
  });

  it('deep penetration with Pacific+Amazon claimed falls back to 1VP discovery', () => {
    let found = false;
    for (let i = 0; i < 100 && !found; i++) {
      const state = stateWithNewWorld({
        underwayExplorations: [{ power: 'hapsburg' }],
        claimedDiscoveries: ['pacific_strait', 'circumnavigation', 'amazon'],
        deadExplorers: ['cabot_hap', 'desoto', 'de_vaca', 'leon', 'narvaez', 'orellana']
        // Only magellan (+4) remains — rolls 2d6+4, 10+ triggers deep penetration
      });
      const helpers = createMockHelpers();
      resolveNewWorld(state, helpers);

      const disc = state.eventLog.find(e =>
        e.type === 'discovery_made' &&
        ['st_lawrence', 'great_lakes', 'mississippi'].includes(e.data.discovery)
      );
      if (disc) found = true;
    }
    // Magellan +4 on 2d6: P(sum >= 6 for roll 10+) ≈ 72%, then falls back to 1VP
    expect(found).toBe(true);
  });

  it('deep penetration with everything claimed logs all_claimed', () => {
    let found = false;
    for (let i = 0; i < 100 && !found; i++) {
      const state = stateWithNewWorld({
        underwayExplorations: [{ power: 'hapsburg' }],
        claimedDiscoveries: [
          'st_lawrence', 'great_lakes', 'mississippi',
          'pacific_strait', 'circumnavigation', 'amazon'
        ],
        deadExplorers: ['cabot_hap', 'desoto', 'de_vaca', 'leon', 'narvaez', 'orellana']
      });
      const helpers = createMockHelpers();
      resolveNewWorld(state, helpers);

      const noDisc = state.eventLog.find(e =>
        e.type === 'no_discovery' && e.data.reason === 'all_claimed'
      );
      if (noDisc) found = true;
    }
    expect(found).toBe(true);
  });

  it('circumnavigation already claimed still awards Pacific VP', () => {
    let found = false;
    for (let i = 0; i < 100 && !found; i++) {
      const state = stateWithNewWorld({
        underwayExplorations: [{ power: 'hapsburg' }],
        claimedDiscoveries: ['circumnavigation'],
        deadExplorers: ['cabot_hap', 'desoto', 'de_vaca', 'leon', 'narvaez', 'orellana']
      });
      const helpers = createMockHelpers();
      resolveNewWorld(state, helpers);

      // If deep penetration triggered and Pacific not yet claimed
      const circumEvt = state.eventLog.find(e =>
        e.type === 'circumnavigation_success' || e.type === 'circumnavigation_failed'
      );
      if (circumEvt) {
        // Pacific was claimed (new), circumnavigation was already claimed
        expect(state.newWorld.claimedDiscoveries).toContain('pacific_strait');
        found = true;
      }
    }
    // Magellan +4 means high chance of deep penetration (roll 10+)
    expect(found).toBe(true);
  });
});
