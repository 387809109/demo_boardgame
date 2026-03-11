/**
 * Analytics event schema tests.
 */
import { describe, it, expect } from 'vitest';
import {
  isKnownAnalyticsEvent,
  getAllowedPropertyKeys,
  sanitizeEventProperties
} from './analytics-events.js';

describe('analytics-events', () => {
  describe('isKnownAnalyticsEvent', () => {
    it('returns true for known events', () => {
      expect(isKnownAnalyticsEvent('game_started')).toBe(true);
      expect(isKnownAnalyticsEvent('chat_message_sent')).toBe(true);
    });

    it('returns false for unknown events', () => {
      expect(isKnownAnalyticsEvent('custom_event')).toBe(false);
      expect(isKnownAnalyticsEvent('')).toBe(false);
      expect(isKnownAnalyticsEvent(null)).toBe(false);
    });
  });

  describe('getAllowedPropertyKeys', () => {
    it('returns whitelisted keys for known event', () => {
      expect(getAllowedPropertyKeys('game_started')).toEqual(
        ['game_id', 'mode', 'player_count']
      );
    });

    it('returns empty array for unknown event', () => {
      expect(getAllowedPropertyKeys('custom_event')).toEqual([]);
    });
  });

  describe('sanitizeEventProperties', () => {
    it('keeps only whitelisted primitive fields', () => {
      const { sanitized, dropped } = sanitizeEventProperties('game_started', {
        game_id: 'uno',
        mode: 'local',
        player_count: 4,
        extra: 'x',
        nested: { a: 1 }
      });

      expect(sanitized).toEqual({
        game_id: 'uno',
        mode: 'local',
        player_count: 4
      });
      expect(dropped).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'extra', reason: 'key_not_whitelisted' }),
          expect.objectContaining({ key: 'nested', reason: 'key_not_whitelisted' })
        ])
      );
    });

    it('drops forbidden privacy-sensitive keys', () => {
      const { sanitized, dropped } = sanitizeEventProperties('game_selected', {
        game_id: 'werewolf',
        mode: 'cloud',
        nickname: 'Alice',
        room_id: 'ABCD1234'
      });

      expect(sanitized).toEqual({
        game_id: 'werewolf',
        mode: 'cloud'
      });
      expect(dropped).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'nickname', reason: 'key_not_whitelisted' }),
          expect.objectContaining({ key: 'room_id', reason: 'key_not_whitelisted' })
        ])
      );
    });

    it('drops non-primitive values on whitelisted keys', () => {
      const { sanitized, dropped } = sanitizeEventProperties('reconnect_attempted', {
        mode: 'cloud',
        attempt: { count: 2 }
      });

      expect(sanitized).toEqual({ mode: 'cloud' });
      expect(dropped).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'attempt', reason: 'invalid_value_type' })
        ])
      );
    });

    it('returns empty sanitized payload for unknown event', () => {
      const { sanitized, dropped } = sanitizeEventProperties('unknown_event', {
        a: 1
      });

      expect(sanitized).toEqual({});
      expect(dropped).toEqual([
        { key: 'a', reason: 'unknown_event' }
      ]);
    });

    it('supports events without properties', () => {
      const { sanitized, dropped } = sanitizeEventProperties('query_panel_opened', {
        source: 'manual'
      });

      expect(sanitized).toEqual({});
      expect(dropped).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'source', reason: 'key_not_whitelisted' })
        ])
      );
    });
  });
});

