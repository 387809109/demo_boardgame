/**
 * Game service tests
 */

import { jest } from '@jest/globals';

// Mock Supabase before importing the service
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockOr = jest.fn();
const mockOrder = jest.fn();
const mockRange = jest.fn();
const mockSingle = jest.fn();

const mockFrom = jest.fn().mockReturnValue({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate
});

jest.unstable_mockModule('../../services/supabase.js', () => ({
  getSupabaseAdmin: jest.fn().mockReturnValue({ from: mockFrom })
}));

// Chain setup helper
function setupChain(finalResult) {
  mockSelect.mockReturnValue({
    eq: mockEq,
    or: mockOr,
    order: mockOrder,
    range: mockRange,
    single: mockSingle
  });
  mockEq.mockReturnValue({
    single: mockSingle,
    order: mockOrder,
    or: mockOr
  });
  mockOr.mockReturnValue({ order: mockOrder });
  mockOrder.mockReturnValue({ range: mockRange });
  mockRange.mockReturnValue(finalResult);
  mockSingle.mockReturnValue(finalResult);
}

const { listGames, getGame } = await import(
  '../../services/game-service.js'
);

describe('game-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listGames', () => {
    it('should return games with count', async () => {
      setupChain({
        data: [{ id: 'uno', name: 'UNO' }],
        error: null,
        count: 1
      });

      const result = await listGames({ limit: 20, offset: 0 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockFrom).toHaveBeenCalledWith('games');
    });

    it('should return empty array on no results', async () => {
      setupChain({ data: null, error: null, count: 0 });

      const result = await listGames();

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('getGame', () => {
    it('should return a game by ID', async () => {
      setupChain({ data: { id: 'uno', name: 'UNO' }, error: null });

      const result = await getGame('uno');

      expect(result.id).toBe('uno');
    });

    it('should throw NotFoundError for missing game', async () => {
      setupChain({ data: null, error: null });

      await expect(getGame('missing'))
        .rejects.toThrow('not found');
    });
  });
});
