/**
 * Card service tests
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
    eq: mockEq,
    single: mockSingle,
    order: mockOrder,
    or: mockOr
  });
  mockOr.mockReturnValue({ order: mockOrder });
  mockOrder.mockReturnValue({ range: mockRange });
  mockRange.mockReturnValue(finalResult);
  mockSingle.mockReturnValue(finalResult);
}

function setupInsertChain(finalResult) {
  mockInsert.mockReturnValue({ select: jest.fn().mockReturnValue({
    single: jest.fn().mockReturnValue(finalResult)
  }) });
}

const { listCategories, listCards, getCard } = await import(
  '../../services/card-service.js'
);

describe('card-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listCategories', () => {
    it('should return categories for a game', async () => {
      setupChain({
        data: [{ id: 'cat-1', name: 'action' }],
        error: null
      });
      // Override order to return the final result directly
      mockOrder.mockReturnValue({
        data: [{ id: 'cat-1', name: 'action' }],
        error: null
      });

      const result = await listCategories('uno');

      expect(result).toHaveLength(1);
      expect(mockFrom).toHaveBeenCalledWith('card_categories');
    });
  });

  describe('listCards', () => {
    it('should return cards with count', async () => {
      setupChain({
        data: [{ id: 'card-1', name: 'skip', card_categories: null }],
        error: null,
        count: 1
      });

      const result = await listCards('uno', { limit: 20, offset: 0 });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('getCard', () => {
    it('should return a card by ID', async () => {
      setupChain({
        data: { id: 'card-1', name: 'skip' },
        error: null
      });

      const result = await getCard('uno', 'card-1');

      expect(result.name).toBe('skip');
    });

    it('should throw NotFoundError for missing card', async () => {
      setupChain({ data: null, error: null });

      await expect(getCard('uno', 'missing'))
        .rejects.toThrow('not found');
    });
  });
});
