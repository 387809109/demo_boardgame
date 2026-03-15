/**
 * MCP tool: query_pokemon
 * Look up Pokemon data from PokeAPI (test tool for external API access)
 * @module tools/query-pokemon
 */

import { z } from 'zod';

const POKEAPI_BASE = 'https://pokeapi.co/api/v2';
const FETCH_TIMEOUT_MS = 10000;

/**
 * Register the query_pokemon tool on the MCP server
 * @param {import('@modelcontextprotocol/sdk/server/mcp.js').McpServer} server
 */
export function registerQueryPokemon(server) {
  server.tool(
    'query_pokemon',
    'Look up Pokemon data from PokeAPI. ' +
    'Fetch basic info, stats, abilities, types, and moves for any Pokemon.',
    {
      name: z.string()
        .describe('Pokemon name or Pokedex ID (e.g. "pikachu", "25")'),
      fields: z.array(
        z.enum(['basic', 'stats', 'abilities', 'types', 'moves'])
      ).optional()
        .default(['basic'])
        .describe('Which data fields to include in the response'),
    },
    async ({ name, fields }) => {
      const pokemonName = name.toLowerCase().trim();

      let data;
      try {
        const response = await fetch(
          `${POKEAPI_BASE}/pokemon/${encodeURIComponent(pokemonName)}`,
          { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
        );

        if (response.status === 404) {
          return {
            content: [{
              type: 'text',
              text: `Pokemon "${name}" not found. Check the name or ID and try again.`,
            }],
            isError: true,
          };
        }

        if (!response.ok) {
          return {
            content: [{
              type: 'text',
              text: `PokeAPI returned HTTP ${response.status}: ${response.statusText}`,
            }],
            isError: true,
          };
        }

        data = await response.json();
      } catch (err) {
        const message = err.name === 'TimeoutError'
          ? 'Request to PokeAPI timed out (10s).'
          : `Failed to reach PokeAPI: ${err.message}`;
        return {
          content: [{ type: 'text', text: message }],
          isError: true,
        };
      }

      const result = {};

      for (const field of fields) {
        switch (field) {
          case 'basic':
            result.basic = {
              name: data.name,
              id: data.id,
              height: data.height,
              weight: data.weight,
              base_experience: data.base_experience,
              sprite: data.sprites?.front_default || null,
            };
            break;

          case 'stats':
            result.stats = data.stats.map(s => ({
              name: s.stat.name,
              base_stat: s.base_stat,
              effort: s.effort,
            }));
            break;

          case 'abilities':
            result.abilities = data.abilities.map(a => ({
              name: a.ability.name,
              is_hidden: a.is_hidden,
            }));
            break;

          case 'types':
            result.types = data.types.map(t => t.type.name);
            break;

          case 'moves':
            result.moves = data.moves
              .slice(0, 20)
              .map(m => m.move.name);
            if (data.moves.length > 20) {
              result.moves_note = `Showing 20 of ${data.moves.length} moves`;
            }
            break;
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    }
  );
}
