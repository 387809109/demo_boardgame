#!/usr/bin/env node

/**
 * Board Game MCP Server — HTTP (Streamable HTTP) transport
 * Remote-accessible MCP server for multi-client / deployment scenarios.
 *
 * Usage:
 *   node server-http.js              # default port 3100
 *   MCP_PORT=8080 node server-http.js # custom port
 *
 * Client connection:
 *   claude mcp add boardgame-remote --transport http http://localhost:3100/mcp
 *
 * @module mcp/server-http
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { randomUUID } from 'crypto';
import { loadAllRules } from './lib/rules-loader.js';
import { registerGetGameRules } from './tools/get-game-rules.js';
import { registerQueryPokemon } from './tools/query-pokemon.js';

const PORT = process.env.MCP_PORT || 3100;

// Load game rule documents at startup
loadAllRules();

/** @type {Map<string, StreamableHTTPServerTransport>} */
const sessions = new Map();

/**
 * Create a new McpServer + transport pair for a session
 * @returns {{ server: McpServer, transport: StreamableHTTPServerTransport }}
 */
function createSessionServer() {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (id) => {
      sessions.set(id, transport);
      console.log(`Session created: ${id} (active: ${sessions.size})`);
    },
  });

  const server = new McpServer({
    name: 'boardgame-mcp',
    version: '1.0.0',
  });

  registerGetGameRules(server);
  registerQueryPokemon(server);

  return { server, transport };
}

const app = express();
app.use(express.json());

// POST /mcp — client requests (including initialize)
app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];

  if (sessionId && sessions.has(sessionId)) {
    const transport = sessions.get(sessionId);
    await transport.handleRequest(req, res, req.body);
    return;
  }

  // New session
  const { server, transport } = createSessionServer();
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// GET /mcp — SSE stream (server-to-client push)
app.get('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).json({ error: 'Invalid or missing session ID' });
    return;
  }
  await sessions.get(sessionId).handleRequest(req, res);
});

// DELETE /mcp — close session
app.delete('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  if (sessionId && sessions.has(sessionId)) {
    const transport = sessions.get(sessionId);
    await transport.close();
    sessions.delete(sessionId);
    console.log(`Session closed: ${sessionId} (active: ${sessions.size})`);
  }
  res.status(200).end();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', sessions: sessions.size });
});

app.listen(PORT, () => {
  console.log(`boardgame-mcp HTTP server listening on port ${PORT}`);
});
