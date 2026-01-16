#!/usr/bin/env node
/**
 * @pagelines/n8n-mcp
 * Opinionated MCP server for n8n workflow automation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { N8nClient } from './n8n-client.js';
import { tools } from './tools.js';
import { initVersionControl } from './versions.js';
import { stringifyResponse } from './response-format.js';
import { createHandlers, type HandlerName } from './handlers.js';

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

const N8N_API_URL = process.env.N8N_API_URL || process.env.N8N_HOST || '';
const N8N_API_KEY = process.env.N8N_API_KEY || '';

if (!N8N_API_URL || !N8N_API_KEY) {
  console.error('Error: N8N_API_URL and N8N_API_KEY environment variables are required');
  console.error('Set them in your MCP server configuration or environment');
  process.exit(1);
}

const client = new N8nClient({
  apiUrl: N8N_API_URL,
  apiKey: N8N_API_KEY,
});

const handlers = createHandlers(client);

// Initialize version control
initVersionControl({
  enabled: process.env.N8N_MCP_VERSIONS !== 'false',
  maxVersions: parseInt(process.env.N8N_MCP_MAX_VERSIONS || '20', 10),
});

// ─────────────────────────────────────────────────────────────
// MCP Server
// ─────────────────────────────────────────────────────────────

const server = new Server(
  {
    name: '@pagelines/n8n-mcp',
    version: '0.3.7',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const handler = handlers[name as HandlerName];
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }

    const result = await handler(args || {});
    return {
      content: [
        {
          type: 'text',
          text: typeof result === 'string' ? result : stringifyResponse(result),
        },
      ],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${message}`,
        },
      ],
      isError: true,
    };
  }
});

// ─────────────────────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('@pagelines/n8n-mcp server started');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
