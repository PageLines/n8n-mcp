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
import { validateWorkflow } from './validators.js';
import type { PatchOperation, N8nConnections } from './types.js';

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

// ─────────────────────────────────────────────────────────────
// MCP Server
// ─────────────────────────────────────────────────────────────

const server = new Server(
  {
    name: '@pagelines/n8n-mcp',
    version: '0.1.0',
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
    const result = await handleTool(name, args || {});
    return {
      content: [
        {
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
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
// Tool Handlers
// ─────────────────────────────────────────────────────────────

async function handleTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    // Workflow operations
    case 'workflow_list': {
      const response = await client.listWorkflows({
        active: args.active as boolean | undefined,
        limit: (args.limit as number) || 100,
      });
      return {
        workflows: response.data.map((w) => ({
          id: w.id,
          name: w.name,
          active: w.active,
          updatedAt: w.updatedAt,
        })),
        total: response.data.length,
      };
    }

    case 'workflow_get': {
      const workflow = await client.getWorkflow(args.id as string);
      return workflow;
    }

    case 'workflow_create': {
      const nodes = (args.nodes as Array<{
        name: string;
        type: string;
        typeVersion: number;
        position: [number, number];
        parameters: Record<string, unknown>;
        credentials?: Record<string, { id: string; name: string }>;
      }>).map((n, i) => ({
        id: crypto.randomUUID(),
        name: n.name,
        type: n.type,
        typeVersion: n.typeVersion,
        position: n.position || [250, 250 + i * 100],
        parameters: n.parameters || {},
        ...(n.credentials && { credentials: n.credentials }),
      }));

      const workflow = await client.createWorkflow({
        name: args.name as string,
        nodes,
        connections: (args.connections as N8nConnections) || {},
        settings: args.settings as Record<string, unknown>,
      });

      // Validate the new workflow
      const validation = validateWorkflow(workflow);

      return {
        workflow,
        validation,
      };
    }

    case 'workflow_update': {
      const operations = args.operations as PatchOperation[];
      const { workflow, warnings } = await client.patchWorkflow(
        args.id as string,
        operations
      );

      // Also run validation
      const validation = validateWorkflow(workflow);

      return {
        workflow,
        patchWarnings: warnings,
        validation,
      };
    }

    case 'workflow_delete': {
      await client.deleteWorkflow(args.id as string);
      return { success: true, message: `Workflow ${args.id} deleted` };
    }

    case 'workflow_activate': {
      const workflow = await client.activateWorkflow(args.id as string);
      return {
        id: workflow.id,
        name: workflow.name,
        active: workflow.active,
      };
    }

    case 'workflow_deactivate': {
      const workflow = await client.deactivateWorkflow(args.id as string);
      return {
        id: workflow.id,
        name: workflow.name,
        active: workflow.active,
      };
    }

    case 'workflow_execute': {
      const result = await client.executeWorkflow(
        args.id as string,
        args.data as Record<string, unknown>
      );
      return result;
    }

    // Execution operations
    case 'execution_list': {
      const response = await client.listExecutions({
        workflowId: args.workflowId as string | undefined,
        status: args.status as 'success' | 'error' | 'waiting' | undefined,
        limit: (args.limit as number) || 20,
      });
      return {
        executions: response.data,
        total: response.data.length,
      };
    }

    case 'execution_get': {
      const execution = await client.getExecution(args.id as string);
      return execution;
    }

    // Validation
    case 'workflow_validate': {
      const workflow = await client.getWorkflow(args.id as string);
      const validation = validateWorkflow(workflow);
      return {
        workflowId: workflow.id,
        workflowName: workflow.name,
        ...validation,
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

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
