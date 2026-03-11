/**
 * Rules loader tests
 */

import { jest } from '@jest/globals';
import path from 'path';

const {
  parseMarkdownToChunks,
  extractKeywords,
  estimateTokens,
  retrieveChunks,
  loadAllRules,
  getLoadedGames,
  formatChunksForPrompt,
  _resetIndex,
  _getDocsBasePath,
} = await import('../../services/rules-loader.js');

describe('rules-loader', () => {
  afterEach(() => {
    _resetIndex();
  });

  // ── estimateTokens ──

  describe('estimateTokens', () => {
    it('returns 0 for empty or null input', () => {
      expect(estimateTokens('')).toBe(0);
      expect(estimateTokens(null)).toBe(0);
      expect(estimateTokens(undefined)).toBe(0);
    });

    it('estimates tokens as ceil(length / 2)', () => {
      expect(estimateTokens('ab')).toBe(1);
      expect(estimateTokens('abc')).toBe(2);
      expect(estimateTokens('预言家')).toBe(2); // 3 chars → 2
    });
  });

  // ── extractKeywords ──

  describe('extractKeywords', () => {
    it('returns empty array for empty input', () => {
      expect(extractKeywords('')).toEqual([]);
      expect(extractKeywords(null)).toEqual([]);
    });

    it('extracts Chinese terms (2+ chars)', () => {
      const kws = extractKeywords('预言家在夜晚查验一名玩家');
      expect(kws).toContain('预言家');
      expect(kws).toContain('夜晚');
      expect(kws).toContain('查验');
      expect(kws).toContain('玩家');
    });

    it('filters Chinese stop words', () => {
      const kws = extractKeywords('这是一个测试');
      expect(kws).not.toContain('这是');
      expect(kws).toContain('测试');
    });

    it('extracts English identifiers', () => {
      const kws = extractKeywords('NIGHT_WOLF_KILL action seer check');
      expect(kws).toContain('night_wolf_kill');
      expect(kws).toContain('action');
      expect(kws).toContain('seer');
      expect(kws).toContain('check');
    });

    it('extracts camelCase identifiers', () => {
      const kws = extractKeywords('use targetId and playerId');
      // camelCase words are lowercased
      const hasTarget = kws.some(k => k.includes('target'));
      const hasPlayer = kws.some(k => k.includes('player'));
      expect(hasTarget).toBe(true);
      expect(hasPlayer).toBe(true);
    });

    it('filters English stop words', () => {
      const kws = extractKeywords('the seer is a role');
      expect(kws).not.toContain('the');
      expect(kws).not.toContain('is');
      expect(kws).toContain('seer');
      expect(kws).toContain('role');
    });

    it('deduplicates keywords', () => {
      const kws = extractKeywords('seer seer seer');
      const seerCount = kws.filter(k => k === 'seer').length;
      expect(seerCount).toBe(1);
    });
  });

  // ── parseMarkdownToChunks ──

  describe('parseMarkdownToChunks', () => {
    const baseMeta = {
      gameId: 'test',
      type: 'rule',
      sourceFile: 'test/RULES.md',
    };

    it('returns empty array for empty input', () => {
      expect(parseMarkdownToChunks('', baseMeta)).toEqual([]);
      expect(parseMarkdownToChunks(null, baseMeta)).toEqual([]);
    });

    it('splits on ## headings', () => {
      const md = [
        '# Title',
        'intro text',
        '## Section One',
        'content one',
        '## Section Two',
        'content two',
      ].join('\n');

      const chunks = parseMarkdownToChunks(md, baseMeta);
      expect(chunks.length).toBe(3); // intro + section 1 + section 2
      expect(chunks[1].sectionTitle).toBe('Section One');
      expect(chunks[1].content).toContain('content one');
      expect(chunks[2].sectionTitle).toBe('Section Two');
    });

    it('does not split on ## inside code fences', () => {
      const md = [
        '## Real Section',
        'some text',
        '```javascript',
        '// ## Not A Heading',
        'const x = 1;',
        '```',
        'more text',
      ].join('\n');

      const chunks = parseMarkdownToChunks(md, baseMeta);
      expect(chunks.length).toBe(1);
      expect(chunks[0].sectionTitle).toBe('Real Section');
      expect(chunks[0].content).toContain('## Not A Heading');
    });

    it('creates a single chunk for docs without ## headings', () => {
      const md = '# Title\nSome content\n### Sub heading\nMore content';
      const chunks = parseMarkdownToChunks(md, baseMeta);
      expect(chunks.length).toBe(1);
    });

    it('sub-splits large sections on ### headings', () => {
      // Create a section with >800 token estimate (>1600 chars)
      const longContent = 'A'.repeat(1800);
      const md = [
        '## Big Section',
        '### Sub A',
        longContent.slice(0, 600),
        '### Sub B',
        longContent.slice(600, 1200),
        '### Sub C',
        longContent.slice(1200),
      ].join('\n');

      const chunks = parseMarkdownToChunks(md, baseMeta);
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].sectionTitle).toContain('Big Section');
      expect(chunks[1].sectionTitle).toContain('Sub B');
    });

    it('attaches roleId to chunks from role metadata', () => {
      const md = '## Core Rules\nSeer checks at night';
      const chunks = parseMarkdownToChunks(md, {
        ...baseMeta,
        type: 'role',
        roleId: 'seer',
      });
      expect(chunks[0].roleId).toBe('seer');
      expect(chunks[0].type).toBe('role');
    });

    it('attaches mechanismId to chunks from mechanism metadata', () => {
      const md = '## Captain Election\nVoting for captain';
      const chunks = parseMarkdownToChunks(md, {
        ...baseMeta,
        type: 'mechanism',
        mechanismId: 'captain',
      });
      expect(chunks[0].mechanismId).toBe('captain');
    });

    it('extracts keywords for each chunk', () => {
      const md = '## 预言家查验\n预言家在夜晚选择一名玩家查验';
      const chunks = parseMarkdownToChunks(md, baseMeta);
      expect(chunks[0].keywords).toContain('预言家');
      expect(chunks[0].keywords).toContain('查验');
    });

    it('includes token estimate on each chunk', () => {
      const md = '## Test\nSome content here';
      const chunks = parseMarkdownToChunks(md, baseMeta);
      expect(chunks[0].tokenEstimate).toBeGreaterThan(0);
    });
  });

  // ── retrieveChunks ──

  describe('retrieveChunks', () => {
    beforeEach(() => {
      // Manually load real rules for retrieval tests
      loadAllRules();
    });

    it('returns empty array when gameId is null', () => {
      expect(retrieveChunks('预言家', null)).toEqual([]);
    });

    it('returns empty array when gameId is not loaded', () => {
      expect(retrieveChunks('test query', 'nonexistent')).toEqual([]);
    });

    it('returns empty array when query has no keywords', () => {
      expect(retrieveChunks('', 'werewolf')).toEqual([]);
    });

    it('retrieves werewolf chunks for role-specific query', () => {
      const chunks = retrieveChunks('预言家怎么查验', 'werewolf');
      expect(chunks.length).toBeGreaterThan(0);
      // Should include seer-related chunks
      const hasSeerContent = chunks.some(
        c => c.content.includes('预言家') || c.content.includes('seer')
          || c.sectionTitle.includes('预言家') || c.roleId === 'seer'
      );
      expect(hasSeerContent).toBe(true);
    });

    it('gives role-type bonus for role-specific queries', () => {
      const chunks = retrieveChunks('seer check', 'werewolf');
      expect(chunks.length).toBeGreaterThan(0);
      // Seer role chunks should appear early (high score)
      const seerChunk = chunks.find(c => c.roleId === 'seer');
      if (seerChunk) {
        expect(chunks.indexOf(seerChunk)).toBeLessThan(3);
      }
    });

    it('respects token budget', () => {
      const smallBudget = 200;
      const chunks = retrieveChunks('狼人杀规则', 'werewolf', smallBudget);
      const totalTokens = chunks.reduce(
        (sum, c) => sum + c.tokenEstimate, 0
      );
      expect(totalTokens).toBeLessThanOrEqual(smallBudget);
    });

    it('retrieves UNO chunks for UNO queries', () => {
      const chunks = retrieveChunks('万能牌出牌规则', 'uno');
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('retrieves mechanism chunks for mechanism queries', () => {
      const chunks = retrieveChunks('captain 警长', 'werewolf');
      const hasMechChunk = chunks.some(c => c.type === 'mechanism');
      expect(hasMechChunk).toBe(true);
    });
  });

  // ── loadAllRules / getLoadedGames ──

  describe('loadAllRules', () => {
    it('loads game rules from docs/games/', () => {
      loadAllRules();
      const games = getLoadedGames();
      expect(games.length).toBeGreaterThanOrEqual(2); // uno + werewolf
    });

    it('includes werewolf with chunks', () => {
      loadAllRules();
      const games = getLoadedGames();
      const werewolf = games.find(g => g.gameId === 'werewolf');
      expect(werewolf).toBeDefined();
      expect(werewolf.chunkCount).toBeGreaterThan(10);
      expect(werewolf.totalTokens).toBeGreaterThan(0);
    });

    it('includes UNO with chunks', () => {
      loadAllRules();
      const games = getLoadedGames();
      const uno = games.find(g => g.gameId === 'uno');
      expect(uno).toBeDefined();
      expect(uno.chunkCount).toBeGreaterThan(0);
    });

    it('extracts game names from document titles', () => {
      loadAllRules();
      const games = getLoadedGames();
      const werewolf = games.find(g => g.gameId === 'werewolf');
      expect(werewolf.gameName).toContain('狼人杀');
    });
  });

  describe('getLoadedGames', () => {
    it('returns empty array before loading', () => {
      expect(getLoadedGames()).toEqual([]);
    });

    it('returns correct structure after loading', () => {
      loadAllRules();
      const games = getLoadedGames();
      for (const game of games) {
        expect(game).toHaveProperty('gameId');
        expect(game).toHaveProperty('gameName');
        expect(game).toHaveProperty('chunkCount');
        expect(game).toHaveProperty('totalTokens');
      }
    });
  });

  // ── formatChunksForPrompt ──

  describe('formatChunksForPrompt', () => {
    it('returns empty string for empty input', () => {
      expect(formatChunksForPrompt([])).toBe('');
      expect(formatChunksForPrompt(null)).toBe('');
    });

    it('formats chunks with section titles and source', () => {
      const chunks = [
        {
          sectionTitle: '查验规则',
          content: '预言家每夜查验一名玩家',
          roleId: 'seer',
        },
      ];
      const result = formatChunksForPrompt(chunks);
      expect(result).toContain('### 查验规则');
      expect(result).toContain('角色: seer');
      expect(result).toContain('预言家每夜查验一名玩家');
    });

    it('formats mechanism chunks correctly', () => {
      const chunks = [
        {
          sectionTitle: '警长选举',
          content: '投票选举警长',
          mechanismId: 'captain',
        },
      ];
      const result = formatChunksForPrompt(chunks);
      expect(result).toContain('机制: captain');
    });

    it('formats rule chunks with generic source label', () => {
      const chunks = [
        {
          sectionTitle: '游戏概述',
          content: '这是一个社交推理游戏',
        },
      ];
      const result = formatChunksForPrompt(chunks);
      expect(result).toContain('规则文档');
    });

    it('separates multiple chunks with dividers', () => {
      const chunks = [
        { sectionTitle: 'A', content: 'aaa' },
        { sectionTitle: 'B', content: 'bbb' },
      ];
      const result = formatChunksForPrompt(chunks);
      expect(result).toContain('---');
    });
  });
});
