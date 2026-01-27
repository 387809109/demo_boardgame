/**
 * Validators Unit Tests
 */
import { describe, it, expect } from 'vitest';
import {
  validateMessage,
  validatePlayerId,
  validateNickname,
  validateRoomId,
  validateIPAddress,
  validateGameConfig,
  validateChatMessage
} from './validators.js';

describe('Validators', () => {
  describe('validateMessage', () => {
    const validMessage = {
      type: 'JOIN',
      timestamp: Date.now(),
      playerId: 'player-123'
    };

    it('should accept valid client message', () => {
      const result = validateMessage(validMessage);
      expect(result.valid).toBe(true);
    });

    it('should accept valid server message', () => {
      const result = validateMessage({
        type: 'PLAYER_JOINED',
        timestamp: Date.now(),
        playerId: 'player-123'
      });
      expect(result.valid).toBe(true);
    });

    it('should accept all client message types', () => {
      const types = ['JOIN', 'LEAVE', 'START_GAME', 'GAME_ACTION', 'CHAT_MESSAGE', 'PING'];
      types.forEach(type => {
        const result = validateMessage({ ...validMessage, type });
        expect(result.valid).toBe(true);
      });
    });

    it('should accept all server message types', () => {
      const types = [
        'PLAYER_JOINED', 'PLAYER_LEFT', 'GAME_STARTED',
        'GAME_STATE_UPDATE', 'GAME_ENDED', 'CHAT_MESSAGE_BROADCAST',
        'PONG', 'ERROR'
      ];
      types.forEach(type => {
        const result = validateMessage({ ...validMessage, type });
        expect(result.valid).toBe(true);
      });
    });

    it('should reject null message', () => {
      const result = validateMessage(null);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('object');
    });

    it('should reject undefined message', () => {
      const result = validateMessage(undefined);
      expect(result.valid).toBe(false);
    });

    it('should reject non-object message', () => {
      expect(validateMessage('string').valid).toBe(false);
      expect(validateMessage(123).valid).toBe(false);
      expect(validateMessage([]).valid).toBe(false);
    });

    it('should reject missing type', () => {
      const result = validateMessage({
        timestamp: Date.now(),
        playerId: 'player-123'
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('type');
    });

    it('should reject invalid type', () => {
      const result = validateMessage({
        ...validMessage,
        type: 'INVALID_TYPE'
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid message type');
    });

    it('should reject non-string type', () => {
      const result = validateMessage({
        ...validMessage,
        type: 123
      });
      expect(result.valid).toBe(false);
    });

    it('should reject missing timestamp', () => {
      const result = validateMessage({
        type: 'JOIN',
        playerId: 'player-123'
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('timestamp');
    });

    it('should reject non-numeric timestamp', () => {
      const result = validateMessage({
        ...validMessage,
        timestamp: '2024-01-01'
      });
      expect(result.valid).toBe(false);
    });

    it('should reject missing playerId', () => {
      const result = validateMessage({
        type: 'JOIN',
        timestamp: Date.now()
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('playerId');
    });

    it('should reject non-string playerId', () => {
      const result = validateMessage({
        ...validMessage,
        playerId: 123
      });
      expect(result.valid).toBe(false);
    });

    it('should accept message with additional data', () => {
      const result = validateMessage({
        ...validMessage,
        data: { roomId: 'room-1', nickname: 'Player' }
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('validatePlayerId', () => {
    it('should accept valid player ID', () => {
      expect(validatePlayerId('player-123').valid).toBe(true);
      expect(validatePlayerId('Player_456').valid).toBe(true);
      expect(validatePlayerId('abc12').valid).toBe(true);
    });

    it('should accept minimum length (5 chars)', () => {
      const result = validatePlayerId('abcde');
      expect(result.valid).toBe(true);
    });

    it('should accept maximum length (50 chars)', () => {
      const result = validatePlayerId('a'.repeat(50));
      expect(result.valid).toBe(true);
    });

    it('should reject too short IDs', () => {
      expect(validatePlayerId('abcd').valid).toBe(false);
      expect(validatePlayerId('abc').valid).toBe(false);
      expect(validatePlayerId('a').valid).toBe(false);
    });

    it('should reject too long IDs', () => {
      expect(validatePlayerId('a'.repeat(51)).valid).toBe(false);
      expect(validatePlayerId('a'.repeat(100)).valid).toBe(false);
    });

    it('should reject null or undefined', () => {
      expect(validatePlayerId(null).valid).toBe(false);
      expect(validatePlayerId(undefined).valid).toBe(false);
    });

    it('should reject empty string', () => {
      const result = validatePlayerId('');
      expect(result.valid).toBe(false);
    });

    it('should reject non-string types', () => {
      expect(validatePlayerId(12345).valid).toBe(false);
      expect(validatePlayerId({}).valid).toBe(false);
    });

    it('should reject special characters', () => {
      expect(validatePlayerId('player@123').valid).toBe(false);
      expect(validatePlayerId('player.name').valid).toBe(false);
      expect(validatePlayerId('player name').valid).toBe(false);
      expect(validatePlayerId('player#123').valid).toBe(false);
    });

    it('should allow underscores and dashes', () => {
      expect(validatePlayerId('player_name').valid).toBe(true);
      expect(validatePlayerId('player-name').valid).toBe(true);
      expect(validatePlayerId('player_name-123').valid).toBe(true);
    });
  });

  describe('validateNickname', () => {
    it('should accept valid nicknames', () => {
      expect(validateNickname('Player').valid).toBe(true);
      expect(validateNickname('玩家1').valid).toBe(true);
      expect(validateNickname('Player 123').valid).toBe(true);
    });

    it('should accept minimum length (1 char)', () => {
      expect(validateNickname('A').valid).toBe(true);
      expect(validateNickname('我').valid).toBe(true);
    });

    it('should accept maximum length (20 chars)', () => {
      expect(validateNickname('a'.repeat(20)).valid).toBe(true);
    });

    it('should reject too long nicknames', () => {
      expect(validateNickname('a'.repeat(21)).valid).toBe(false);
      expect(validateNickname('a'.repeat(50)).valid).toBe(false);
    });

    it('should reject null or undefined', () => {
      expect(validateNickname(null).valid).toBe(false);
      expect(validateNickname(undefined).valid).toBe(false);
    });

    it('should reject empty string', () => {
      expect(validateNickname('').valid).toBe(false);
    });

    it('should reject whitespace-only string', () => {
      expect(validateNickname('   ').valid).toBe(false);
    });

    it('should reject non-string types', () => {
      expect(validateNickname(123).valid).toBe(false);
      expect(validateNickname({}).valid).toBe(false);
    });

    it('should reject problematic characters', () => {
      expect(validateNickname('Player<script>').valid).toBe(false);
      expect(validateNickname('Player>').valid).toBe(false);
      expect(validateNickname('Player"name').valid).toBe(false);
      expect(validateNickname("Player'name").valid).toBe(false);
      expect(validateNickname('Player\\name').valid).toBe(false);
    });

    it('should accept Unicode characters', () => {
      expect(validateNickname('玩家一号').valid).toBe(true);
      expect(validateNickname('プレイヤー').valid).toBe(true);
      expect(validateNickname('Игрок').valid).toBe(true);
      expect(validateNickname('🎮Player').valid).toBe(true);
    });

    it('should trim whitespace for length check', () => {
      expect(validateNickname('  A  ').valid).toBe(true);
      expect(validateNickname('  ' + 'a'.repeat(20) + '  ').valid).toBe(true);
    });
  });

  describe('validateRoomId', () => {
    it('should accept valid room IDs', () => {
      expect(validateRoomId('room-123').valid).toBe(true);
      expect(validateRoomId('Room_456').valid).toBe(true);
      expect(validateRoomId('ABCD').valid).toBe(true);
    });

    it('should accept minimum length (4 chars)', () => {
      expect(validateRoomId('abcd').valid).toBe(true);
    });

    it('should accept maximum length (20 chars)', () => {
      expect(validateRoomId('a'.repeat(20)).valid).toBe(true);
    });

    it('should reject too short IDs', () => {
      expect(validateRoomId('abc').valid).toBe(false);
      expect(validateRoomId('ab').valid).toBe(false);
      expect(validateRoomId('a').valid).toBe(false);
    });

    it('should reject too long IDs', () => {
      expect(validateRoomId('a'.repeat(21)).valid).toBe(false);
      expect(validateRoomId('a'.repeat(50)).valid).toBe(false);
    });

    it('should reject null or undefined', () => {
      expect(validateRoomId(null).valid).toBe(false);
      expect(validateRoomId(undefined).valid).toBe(false);
    });

    it('should reject empty string', () => {
      expect(validateRoomId('').valid).toBe(false);
    });

    it('should reject non-string types', () => {
      expect(validateRoomId(1234).valid).toBe(false);
      expect(validateRoomId({}).valid).toBe(false);
    });

    it('should reject special characters', () => {
      expect(validateRoomId('room@123').valid).toBe(false);
      expect(validateRoomId('room.name').valid).toBe(false);
      expect(validateRoomId('room name').valid).toBe(false);
      expect(validateRoomId('room#123').valid).toBe(false);
    });

    it('should allow underscores and dashes', () => {
      expect(validateRoomId('room_name').valid).toBe(true);
      expect(validateRoomId('room-name').valid).toBe(true);
      expect(validateRoomId('room_1-A').valid).toBe(true);
    });
  });

  describe('validateIPAddress', () => {
    it('should accept valid IPv4 addresses', () => {
      expect(validateIPAddress('192.168.1.1').valid).toBe(true);
      expect(validateIPAddress('10.0.0.1').valid).toBe(true);
      expect(validateIPAddress('127.0.0.1').valid).toBe(true);
      expect(validateIPAddress('0.0.0.0').valid).toBe(true);
      expect(validateIPAddress('255.255.255.255').valid).toBe(true);
    });

    it('should reject null or undefined', () => {
      expect(validateIPAddress(null).valid).toBe(false);
      expect(validateIPAddress(undefined).valid).toBe(false);
    });

    it('should reject empty string', () => {
      expect(validateIPAddress('').valid).toBe(false);
    });

    it('should reject non-string types', () => {
      expect(validateIPAddress(192168).valid).toBe(false);
      expect(validateIPAddress({}).valid).toBe(false);
    });

    it('should reject invalid formats', () => {
      expect(validateIPAddress('192.168.1').valid).toBe(false);
      expect(validateIPAddress('192.168.1.1.1').valid).toBe(false);
      expect(validateIPAddress('192.168.1.').valid).toBe(false);
      expect(validateIPAddress('.192.168.1.1').valid).toBe(false);
    });

    it('should reject octets > 255', () => {
      expect(validateIPAddress('256.168.1.1').valid).toBe(false);
      expect(validateIPAddress('192.256.1.1').valid).toBe(false);
      expect(validateIPAddress('192.168.256.1').valid).toBe(false);
      expect(validateIPAddress('192.168.1.256').valid).toBe(false);
    });

    it('should reject negative octets', () => {
      expect(validateIPAddress('-1.168.1.1').valid).toBe(false);
    });

    it('should reject non-numeric octets', () => {
      expect(validateIPAddress('abc.168.1.1').valid).toBe(false);
      expect(validateIPAddress('192.abc.1.1').valid).toBe(false);
    });

    it('should accept edge case octets', () => {
      expect(validateIPAddress('0.0.0.0').valid).toBe(true);
      expect(validateIPAddress('255.255.255.255').valid).toBe(true);
      expect(validateIPAddress('1.1.1.1').valid).toBe(true);
    });
  });

  describe('validateGameConfig', () => {
    it('should accept valid config', () => {
      const result = validateGameConfig({
        gameType: 'uno',
        maxPlayers: 4
      });
      expect(result.valid).toBe(true);
    });

    it('should accept config without maxPlayers', () => {
      const result = validateGameConfig({
        gameType: 'uno'
      });
      expect(result.valid).toBe(true);
    });

    it('should reject null or undefined', () => {
      expect(validateGameConfig(null).valid).toBe(false);
      expect(validateGameConfig(undefined).valid).toBe(false);
    });

    it('should reject non-object', () => {
      expect(validateGameConfig('string').valid).toBe(false);
      expect(validateGameConfig(123).valid).toBe(false);
    });

    it('should reject missing gameType', () => {
      const result = validateGameConfig({
        maxPlayers: 4
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('gameType');
    });

    it('should reject non-string gameType', () => {
      const result = validateGameConfig({
        gameType: 123
      });
      expect(result.valid).toBe(false);
    });

    it('should reject invalid maxPlayers', () => {
      expect(validateGameConfig({ gameType: 'uno', maxPlayers: 1 }).valid).toBe(false);
      expect(validateGameConfig({ gameType: 'uno', maxPlayers: 21 }).valid).toBe(false);
      expect(validateGameConfig({ gameType: 'uno', maxPlayers: 0 }).valid).toBe(false);
      expect(validateGameConfig({ gameType: 'uno', maxPlayers: -1 }).valid).toBe(false);
    });

    it('should reject non-integer maxPlayers', () => {
      expect(validateGameConfig({ gameType: 'uno', maxPlayers: 4.5 }).valid).toBe(false);
      expect(validateGameConfig({ gameType: 'uno', maxPlayers: '4' }).valid).toBe(false);
    });

    it('should accept valid maxPlayers range', () => {
      expect(validateGameConfig({ gameType: 'uno', maxPlayers: 2 }).valid).toBe(true);
      expect(validateGameConfig({ gameType: 'uno', maxPlayers: 10 }).valid).toBe(true);
      expect(validateGameConfig({ gameType: 'uno', maxPlayers: 20 }).valid).toBe(true);
    });

    it('should accept additional config properties', () => {
      const result = validateGameConfig({
        gameType: 'uno',
        maxPlayers: 4,
        customOption: true,
        settings: { some: 'value' }
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('validateChatMessage', () => {
    it('should accept valid messages', () => {
      expect(validateChatMessage('Hello!').valid).toBe(true);
      expect(validateChatMessage('你好').valid).toBe(true);
      expect(validateChatMessage('A').valid).toBe(true);
    });

    it('should accept maximum length (500 chars)', () => {
      expect(validateChatMessage('a'.repeat(500)).valid).toBe(true);
    });

    it('should reject too long messages', () => {
      expect(validateChatMessage('a'.repeat(501)).valid).toBe(false);
      expect(validateChatMessage('a'.repeat(1000)).valid).toBe(false);
    });

    it('should reject null or undefined', () => {
      expect(validateChatMessage(null).valid).toBe(false);
      expect(validateChatMessage(undefined).valid).toBe(false);
    });

    it('should reject empty string', () => {
      expect(validateChatMessage('').valid).toBe(false);
    });

    it('should reject whitespace-only string', () => {
      expect(validateChatMessage('   ').valid).toBe(false);
      expect(validateChatMessage('\t\n').valid).toBe(false);
    });

    it('should reject non-string types', () => {
      expect(validateChatMessage(123).valid).toBe(false);
      expect(validateChatMessage({}).valid).toBe(false);
      expect(validateChatMessage([]).valid).toBe(false);
    });

    it('should accept messages with special characters', () => {
      expect(validateChatMessage('Hello! @#$%').valid).toBe(true);
      expect(validateChatMessage('<script>').valid).toBe(true); // validation doesn't sanitize
      expect(validateChatMessage('Line1\nLine2').valid).toBe(true);
    });

    it('should accept Unicode messages', () => {
      expect(validateChatMessage('你好世界').valid).toBe(true);
      expect(validateChatMessage('🎮🎯🎲').valid).toBe(true);
      expect(validateChatMessage('Привет').valid).toBe(true);
    });

    it('should trim whitespace for validation', () => {
      expect(validateChatMessage('  Hello  ').valid).toBe(true);
      expect(validateChatMessage('  ' + 'a'.repeat(500) + '  ').valid).toBe(true);
    });
  });
});
