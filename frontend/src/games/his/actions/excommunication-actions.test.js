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
});
