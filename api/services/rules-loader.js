/**
 * Rules loader — loads, chunks, and retrieves game rule documents
 * for RAG-lite context injection into AI chat
 * @module services/rules-loader
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as logger from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_BASE = path.resolve(__dirname, '..', '..', 'docs', 'games');

/**
 * @typedef {Object} RuleChunk
 * @property {string} id - Unique chunk ID
 * @property {string} gameId - Game identifier
 * @property {string} type - 'rule' | 'role' | 'mechanism'
 * @property {string} sourceFile - Relative path to source file
 * @property {string} sectionTitle - The heading text
 * @property {string[]} keywords - Extracted keywords for matching
 * @property {string} content - The markdown text of this section
 * @property {number} tokenEstimate - Approximate token count
 * @property {string} [roleId] - Role ID if type === 'role'
 * @property {string} [mechanismId] - Mechanism ID if type === 'mechanism'
 */

/**
 * @typedef {Object} GameRuleIndex
 * @property {string} gameId
 * @property {string} gameName
 * @property {RuleChunk[]} chunks
 * @property {number} totalTokens
 */

/** @type {Map<string, GameRuleIndex>} */
const gameRulesIndex = new Map();

/** Max token estimate before sub-splitting a section */
const SUB_SPLIT_THRESHOLD = 800;

/** Chinese stop words to exclude from keyword extraction */
const CHINESE_STOP_WORDS = new Set([
  '的', '了', '是', '在', '和', '与', '或', '不', '也', '都',
  '有', '被', '把', '对', '从', '到', '为', '上', '下', '中',
  '个', '这', '那', '一', '二', '三', '会', '可以', '可', '能',
  '将', '要', '就', '还', '而', '但', '如果', '则', '所', '以',
  '等', '及', '每', '当', '该', '其', '之', '以', '于', '后',
  '前', '内', '外', '时', '中', '只', '需', '让', '使', '并',
  '这是', '这个', '那个', '一个', '不是', '没有', '已经', '可能',
]);

/** English stop words */
const ENGLISH_STOP_WORDS = new Set([
  'the', 'is', 'a', 'an', 'of', 'in', 'to', 'and', 'or', 'for',
  'on', 'at', 'by', 'with', 'as', 'if', 'it', 'no', 'not', 'be',
  'are', 'was', 'this', 'that', 'from', 'true', 'false', 'null',
]);

/**
 * Estimate token count for mixed Chinese/English text
 * ~2 chars per token for Chinese, ~4 chars per token for English
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 2);
}

/**
 * Extract keywords from text for matching
 * @param {string} text
 * @returns {string[]}
 */
export function extractKeywords(text) {
  if (!text || typeof text !== 'string') return [];

  const keywords = new Set();

  // Extract Chinese terms: continuous runs, then generate 2-3 char n-grams
  const chineseRuns = text.match(/[\u4e00-\u9fff]{2,}/g) || [];
  for (const run of chineseRuns) {
    // Add the full run if not a stop word
    if (!CHINESE_STOP_WORDS.has(run)) {
      keywords.add(run);
    }
    // Generate 2-char and 3-char n-grams for sub-word matching
    for (let len = 2; len <= Math.min(3, run.length); len++) {
      for (let i = 0; i <= run.length - len; i++) {
        const ngram = run.slice(i, i + len);
        if (!CHINESE_STOP_WORDS.has(ngram)) {
          keywords.add(ngram);
        }
      }
    }
  }

  // Extract English identifiers:
  // - UPPER_SNAKE_CASE (e.g. NIGHT_WOLF_KILL)
  // - camelCase / PascalCase (full word)
  // - lowercase words (3+ chars)
  const englishMatches = text.match(
    /[A-Z]+(?:_[A-Z]+)+|[A-Z][a-zA-Z]*|[a-z_]{3,}/g
  ) || [];
  for (const term of englishMatches) {
    const lower = term.toLowerCase();
    if (!ENGLISH_STOP_WORDS.has(lower)) {
      keywords.add(lower);
    }
  }

  return [...keywords];
}

/**
 * Parse markdown text into chunks, splitting on ## headings
 * Sub-splits large sections on ### headings
 * Respects code fence boundaries
 * @param {string} text - Raw markdown content
 * @param {Object} baseMetadata - Metadata to attach to each chunk
 * @param {string} baseMetadata.gameId
 * @param {string} baseMetadata.type - 'rule' | 'role' | 'mechanism'
 * @param {string} baseMetadata.sourceFile
 * @param {string} [baseMetadata.roleId]
 * @param {string} [baseMetadata.mechanismId]
 * @returns {RuleChunk[]}
 */
export function parseMarkdownToChunks(text, baseMetadata) {
  if (!text || typeof text !== 'string') return [];

  const lines = text.split('\n');
  const sections = [];
  let currentTitle = baseMetadata.sourceFile || 'untitled';
  let currentLines = [];
  let inCodeFence = false;

  for (const line of lines) {
    // Track code fence state
    if (line.trimStart().startsWith('```')) {
      inCodeFence = !inCodeFence;
    }

    // Split on ## headings (not inside code fences)
    if (!inCodeFence && /^## /.test(line)) {
      if (currentLines.length > 0) {
        sections.push({ title: currentTitle, content: currentLines.join('\n') });
      }
      currentTitle = line.replace(/^##\s+/, '').trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  // Push last section
  if (currentLines.length > 0) {
    sections.push({ title: currentTitle, content: currentLines.join('\n') });
  }

  // Build chunks, sub-splitting large sections
  const chunks = [];
  for (const section of sections) {
    const estimate = estimateTokens(section.content);

    if (estimate > SUB_SPLIT_THRESHOLD) {
      const subChunks = subSplitSection(section, baseMetadata);
      chunks.push(...subChunks);
    } else {
      const id = buildChunkId(baseMetadata, section.title, chunks.length);
      chunks.push({
        id,
        gameId: baseMetadata.gameId,
        type: baseMetadata.type,
        sourceFile: baseMetadata.sourceFile,
        sectionTitle: section.title,
        keywords: extractKeywords(section.title + ' ' + section.content),
        content: section.content.trim(),
        tokenEstimate: estimate,
        ...(baseMetadata.roleId && { roleId: baseMetadata.roleId }),
        ...(baseMetadata.mechanismId && {
          mechanismId: baseMetadata.mechanismId,
        }),
      });
    }
  }

  return chunks;
}

/**
 * Sub-split a large section on ### headings
 * @param {Object} section - { title, content }
 * @param {Object} baseMetadata
 * @returns {RuleChunk[]}
 */
function subSplitSection(section, baseMetadata) {
  const lines = section.content.split('\n');
  const subSections = [];
  let subTitle = section.title;
  let subLines = [];
  let inCodeFence = false;

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      inCodeFence = !inCodeFence;
    }

    if (!inCodeFence && /^### /.test(line)) {
      if (subLines.length > 0) {
        subSections.push({
          title: subTitle,
          content: subLines.join('\n'),
        });
      }
      subTitle = section.title + ' > ' + line.replace(/^###\s+/, '').trim();
      subLines = [];
    } else {
      subLines.push(line);
    }
  }

  if (subLines.length > 0) {
    subSections.push({ title: subTitle, content: subLines.join('\n') });
  }

  return subSections.map((sub, idx) => {
    const content = sub.content.trim();
    return {
      id: buildChunkId(baseMetadata, sub.title, idx),
      gameId: baseMetadata.gameId,
      type: baseMetadata.type,
      sourceFile: baseMetadata.sourceFile,
      sectionTitle: sub.title,
      keywords: extractKeywords(sub.title + ' ' + content),
      content,
      tokenEstimate: estimateTokens(content),
      ...(baseMetadata.roleId && { roleId: baseMetadata.roleId }),
      ...(baseMetadata.mechanismId && {
        mechanismId: baseMetadata.mechanismId,
      }),
    };
  });
}

/**
 * Build a unique chunk ID
 * @param {Object} metadata
 * @param {string} title
 * @param {number} idx
 * @returns {string}
 */
function buildChunkId(metadata, title, idx) {
  const slug = title
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
  const prefix = metadata.roleId || metadata.mechanismId || 'main';
  return `${metadata.gameId}:${metadata.type}:${prefix}:${slug}_${idx}`;
}

/**
 * Load all game rules from docs/games/
 * Scans for RULES.md, roles/*.md, mechanisms/*.md
 */
export function loadAllRules() {
  gameRulesIndex.clear();

  let gameDirs;
  try {
    gameDirs = fs.readdirSync(DOCS_BASE, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
  } catch (err) {
    logger.error('Failed to read docs/games directory', {
      path: DOCS_BASE,
      error: err.message,
    });
    return;
  }

  for (const gameId of gameDirs) {
    const gameDir = path.join(DOCS_BASE, gameId);
    const rulesPath = path.join(gameDir, 'RULES.md');

    if (!fs.existsSync(rulesPath)) continue;

    const chunks = [];

    // Load main RULES.md
    const rulesText = fs.readFileSync(rulesPath, 'utf-8');
    const gameName = extractGameName(rulesText, gameId);
    const ruleChunks = parseMarkdownToChunks(rulesText, {
      gameId,
      type: 'rule',
      sourceFile: `${gameId}/RULES.md`,
    });
    chunks.push(...ruleChunks);

    // Load roles/*.md
    const rolesDir = path.join(gameDir, 'roles');
    if (fs.existsSync(rolesDir)) {
      const roleFiles = fs.readdirSync(rolesDir)
        .filter(f => f.endsWith('.md'));
      for (const file of roleFiles) {
        const roleId = file.replace('.md', '');
        const roleText = fs.readFileSync(
          path.join(rolesDir, file), 'utf-8'
        );
        const roleChunks = parseMarkdownToChunks(roleText, {
          gameId,
          type: 'role',
          sourceFile: `${gameId}/roles/${file}`,
          roleId,
        });
        chunks.push(...roleChunks);
      }
    }

    // Load mechanisms/*.md
    const mechDir = path.join(gameDir, 'mechanisms');
    if (fs.existsSync(mechDir)) {
      const mechFiles = fs.readdirSync(mechDir)
        .filter(f => f.endsWith('.md'));
      for (const file of mechFiles) {
        const mechanismId = file.replace('.md', '');
        const mechText = fs.readFileSync(
          path.join(mechDir, file), 'utf-8'
        );
        const mechChunks = parseMarkdownToChunks(mechText, {
          gameId,
          type: 'mechanism',
          sourceFile: `${gameId}/mechanisms/${file}`,
          mechanismId,
        });
        chunks.push(...mechChunks);
      }
    }

    const totalTokens = chunks.reduce((sum, c) => sum + c.tokenEstimate, 0);
    gameRulesIndex.set(gameId, { gameId, gameName, chunks, totalTokens });

    logger.info(`Loaded rules for "${gameName}"`, {
      gameId,
      chunks: chunks.length,
      totalTokens,
    });
  }

  logger.info(`Rules loader ready: ${gameRulesIndex.size} game(s) loaded`);
}

/**
 * Extract game name from RULES.md title line
 * @param {string} text
 * @param {string} fallback
 * @returns {string}
 */
function extractGameName(text, fallback) {
  const match = text.match(/^#\s+(.+)/m);
  if (match) {
    // Clean title: remove suffixes like " - AI Coding 参考文档"
    return match[1].replace(/\s*[-—].*$/, '').trim();
  }
  return fallback;
}

/**
 * Retrieve the most relevant chunks for a query
 * @param {string} query - User's question
 * @param {string} gameId - Game to search in
 * @param {number} [tokenBudget=3500] - Max tokens for context
 * @returns {RuleChunk[]}
 */
export function retrieveChunks(query, gameId, tokenBudget = 3500) {
  if (!gameId || !gameRulesIndex.has(gameId)) return [];

  const index = gameRulesIndex.get(gameId);
  const queryKeywords = extractKeywords(query);
  const queryLower = query.toLowerCase();

  if (queryKeywords.length === 0) return [];

  // Score each chunk
  const scored = index.chunks.map(chunk => {
    let score = 0;

    for (const kw of queryKeywords) {
      const kwLower = kw.toLowerCase();

      // Heading match (weight 3)
      if (chunk.sectionTitle.toLowerCase().includes(kwLower)) {
        score += 3;
      }

      // Keyword match (weight 2)
      if (chunk.keywords.some(ck => ck.includes(kwLower) || kwLower.includes(ck))) {
        score += 2;
      }

      // Content match (weight 1)
      if (chunk.content.toLowerCase().includes(kwLower)) {
        score += 1;
      }
    }

    // Role-type bonus: if query mentions a role and chunk is that role's doc
    if (chunk.type === 'role' && chunk.roleId) {
      const roleNameInQuery = queryLower.includes(chunk.roleId);
      const roleKeywordsMatch = chunk.keywords.some(
        ck => queryLower.includes(ck)
      );
      if (roleNameInQuery || roleKeywordsMatch) {
        score += 5;
      }
    }

    // Mechanism bonus
    if (chunk.type === 'mechanism' && chunk.mechanismId) {
      if (queryLower.includes(chunk.mechanismId)) {
        score += 5;
      }
    }

    return { chunk, score };
  });

  // Sort by score descending, filter zero scores
  scored.sort((a, b) => b.score - a.score);
  const filtered = scored.filter(s => s.score > 0);

  // Greedy selection within token budget
  const selected = [];
  let usedTokens = 0;

  for (const { chunk } of filtered) {
    if (usedTokens + chunk.tokenEstimate > tokenBudget) continue;
    selected.push(chunk);
    usedTokens += chunk.tokenEstimate;
  }

  return selected;
}

/**
 * Get list of loaded games with stats
 * @returns {Array<{gameId: string, gameName: string, chunkCount: number, totalTokens: number}>}
 */
export function getLoadedGames() {
  return [...gameRulesIndex.values()].map(g => ({
    gameId: g.gameId,
    gameName: g.gameName,
    chunkCount: g.chunks.length,
    totalTokens: g.totalTokens,
  }));
}

/**
 * Format retrieved chunks for injection into system prompt
 * @param {RuleChunk[]} chunks
 * @returns {string}
 */
export function formatChunksForPrompt(chunks) {
  if (!chunks || chunks.length === 0) return '';

  return chunks.map(chunk => {
    const source = chunk.roleId
      ? `角色: ${chunk.roleId}`
      : chunk.mechanismId
        ? `机制: ${chunk.mechanismId}`
        : '规则文档';
    return `### ${chunk.sectionTitle} (${source})\n\n${chunk.content}`;
  }).join('\n\n---\n\n');
}

/**
 * Reset the index (for testing)
 */
export function _resetIndex() {
  gameRulesIndex.clear();
}

/**
 * Get the docs base path (for testing)
 * @returns {string}
 */
export function _getDocsBasePath() {
  return DOCS_BASE;
}
