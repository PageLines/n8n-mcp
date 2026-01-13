/**
 * MCP Tool Definitions
 * Minimal, focused toolset for workflow management
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export const tools: Tool[] = [
  // ─────────────────────────────────────────────────────────────
  // Workflow Operations
  // ─────────────────────────────────────────────────────────────
  {
    name: 'workflow_list',
    description: 'List all workflows. Returns id, name, active status.',
    inputSchema: {
      type: 'object',
      properties: {
        active: {
          type: 'boolean',
          description: 'Filter by active status',
        },
        limit: {
          type: 'number',
          description: 'Max results (default 100)',
        },
      },
    },
  },

  {
    name: 'workflow_get',
    description: 'Get a workflow by ID. Returns full workflow with nodes, connections, settings.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Workflow ID',
        },
      },
      required: ['id'],
    },
  },

  {
    name: 'workflow_create',
    description: 'Create a new workflow. Returns the created workflow.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Workflow name (use snake_case)',
        },
        nodes: {
          type: 'array',
          description: 'Array of node definitions',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string' },
              typeVersion: { type: 'number' },
              position: {
                type: 'array',
                items: { type: 'number' },
                minItems: 2,
                maxItems: 2,
              },
              parameters: { type: 'object' },
              credentials: { type: 'object' },
            },
            required: ['name', 'type', 'typeVersion', 'position', 'parameters'],
          },
        },
        connections: {
          type: 'object',
          description: 'Connection map: { "NodeName": { "main": [[{ "node": "TargetNode", "type": "main", "index": 0 }]] } }',
        },
        settings: {
          type: 'object',
          description: 'Workflow settings',
        },
      },
      required: ['name', 'nodes', 'connections'],
    },
  },

  {
    name: 'workflow_update',
    description: `Update a workflow using patch operations. ALWAYS preserves existing data.

Operations:
- addNode: Add a new node
- removeNode: Remove a node and its connections
- updateNode: Update node properties (INCLUDE ALL existing parameters to preserve them)
- addConnection: Connect two nodes
- removeConnection: Disconnect two nodes
- updateSettings: Update workflow settings
- updateName: Rename the workflow

Example: { "operations": [{ "type": "updateNode", "nodeName": "my_node", "properties": { "parameters": { ...allExistingParams, "newParam": "value" } } }] }`,
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Workflow ID',
        },
        operations: {
          type: 'array',
          description: 'Array of patch operations',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['addNode', 'removeNode', 'updateNode', 'addConnection', 'removeConnection', 'updateSettings', 'updateName'],
              },
              // For addNode
              node: { type: 'object' },
              // For removeNode, updateNode
              nodeName: { type: 'string' },
              // For updateNode
              properties: { type: 'object' },
              // For connections
              from: { type: 'string' },
              to: { type: 'string' },
              fromOutput: { type: 'number' },
              toInput: { type: 'number' },
              outputType: { type: 'string' },
              inputType: { type: 'string' },
              // For updateSettings
              settings: { type: 'object' },
              // For updateName
              name: { type: 'string' },
            },
            required: ['type'],
          },
        },
      },
      required: ['id', 'operations'],
    },
  },

  {
    name: 'workflow_delete',
    description: 'Delete a workflow permanently.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Workflow ID',
        },
      },
      required: ['id'],
    },
  },

  {
    name: 'workflow_activate',
    description: 'Activate a workflow (enable triggers).',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Workflow ID',
        },
      },
      required: ['id'],
    },
  },

  {
    name: 'workflow_deactivate',
    description: 'Deactivate a workflow (disable triggers).',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Workflow ID',
        },
      },
      required: ['id'],
    },
  },

  {
    name: 'workflow_execute',
    description: 'Execute a workflow via its webhook trigger. Workflow must have a webhook node.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Workflow ID',
        },
        data: {
          type: 'object',
          description: 'Data to send to the webhook',
        },
      },
      required: ['id'],
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Execution Operations
  // ─────────────────────────────────────────────────────────────
  {
    name: 'execution_list',
    description: 'List workflow executions. Filter by workflow or status.',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: 'Filter by workflow ID',
        },
        status: {
          type: 'string',
          enum: ['success', 'error', 'waiting'],
          description: 'Filter by status',
        },
        limit: {
          type: 'number',
          description: 'Max results (default 20)',
        },
      },
    },
  },

  {
    name: 'execution_get',
    description: 'Get execution details including run data and errors.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Execution ID',
        },
      },
      required: ['id'],
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Validation
  // ─────────────────────────────────────────────────────────────
  {
    name: 'workflow_validate',
    description: `Validate a workflow against best practices:
- snake_case naming
- Explicit node references (no $json)
- No hardcoded IDs
- No hardcoded secrets
- No orphan nodes`,
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Workflow ID to validate',
        },
      },
      required: ['id'],
    },
  },
];
