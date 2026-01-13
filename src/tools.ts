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
    description: 'Get a workflow by ID. Use format=summary for minimal response, compact (default) for nodes without parameters, full for everything.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Workflow ID',
        },
        format: {
          type: 'string',
          enum: ['summary', 'compact', 'full'],
          description: 'Response detail level. summary=minimal, compact=nodes without params (default), full=everything',
        },
      },
      required: ['id'],
    },
  },

  {
    name: 'workflow_create',
    description: 'Create a new workflow. Returns the created workflow with validation.',
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
        format: {
          type: 'string',
          enum: ['summary', 'compact', 'full'],
          description: 'Response detail level (default: compact)',
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
        format: {
          type: 'string',
          enum: ['summary', 'compact', 'full'],
          description: 'Response detail level (default: compact)',
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
        format: {
          type: 'string',
          enum: ['summary', 'compact', 'full'],
          description: 'Response detail level (default: compact)',
        },
      },
    },
  },

  {
    name: 'execution_get',
    description: 'Get execution details. Use format=summary for status only, compact (default) omits runData, full for everything including runData.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Execution ID',
        },
        format: {
          type: 'string',
          enum: ['summary', 'compact', 'full'],
          description: 'Response detail level. summary=status only, compact=no runData (default), full=everything',
        },
      },
      required: ['id'],
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Validation & Quality
  // ─────────────────────────────────────────────────────────────
  {
    name: 'workflow_validate',
    description: `Validate a workflow against best practices:
- snake_case naming
- Explicit node references (no $json)
- No hardcoded IDs or secrets
- No orphan nodes
- AI node structured output
- Expression syntax validation`,
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

  {
    name: 'workflow_autofix',
    description: `Auto-fix common validation issues:
- Convert names to snake_case
- Replace $json with explicit node references
- Add AI structured output settings

Returns the fixed workflow and list of changes made.`,
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Workflow ID to fix',
        },
        apply: {
          type: 'boolean',
          description: 'Apply fixes to n8n (default: false, dry-run)',
        },
      },
      required: ['id'],
    },
  },

  {
    name: 'workflow_format',
    description: 'Format a workflow: sort nodes by position, clean up null values.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Workflow ID to format',
        },
        apply: {
          type: 'boolean',
          description: 'Apply formatting to n8n (default: false)',
        },
      },
      required: ['id'],
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Node Discovery
  // ─────────────────────────────────────────────────────────────
  {
    name: 'node_types_list',
    description: `List available n8n node types. Use this to discover valid node types BEFORE creating workflows.

Returns: type name, display name, description, category, and version for each node.
Use the search parameter to filter by keyword (searches type name, display name, and description).

IMPORTANT: Always check node types exist before using them in workflow_create or workflow_update.`,
    inputSchema: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Filter nodes by keyword (searches name, type, description)',
        },
        category: {
          type: 'string',
          description: 'Filter by category (e.g., "Core Nodes", "Flow", "AI")',
        },
        limit: {
          type: 'number',
          description: 'Max results (default 50)',
        },
      },
    },
  },

  // ─────────────────────────────────────────────────────────────
  // Version Control
  // ─────────────────────────────────────────────────────────────
  {
    name: 'version_list',
    description: 'List saved versions of a workflow (local snapshots).',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: 'Workflow ID',
        },
      },
      required: ['workflowId'],
    },
  },

  {
    name: 'version_get',
    description: 'Get a specific saved version of a workflow.',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: 'Workflow ID',
        },
        versionId: {
          type: 'string',
          description: 'Version ID (from version_list)',
        },
        format: {
          type: 'string',
          enum: ['summary', 'compact', 'full'],
          description: 'Response detail level (default: compact)',
        },
      },
      required: ['workflowId', 'versionId'],
    },
  },

  {
    name: 'version_save',
    description: 'Manually save a version snapshot of a workflow.',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: 'Workflow ID',
        },
        reason: {
          type: 'string',
          description: 'Reason for saving (default: "manual")',
        },
      },
      required: ['workflowId'],
    },
  },

  {
    name: 'version_rollback',
    description: 'Restore a workflow to a previous version.',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: 'Workflow ID',
        },
        versionId: {
          type: 'string',
          description: 'Version ID to restore',
        },
        format: {
          type: 'string',
          enum: ['summary', 'compact', 'full'],
          description: 'Response detail level (default: compact)',
        },
      },
      required: ['workflowId', 'versionId'],
    },
  },

  {
    name: 'version_diff',
    description: 'Compare two versions of a workflow or current state vs a version.',
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: {
          type: 'string',
          description: 'Workflow ID',
        },
        fromVersionId: {
          type: 'string',
          description: 'First version ID (omit for current workflow state)',
        },
        toVersionId: {
          type: 'string',
          description: 'Second version ID',
        },
      },
      required: ['workflowId', 'toVersionId'],
    },
  },

  {
    name: 'version_stats',
    description: 'Get version control statistics.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];
