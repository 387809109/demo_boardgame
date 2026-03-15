#!/usr/bin/env node

/**
 * Board Game MCP Server
 * Stdio-based MCP server providing game rule queries and external API tools.
 *
 * IMPORTANT: All logging MUST use console.error() — console.log() would
 * corrupt the stdio protocol stream used for MCP communication.
 *
 * @module mcp
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadAllRules } from './lib/rules-loader.js';
import { registerGetGameRules } from './tools/get-game-rules.js';
import { registerQueryPokemon } from './tools/query-pokemon.js';

// Load game rule documents at startup
loadAllRules();

// Create MCP server
const server = new McpServer({
  name: 'boardgame-mcp',
  version: '1.0.0',
});

// Register tools
registerGetGameRules(server);
registerQueryPokemon(server);

// Start stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);

console.error('boardgame-mcp server started');
