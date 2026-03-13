/**
 * MCP tool: get_game_rules
 * Query board game rule documentation
 * @module tools/get-game-rules
 */

import { z } from 'zod';
import {
  getLoadedGames,
  getChunksByGame,
  retrieveChunks,
  formatChunksForPrompt,
} from '../lib/rules-loader.js';

/**
 * Register the get_game_rules tool on the MCP server
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 */
export function registerGetGameRules(server) {
  server.tool(
    'get_game_rules',
    'Retrieve board game rule documentation. ' +
    'Can list available games, fetch full rules/roles/mechanisms, ' +
    'or search rules by keyword.',
    {
      action: z.enum(['list_games', 'get_rules', 'search_rules'])
        .describe('Action to perform'),
      gameId: z.string().optional()
        .describe('Game identifier (e.g. "uno", "werewolf"). Required for get_rules and search_rules.'),
      query: z.string().optional()
        .describe('Search query for search_rules action (e.g. "seer night action", "wild card")'),
      category: z.enum(['all', 'rule', 'role', 'mechanism']).optional()
        .default('all')
        .describe('Filter by content category. Only used with get_rules.'),
      tokenBudget: z.number().optional()
        .default(3500)
        .describe('Max tokens for search_rules results'),
    },
    async ({ action, gameId, query, category, tokenBudget }) => {
      if (action === 'list_games') {
        const games = getLoadedGames();
        if (games.length === 0) {
          return {
            content: [{
              type: 'text',
              text: 'No games loaded. Check that docs/games/ contains rule documents.',
            }],
          };
        }
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(games, null, 2),
          }],
        };
      }

      if (!gameId) {
        return {
          content: [{
            type: 'text',
            text: 'Error: gameId is required for this action.',
          }],
          isError: true,
        };
      }

      if (action === 'get_rules') {
        const chunks = getChunksByGame(gameId, category);
        if (chunks.length === 0) {
          return {
            content: [{
              type: 'text',
              text: `No rules found for game "${gameId}" (category: ${category}).`,
            }],
          };
        }
        const formatted = formatChunksForPrompt(chunks);
        return {
          content: [{
            type: 'text',
            text: formatted,
          }],
        };
      }

      if (action === 'search_rules') {
        if (!query) {
          return {
            content: [{
              type: 'text',
              text: 'Error: query is required for search_rules action.',
            }],
            isError: true,
          };
        }
        const chunks = retrieveChunks(query, gameId, tokenBudget);
        if (chunks.length === 0) {
          return {
            content: [{
              type: 'text',
              text: `No matching rules found for query "${query}" in game "${gameId}".`,
            }],
          };
        }
        const formatted = formatChunksForPrompt(chunks);
        return {
          content: [{
            type: 'text',
            text: `Found ${chunks.length} relevant section(s):\n\n${formatted}`,
          }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: `Unknown action: ${action}`,
        }],
        isError: true,
      };
    }
  );
}
