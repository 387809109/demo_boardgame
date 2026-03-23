/**
 * Tests for excommunication system
 */

import { describe, it, expect } from 'vitest';
import {
  checkExcommunicationGrounds,
  validateExcommunicateReformer, excommunicateReformer,
  validateExcommunicateRuler, excommunicateRuler,
  validateRemoveExcommunication, removeExcommunication,
  isRulerExcommunicated, isReformerExcommunicated
} from './excommunication-actions.js';
import { createTestState, createMockHelpers } from '../test-helpers.js';

function excommState(overrides = {}) {
  return createTestState({
    excommunicatedReformers: [],
    excommunicatedRulers: {},
    ...overrides
  });
}

describe('Excommunication', () => {
  // ── Grounds Check ──────────────────────────────────────────────

  describe('checkExcommunicationGrounds', () => {
    it('detects war with Papacy', () => {
      const state = excommState();
      state.wars.push({ a: 'england', b: 'papacy' });
      const result = checkExcommunicationGrounds(state, 'england');
      expect(result.hasGrounds).toBe(true);
      expect(result.reasons).toContain('at_war_with_papacy');
    });

    it('detects alliance with Ottoman', () => {
      const state = excommState();
      state.alliances.push({ a: 'france', b: 'ottoman' });
      const result = checkExcommunicationGrounds(state, 'france');
      expect(result.hasGrounds).toBe(true);
      expect(result.reasons).toContain('allied_with_ottoman');
    });

    it('detects controlling Papal home space', () => {
      const state = excommState();
      state.spaces['Rome'].controller = 'hapsburg';
      const result = checkExcommunicationGrounds(state, 'hapsburg');
      expect(result.hasGrounds).toBe(true);
      expect(result.reasons).toContain('controls_papal_space');
    });

    it('returns no grounds when none exist', () => {
      const state = excommState();
      const result = checkExcommunicationGrounds(state, 'england');
      expect(result.hasGrounds).toBe(false);
      expect(result.reasons).toHaveLength(0);
    });
  });

  // ── Excommunicate Reformer ─────────────────────────────────────

  describe('excommunicateReformer', () => {
    it('validates only papacy can excommunicate', () => {
      const state = excommState();
      const result = validateExcommunicateReformer(state, 'england',
        { reformerId: 'luther' });
      expect(result.valid).toBe(false);
    });

    it('validates reformer is valid target', () => {
      const state = excommState();
      const result = validateExcommunicateReformer(state, 'papacy',
        { reformerId: 'some_invalid' });
      expect(result.valid).toBe(false);
    });

    it('validates not already excommunicated', () => {
      const state = excommState({
        excommunicatedReformers: ['luther']
      });
      const result = validateExcommunicateReformer(state, 'papacy',
        { reformerId: 'luther' });
      expect(result.valid).toBe(false);
    });

    it('validates ruler IDs are not valid reformer targets', () => {
      const state = excommState();
      const result = validateExcommunicateReformer(state, 'papacy',
        { reformerId: 'henry_viii' });
      expect(result.valid).toBe(false);
    });

    it('accepts valid reformer', () => {
      const state = excommState();
      const result = validateExcommunicateReformer(state, 'papacy',
        { reformerId: 'luther' });
      expect(result.valid).toBe(true);
    });

    it('excommunicates and removes reformer from map', () => {
      const state = excommState();
      const helpers = createMockHelpers();

      // Place Luther on map
      state.spaces['Wittenberg'].reformer = 'luther';

      excommunicateReformer(state, 'papacy',
        { reformerId: 'luther' }, helpers);

      expect(state.excommunicatedReformers).toContain('luther');
      expect(state.spaces['Wittenberg'].reformer).toBeNull();
    });
  });

  // ── Excommunicate Ruler ────────────────────────────────────────

  describe('excommunicateRuler', () => {
    it('validates only papacy can excommunicate', () => {
      const state = excommState();
      const result = validateExcommunicateRuler(state, 'france',
        { targetPower: 'england' });
      expect(result.valid).toBe(false);
    });

    it('validates target power is excommunicable', () => {
      const state = excommState();
      const result = validateExcommunicateRuler(state, 'papacy',
        { targetPower: 'ottoman' });
      expect(result.valid).toBe(false);
    });

    it('validates not already excommunicated', () => {
      const state = excommState({
        excommunicatedRulers: { england: true }
      });
      state.wars.push({ a: 'england', b: 'papacy' });
      const result = validateExcommunicateRuler(state, 'papacy',
        { targetPower: 'england' });
      expect(result.valid).toBe(false);
    });

    it('validates grounds exist', () => {
      const state = excommState();
      const result = validateExcommunicateRuler(state, 'papacy',
        { targetPower: 'england' });
      expect(result.valid).toBe(false);
      expect(result.error).toBe('No grounds for excommunication');
    });

    it('accepts valid ruler excommunication', () => {
      const state = excommState();
      state.wars.push({ a: 'england', b: 'papacy' });
      const result = validateExcommunicateRuler(state, 'papacy',
        { targetPower: 'england' });
      expect(result.valid).toBe(true);
    });

    it('excommunicates and places unrest markers', () => {
      const state = excommState();
      const helpers = createMockHelpers();
      state.wars.push({ a: 'france', b: 'papacy' });

      // Use real French-controlled spaces with Catholic religion
      state.spaces['Lyon'].religion = 'catholic';
      state.spaces['Lyon'].unrest = false;
      state.spaces['Bordeaux'].religion = 'catholic';
      state.spaces['Bordeaux'].unrest = false;

      excommunicateRuler(state, 'papacy', {
        targetPower: 'france',
        unrestSpaces: ['Lyon', 'Bordeaux']
      }, helpers);

      expect(state.excommunicatedRulers.france).toBe(true);
      expect(state.spaces['Lyon'].unrest).toBe(true);
      expect(state.spaces['Bordeaux'].unrest).toBe(true);
    });

    it('limits unrest to 2 spaces', () => {
      const state = excommState();
      const helpers = createMockHelpers();
      state.wars.push({ a: 'france', b: 'papacy' });

      state.spaces['Lyon'].religion = 'catholic';
      state.spaces['Lyon'].unrest = false;
      state.spaces['Bordeaux'].religion = 'catholic';
      state.spaces['Bordeaux'].unrest = false;
      state.spaces['Paris'].religion = 'catholic';
      state.spaces['Paris'].unrest = false;

      excommunicateRuler(state, 'papacy', {
        targetPower: 'france',
        unrestSpaces: ['Lyon', 'Bordeaux', 'Paris']
      }, helpers);

      // Only 2 should have unrest
      const unrestCount = ['Lyon', 'Bordeaux', 'Paris']
        .filter(n => state.spaces[n].unrest).length;
      expect(unrestCount).toBe(2);
    });
  });

  // ── Remove Excommunication ─────────────────────────────────────

  describe('removeExcommunication', () => {
    it('validates only papacy can remove', () => {
      const state = excommState({ excommunicatedRulers: { england: true } });
      const result = validateRemoveExcommunication(state, 'england',
        { targetPower: 'england' });
      expect(result.valid).toBe(false);
    });

    it('validates ruler is excommunicated', () => {
      const state = excommState();
      const result = validateRemoveExcommunication(state, 'papacy',
        { targetPower: 'england' });
      expect(result.valid).toBe(false);
    });

    it('removes excommunication', () => {
      const state = excommState({ excommunicatedRulers: { england: true } });
      const helpers = createMockHelpers();

      removeExcommunication(state, 'papacy',
        { targetPower: 'england' }, helpers);

      expect(state.excommunicatedRulers.england).toBeUndefined();
    });
  });

  // ── Query Helpers ──────────────────────────────────────────────

  describe('isRulerExcommunicated', () => {
    it('returns true when excommunicated', () => {
      const state = excommState({ excommunicatedRulers: { france: true } });
      expect(isRulerExcommunicated(state, 'france')).toBe(true);
    });

    it('returns false when not excommunicated', () => {
      const state = excommState();
      expect(isRulerExcommunicated(state, 'france')).toBe(false);
    });
  });

  describe('isReformerExcommunicated', () => {
    it('returns true when excommunicated', () => {
      const state = excommState({ excommunicatedReformers: ['luther'] });
      expect(isReformerExcommunicated(state, 'luther')).toBe(true);
    });

    it('returns false when not excommunicated', () => {
      const state = excommState();
      expect(isReformerExcommunicated(state, 'luther')).toBe(false);
    });
  });

  // ── Edge Cases ─────────────────────────────────────────────────

  describe('edge cases', () => {
    it('detects multiple grounds simultaneously', () => {
      const state = excommState();
      state.wars.push({ a: 'france', b: 'papacy' });
      state.alliances.push({ a: 'france', b: 'ottoman' });
      state.spaces['Rome'].controller = 'france';
      const result = checkExcommunicationGrounds(state, 'france');
      expect(result.hasGrounds).toBe(true);
      expect(result.reasons).toHaveLength(3);
      expect(result.reasons).toContain('at_war_with_papacy');
      expect(result.reasons).toContain('allied_with_ottoman');
      expect(result.reasons).toContain('controls_papal_space');
    });

    it('checks all 5 Papal home spaces for control', () => {
      for (const space of ['Rome', 'Ancona', 'Bologna', 'Ravenna', 'Trent']) {
        const state = excommState();
        // Ensure space exists
        if (!state.spaces[space]) {
          state.spaces[space] = {
            controller: 'papacy', units: [], religion: 'catholic',
            languageZone: 'italian'
          };
        }
        state.spaces[space].controller = 'england';
        const result = checkExcommunicationGrounds(state, 'england');
        expect(result.hasGrounds).toBe(true);
        expect(result.reasons).toContain('controls_papal_space');
      }
    });

    it('only adds controls_papal_space once even if multiple spaces held', () => {
      const state = excommState();
      // Ensure both spaces exist
      for (const space of ['Rome', 'Bologna']) {
        if (!state.spaces[space]) {
          state.spaces[space] = {
            controller: 'papacy', units: [], religion: 'catholic',
            languageZone: 'italian'
          };
        }
      }
      state.spaces['Rome'].controller = 'hapsburg';
      state.spaces['Bologna'].controller = 'hapsburg';
      const result = checkExcommunicationGrounds(state, 'hapsburg');
      expect(result.reasons.filter(r => r === 'controls_papal_space')).toHaveLength(1);
    });

    it('validates missing reformerId returns error', () => {
      const state = excommState();
      const result = validateExcommunicateReformer(state, 'papacy', {});
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Must specify');
    });

    it('validates missing targetPower in ruler excommunication', () => {
      const state = excommState();
      const result = validateExcommunicateRuler(state, 'papacy', {});
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Must specify');
    });

    it('validates missing targetPower in remove excommunication', () => {
      const state = excommState();
      const result = validateRemoveExcommunication(state, 'papacy', {});
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Must specify');
    });

    it('unrest skips spaces with enemy units', () => {
      const state = excommState();
      const helpers = createMockHelpers();
      state.wars.push({ a: 'france', b: 'papacy' });

      // Lyon has enemy (papacy) units with regulars
      state.spaces['Lyon'].religion = 'catholic';
      state.spaces['Lyon'].unrest = false;
      state.spaces['Lyon'].units.push({
        owner: 'papacy', regulars: 2, mercenaries: 0,
        cavalry: 0, squadrons: 0, corsairs: 0, leaders: []
      });

      excommunicateRuler(state, 'papacy', {
        targetPower: 'france',
        unrestSpaces: ['Lyon']
      }, helpers);

      expect(state.spaces['Lyon'].unrest).toBeFalsy();
    });

    it('unrest skips spaces with existing unrest', () => {
      const state = excommState();
      const helpers = createMockHelpers();
      state.wars.push({ a: 'france', b: 'papacy' });

      state.spaces['Lyon'].religion = 'catholic';
      state.spaces['Lyon'].unrest = true; // already has unrest
      state.spaces['Bordeaux'].religion = 'catholic';
      state.spaces['Bordeaux'].unrest = false;

      excommunicateRuler(state, 'papacy', {
        targetPower: 'france',
        unrestSpaces: ['Lyon', 'Bordeaux']
      }, helpers);

      // Lyon skipped (already unrest), Bordeaux gets it
      expect(state.spaces['Bordeaux'].unrest).toBe(true);
    });

    it('unrest skips non-Catholic spaces', () => {
      const state = excommState();
      const helpers = createMockHelpers();
      state.wars.push({ a: 'france', b: 'papacy' });

      state.spaces['Lyon'].religion = 'protestant'; // not catholic
      state.spaces['Lyon'].unrest = false;

      excommunicateRuler(state, 'papacy', {
        targetPower: 'france',
        unrestSpaces: ['Lyon']
      }, helpers);

      expect(state.spaces['Lyon'].unrest).toBeFalsy();
    });

    it('unrest skips spaces not controlled by target power', () => {
      const state = excommState();
      const helpers = createMockHelpers();
      state.wars.push({ a: 'france', b: 'papacy' });

      // Vienna is controlled by hapsburg, not france
      state.spaces['Vienna'].religion = 'catholic';
      state.spaces['Vienna'].unrest = false;

      excommunicateRuler(state, 'papacy', {
        targetPower: 'france',
        unrestSpaces: ['Vienna']
      }, helpers);

      expect(state.spaces['Vienna'].unrest).toBeFalsy();
    });

    it('cannot excommunicate protestant or ottoman rulers', () => {
      const state = excommState();
      state.wars.push({ a: 'protestant', b: 'papacy' });
      const r1 = validateExcommunicateRuler(state, 'papacy',
        { targetPower: 'protestant' });
      expect(r1.valid).toBe(false);

      const r2 = validateExcommunicateRuler(state, 'papacy',
        { targetPower: 'ottoman' });
      expect(r2.valid).toBe(false);
    });

    it('excommunicateReformer handles reformer not on map', () => {
      const state = excommState();
      const helpers = createMockHelpers();
      // No reformer placed on map, but still valid ID
      excommunicateReformer(state, 'papacy',
        { reformerId: 'luther' }, helpers);
      expect(state.excommunicatedReformers).toContain('luther');
      // Should not throw even though no space had the reformer
    });
  });
});
