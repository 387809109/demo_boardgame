/**
 * Here I Stand — state-init.js Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { buildInitialState } from './state-init.js';
import { MAJOR_POWERS, IMPULSE_ORDER } from '../constants.js';
import { TEST_PLAYERS } from '../test-helpers.js';

describe('buildInitialState', () => {
  const state = buildInitialState(TEST_PLAYERS, {});

  // ── Core Structure ──────────────────────────────────────────────

  describe('core structure', () => {
    it('sets turn to 1', () => {
      expect(state.turn).toBe(1);
    });

    it('sets phase to card_draw', () => {
      expect(state.phase).toBe('card_draw');
    });

    it('sets status to playing', () => {
      expect(state.status).toBe('playing');
    });

    it('has 6 players', () => {
      expect(state.players).toHaveLength(6);
    });

    it('assigns powers in IMPULSE_ORDER', () => {
      for (let i = 0; i < 6; i++) {
        expect(state.players[i].power).toBe(IMPULSE_ORDER[i]);
      }
    });

    it('builds powerByPlayer mapping', () => {
      expect(state.powerByPlayer['p1']).toBe('ottoman');
      expect(state.powerByPlayer['p6']).toBe('protestant');
    });

    it('builds playerByPower mapping', () => {
      expect(state.playerByPower['ottoman']).toBe('p1');
      expect(state.playerByPower['protestant']).toBe('p6');
    });

    it('has bidirectional player-power consistency', () => {
      for (const [pid, power] of Object.entries(state.powerByPlayer)) {
        expect(state.playerByPower[power]).toBe(pid);
      }
    });
  });

  // ── Map ─────────────────────────────────────────────────────────

  describe('map', () => {
    it('has 134 spaces', () => {
      expect(Object.keys(state.spaces)).toHaveLength(134);
    });

    it('Istanbul exists with correct properties', () => {
      const ist = state.spaces['Istanbul'];
      expect(ist).toBeDefined();
      expect(ist.controller).toBe('ottoman');
      expect(ist.isKey).toBe(true);
    });

    it('control markers applied correctly', () => {
      expect(state.spaces['Vienna'].controller).toBe('hapsburg');
      expect(state.spaces['Paris'].controller).toBe('france');
      expect(state.spaces['London'].controller).toBe('england');
      expect(state.spaces['Rome'].controller).toBe('papacy');
    });

    it('has 21 Catholic-marked Protestant home spaces', () => {
      const catholicGermanSpaces = Object.values(state.spaces).filter(
        sp => sp.languageZone === 'german' &&
              sp.religion === 'catholic' &&
              sp.controller === 'protestant'
      );
      expect(catholicGermanSpaces).toHaveLength(21);
    });
  });

  // ── Unit Deployment ─────────────────────────────────────────────

  describe('unit deployment', () => {
    it('Istanbul has 7 regulars', () => {
      const ist = state.spaces['Istanbul'];
      expect(ist.units).toHaveLength(1);
      expect(ist.units[0].regulars).toBe(7);
    });

    it('Istanbul has cavalry and squadron', () => {
      const ist = state.spaces['Istanbul'];
      expect(ist.units[0].cavalry).toBe(1);
      expect(ist.units[0].squadrons).toBe(2);
    });

    it('Istanbul has 2 leaders', () => {
      const ist = state.spaces['Istanbul'];
      expect(ist.units[0].leaders).toEqual(['suleiman', 'ibrahim']);
    });

    it('Vienna has 4 regulars and ferdinand', () => {
      const vienna = state.spaces['Vienna'];
      const hapUnit = vienna.units.find(u => u.owner === 'hapsburg');
      expect(hapUnit.regulars).toBe(4);
      expect(hapUnit.leaders).toContain('ferdinand');
    });

    it('Venice minor power deployed', () => {
      const venice = state.spaces['Venice'];
      const unit = venice.units.find(u => u.owner === 'venice');
      expect(unit.regulars).toBe(2);
      expect(unit.squadrons).toBe(3);
    });

    it('Rhodes has independent garrison', () => {
      const rhodes = state.spaces['Rhodes'];
      const unit = rhodes.units.find(u => u.owner === 'independent');
      expect(unit.regulars).toBe(1);
    });
  });

  // ── VP ──────────────────────────────────────────────────────────

  describe('victory points', () => {
    it('has correct starting VP', () => {
      expect(state.vp.ottoman).toBe(8);
      expect(state.vp.hapsburg).toBe(9);
      expect(state.vp.england).toBe(9);
      expect(state.vp.france).toBe(12);
      expect(state.vp.papacy).toBe(19);
      expect(state.vp.protestant).toBe(0);
    });

    it('bonusVp all zero', () => {
      for (const power of MAJOR_POWERS) {
        expect(state.bonusVp[power]).toBe(0);
      }
    });
  });

  // ── Deck ────────────────────────────────────────────────────────

  describe('deck', () => {
    it('has cards in deck', () => {
      expect(state.deck.length).toBeGreaterThan(0);
    });

    it('does not contain home cards (#1-7)', () => {
      for (let i = 1; i <= 7; i++) {
        expect(state.deck).not.toContain(i);
      }
    });

    it('does not contain excluded cards (#14)', () => {
      expect(state.deck).not.toContain(14);
    });

    it('hands are empty before card draw', () => {
      for (const power of MAJOR_POWERS) {
        expect(state.hands[power]).toEqual([]);
      }
    });

    it('homeCardPlayed all false', () => {
      for (const power of MAJOR_POWERS) {
        expect(state.homeCardPlayed[power]).toBe(false);
      }
    });
  });

  // ── Power-Specific State ────────────────────────────────────────

  describe('power-specific state', () => {
    it('piracyTrack is 0', () => {
      expect(state.piracyTrack).toBe(0);
    });

    it('piracyEnabled is false before Barbary Pirates', () => {
      expect(state.piracyEnabled).toBe(false);
    });

    it('turnTrack naval pools are initialized empty', () => {
      expect(state.turnTrack).toBeDefined();
      expect(state.turnTrack.navalUnits).toEqual([]);
      expect(state.turnTrack.navalLeaders).toEqual([]);
    });

    it('chateauxTrack is 0', () => {
      expect(state.chateauxTrack).toBe(0);
    });

    it('henryMaritalStatus is catherine_of_aragon', () => {
      expect(state.henryMaritalStatus).toBe('catherine_of_aragon');
    });

    it('papacy debaters has 5 members', () => {
      expect(state.debaters.papal).toHaveLength(5);
    });

    it('protestant debaters has 4 members', () => {
      expect(state.debaters.protestant).toHaveLength(4);
    });

    it('rulers set correctly', () => {
      expect(state.rulers.ottoman).toBe('suleiman');
      expect(state.rulers.hapsburg).toBe('charles_v');
      expect(state.rulers.england).toBe('henry_viii');
    });
  });

  // ── Diplomacy ───────────────────────────────────────────────────

  describe('diplomacy', () => {
    it('has 3 starting wars', () => {
      expect(state.wars).toHaveLength(3);
    });

    it('alliances is empty', () => {
      expect(state.alliances).toEqual([]);
    });
  });
});
