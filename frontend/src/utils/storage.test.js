/**
 * Storage Utilities Unit Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getDefaultConfig,
  saveConfig,
  loadConfig,
  updateConfig,
  saveSessionData,
  loadSessionData,
  clearSessionData,
  saveRoomCreatePreset,
  loadRoomCreatePreset,
  importConfig
} from './storage.js';

// Mock localStorage and sessionStorage
const createMockStorage = () => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value; }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get _store() { return store; }
  };
};

describe('Storage Utilities', () => {
  let mockLocalStorage;
  let mockSessionStorage;
  let originalLocalStorage;
  let originalSessionStorage;

  beforeEach(() => {
    // Setup mock storage
    mockLocalStorage = createMockStorage();
    mockSessionStorage = createMockStorage();

    originalLocalStorage = globalThis.localStorage;
    originalSessionStorage = globalThis.sessionStorage;

    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true
    });

    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      writable: true
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: originalSessionStorage,
      writable: true
    });
    vi.restoreAllMocks();
  });

  describe('getDefaultConfig', () => {
    it('should return default configuration object', () => {
      const config = getDefaultConfig();

      expect(config).toHaveProperty('graphics');
      expect(config).toHaveProperty('audio');
      expect(config).toHaveProperty('game');
    });

    it('should have correct graphics defaults', () => {
      const config = getDefaultConfig();

      expect(config.graphics.resolution).toBe('auto');
      expect(config.graphics.fullscreen).toBe(false);
      expect(config.graphics.quality).toBe('high');
    });

    it('should have correct audio defaults', () => {
      const config = getDefaultConfig();

      expect(config.audio.master).toBe(80);
      expect(config.audio.sfx).toBe(70);
      expect(config.audio.music).toBe(50);
    });

    it('should have correct game defaults', () => {
      const config = getDefaultConfig();

      expect(config.game.language).toBe('zh-CN');
      expect(config.game.defaultNickname).toMatch(/^玩家\d+$/);
    });

    it('should return new object each time', () => {
      const config1 = getDefaultConfig();
      const config2 = getDefaultConfig();

      expect(config1).not.toBe(config2);
    });
  });

  describe('saveConfig', () => {
    it('should save config to localStorage', () => {
      const config = { test: 'value' };
      saveConfig(config);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'boardgame_config',
        JSON.stringify(config)
      );
    });

    it('should handle complex config objects', () => {
      const config = {
        graphics: { quality: 'low' },
        audio: { master: 100 }
      };
      saveConfig(config);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'boardgame_config',
        JSON.stringify(config)
      );
    });

    it('should handle localStorage errors gracefully', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage full');
      });

      expect(() => saveConfig({ test: 'value' })).not.toThrow();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('loadConfig', () => {
    it('should return default config when localStorage is empty', () => {
      const config = loadConfig();

      expect(config).toHaveProperty('graphics');
      expect(config).toHaveProperty('audio');
      expect(config).toHaveProperty('game');
    });

    it('should load and shallow merge with defaults', () => {
      // Note: loadConfig uses shallow merge, so nested objects are replaced entirely
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
        audio: { master: 100, sfx: 100, music: 100 }
      }));

      const config = loadConfig();

      expect(config.audio.master).toBe(100); // from saved
      expect(config.graphics.resolution).toBe('auto'); // from defaults (graphics not in saved)
    });

    it('should preserve saved nested objects', () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
        graphics: { quality: 'low', resolution: '720p', fullscreen: true }
      }));

      const config = loadConfig();

      expect(config.graphics.quality).toBe('low');
      expect(config.graphics.resolution).toBe('720p');
      expect(config.audio.master).toBe(80); // from defaults
    });

    it('should handle invalid JSON gracefully', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json {{{');

      const config = loadConfig();

      expect(config).toHaveProperty('graphics');
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle localStorage errors gracefully', () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('Access denied');
      });

      const config = loadConfig();

      expect(config).toHaveProperty('graphics');
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('updateConfig', () => {
    it('should update specific config values', () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
        graphics: { quality: 'high' }
      }));

      const result = updateConfig({ graphics: { quality: 'low' } });

      expect(result.graphics.quality).toBe('low');
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should deep merge nested objects', () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
        graphics: { quality: 'high', resolution: '1080p' }
      }));

      const result = updateConfig({ graphics: { quality: 'low' } });

      expect(result.graphics.quality).toBe('low');
      expect(result.graphics.resolution).toBe('1080p');
    });

    it('should preserve unrelated config sections', () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
        graphics: { quality: 'high' },
        audio: { master: 50 }
      }));

      const result = updateConfig({ graphics: { quality: 'low' } });

      expect(result.audio.master).toBe(50);
    });

    it('should handle array values', () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({}));

      const result = updateConfig({ custom: { items: [1, 2, 3] } });

      expect(result.custom.items).toEqual([1, 2, 3]);
    });
  });

  describe('saveSessionData', () => {
    it('should save data to sessionStorage', () => {
      saveSessionData('testKey', { value: 123 });

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'testKey',
        JSON.stringify({ value: 123 })
      );
    });

    it('should handle string values', () => {
      saveSessionData('key', 'stringValue');

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'key',
        JSON.stringify('stringValue')
      );
    });

    it('should handle array values', () => {
      saveSessionData('arr', [1, 2, 3]);

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'arr',
        JSON.stringify([1, 2, 3])
      );
    });

    it('should handle sessionStorage errors gracefully', () => {
      mockSessionStorage.setItem.mockImplementation(() => {
        throw new Error('Storage full');
      });

      expect(() => saveSessionData('key', 'value')).not.toThrow();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('loadSessionData', () => {
    it('should load data from sessionStorage', () => {
      mockSessionStorage.getItem.mockReturnValue(JSON.stringify({ value: 123 }));

      const result = loadSessionData('testKey');

      expect(result).toEqual({ value: 123 });
    });

    it('should return null for missing key', () => {
      mockSessionStorage.getItem.mockReturnValue(null);

      const result = loadSessionData('missing');

      expect(result).toBeNull();
    });

    it('should handle invalid JSON gracefully', () => {
      mockSessionStorage.getItem.mockReturnValue('invalid json');

      const result = loadSessionData('key');

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle sessionStorage errors gracefully', () => {
      mockSessionStorage.getItem.mockImplementation(() => {
        throw new Error('Access denied');
      });

      const result = loadSessionData('key');

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('clearSessionData', () => {
    it('should clear specific key when provided', () => {
      clearSessionData('testKey');

      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('testKey');
      expect(mockSessionStorage.clear).not.toHaveBeenCalled();
    });

    it('should clear all when no key provided', () => {
      clearSessionData();

      expect(mockSessionStorage.clear).toHaveBeenCalled();
      expect(mockSessionStorage.removeItem).not.toHaveBeenCalled();
    });

    it('should clear all when key is undefined', () => {
      clearSessionData(undefined);

      expect(mockSessionStorage.clear).toHaveBeenCalled();
    });

    it('should clear all when key is null', () => {
      clearSessionData(null);

      expect(mockSessionStorage.clear).toHaveBeenCalled();
    });
  });

  describe('room create preset', () => {
    it('should save room-create preset by key', () => {
      const preset = {
        settings: { stackDrawCards: true },
        maxPlayers: 6,
        serverUrl: 'ws://localhost:7777'
      };

      saveRoomCreatePreset('local:uno', preset);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'boardgame_room_create_presets',
        JSON.stringify({ 'local:uno': preset })
      );
    });

    it('should merge with existing presets when saving', () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
        'local:uno': { maxPlayers: 4 }
      }));

      saveRoomCreatePreset('cloud:werewolf', { maxPlayers: 12 });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'boardgame_room_create_presets',
        JSON.stringify({
          'local:uno': { maxPlayers: 4 },
          'cloud:werewolf': { maxPlayers: 12 }
        })
      );
    });

    it('should load room-create preset by key', () => {
      const preset = { settings: { discussionTime: 180 }, maxPlayers: 9 };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
        'local:werewolf': preset
      }));

      const result = loadRoomCreatePreset('local:werewolf');
      expect(result).toEqual(preset);
    });

    it('should return null when preset key does not exist', () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify({
        'local:uno': { maxPlayers: 4 }
      }));

      const result = loadRoomCreatePreset('local:werewolf');
      expect(result).toBeNull();
    });

    it('should handle invalid preset JSON gracefully', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');

      const result = loadRoomCreatePreset('local:uno');
      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('importConfig', () => {
    let MockFileReader;
    let originalFileReader;

    beforeEach(() => {
      originalFileReader = globalThis.FileReader;

      MockFileReader = vi.fn().mockImplementation(() => {
        const instance = {
          onload: null,
          onerror: null,
          result: null,
          readAsText: vi.fn(function(file) {
            // Simulate async file read
            setTimeout(() => {
              if (file._shouldError) {
                this.onerror?.();
              } else {
                this.result = file._content;
                this.onload?.({ target: { result: file._content } });
              }
            }, 0);
          })
        };
        // Bind readAsText to instance
        instance.readAsText = instance.readAsText.bind(instance);
        return instance;
      });

      globalThis.FileReader = MockFileReader;
    });

    afterEach(() => {
      globalThis.FileReader = originalFileReader;
    });

    // Helper to create mock file
    const createMockFile = (content, shouldError = false) => ({
      _content: content,
      _shouldError: shouldError
    });

    it('should import config from valid JSON file', async () => {
      const file = createMockFile(JSON.stringify({ graphics: { quality: 'low' } }));

      const result = await importConfig(file);

      expect(result.graphics.quality).toBe('low');
      expect(result.audio).toBeDefined(); // merged with defaults
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should merge imported config with defaults', async () => {
      const file = createMockFile(JSON.stringify({ custom: 'value' }));

      const result = await importConfig(file);

      expect(result.custom).toBe('value');
      expect(result.graphics.resolution).toBe('auto');
      expect(result.audio.master).toBe(80);
    });

    it('should reject invalid JSON file', async () => {
      const file = createMockFile('invalid json');

      await expect(importConfig(file)).rejects.toThrow('Invalid config file');
    });

    it('should handle empty file', async () => {
      const file = createMockFile('{}');

      const result = await importConfig(file);

      expect(result.graphics).toBeDefined();
      expect(result.audio).toBeDefined();
    });

    it('should reject on file read error', async () => {
      const file = createMockFile('', true);

      await expect(importConfig(file)).rejects.toThrow('Failed to read file');
    });
  });
});
