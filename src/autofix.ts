/**
 * Auto-fix and Format n8n Workflows
 *
 * Pure functions for workflow transformation:
 * - autofixWorkflow: Apply automatic fixes for validation warnings
 * - formatWorkflow: Calculate node positions (dagre) and clean parameters
 * - toSnakeCase: Convert strings to snake_case format
 *
 * All functions return new objects without mutating inputs.
 */

import dagre from 'dagre';
import type { N8nWorkflow, N8nNode, ValidationWarning } from './types.js';

export interface AutofixResult {
  workflow: N8nWorkflow;
  fixes: AutofixAction[];
  unfixable: ValidationWarning[];
}

export interface AutofixAction {
  type: string;
  target: string;
  description: string;
  before?: string;
  after?: string;
}

/**
 * Auto-fix a workflow based on validation warnings
 */
export function autofixWorkflow(
  workflow: N8nWorkflow,
  warnings: ValidationWarning[]
): AutofixResult {
  // Deep clone to avoid mutation
  const fixed: N8nWorkflow = JSON.parse(JSON.stringify(workflow));
  const fixes: AutofixAction[] = [];
  const unfixable: ValidationWarning[] = [];

  for (const warning of warnings) {
    const result = attemptFix(fixed, warning);
    if (result) {
      fixes.push(result);
    } else {
      unfixable.push(warning);
    }
  }

  return { workflow: fixed, fixes, unfixable };
}

function attemptFix(workflow: N8nWorkflow, warning: ValidationWarning): AutofixAction | null {
  switch (warning.rule) {
    case 'snake_case':
      return fixSnakeCase(workflow, warning);

    case 'explicit_reference':
      return fixExplicitReference(workflow, warning);

    case 'ai_structured_output':
      return fixAIStructuredOutput(workflow, warning);

    default:
      // Rules that can't be auto-fixed:
      // - no_hardcoded_secrets (need manual review)
      // - no_hardcoded_ids (need manual review)
      // - orphan_node (need context to know what to connect)
      // - code_node_usage (info only)
      // - in_memory_storage (architectural decision)
      return null;
  }
}

/**
 * Fix snake_case naming
 */
function fixSnakeCase(workflow: N8nWorkflow, warning: ValidationWarning): AutofixAction | null {
  const target = warning.node || 'workflow';

  if (!warning.node) {
    // Fix workflow name
    const oldName = workflow.name;
    const newName = toSnakeCase(oldName);

    if (oldName === newName) return null;

    workflow.name = newName;
    return {
      type: 'rename',
      target: 'workflow',
      description: `Renamed workflow to snake_case`,
      before: oldName,
      after: newName,
    };
  }

  // Fix node name
  const node = workflow.nodes.find((n) => n.name === warning.node);
  if (!node) return null;

  const oldName = node.name;
  const newName = toSnakeCase(oldName);

  if (oldName === newName) return null;

  // Update node name
  node.name = newName;

  // Update connections that reference this node
  if (workflow.connections[oldName]) {
    workflow.connections[newName] = workflow.connections[oldName];
    delete workflow.connections[oldName];
  }

  // Update connections that target this node
  for (const outputs of Object.values(workflow.connections)) {
    for (const outputType of Object.values(outputs)) {
      for (const connections of outputType) {
        for (const conn of connections) {
          if (conn.node === oldName) {
            conn.node = newName;
          }
        }
      }
    }
  }

  return {
    type: 'rename',
    target: `node:${oldName}`,
    description: `Renamed node to snake_case`,
    before: oldName,
    after: newName,
  };
}

/**
 * Convert string to snake_case
 * Handles camelCase, PascalCase, kebab-case, and spaces
 */
export function toSnakeCase(name: string): string {
  return name
    .replace(/([A-Z])/g, '_$1')
    .replace(/[-\s]+/g, '_')
    .replace(/^_/, '')
    .replace(/_+/g, '_')
    .toLowerCase();
}

/**
 * Fix $json to explicit references
 * This is a best-effort fix - may need manual review
 */
function fixExplicitReference(
  workflow: N8nWorkflow,
  warning: ValidationWarning
): AutofixAction | null {
  if (!warning.node) return null;

  const node = workflow.nodes.find((n) => n.name === warning.node);
  if (!node) return null;

  // Find the previous node in the connection chain
  const previousNode = findPreviousNode(workflow, node.name);
  if (!previousNode) {
    // Can't auto-fix without knowing the source
    return null;
  }

  // Replace $json with explicit reference
  const params = JSON.stringify(node.parameters);
  const fixedParams = params
    .replace(/\$json\./g, `$('${previousNode}').item.json.`)
    .replace(/\{\{\s*\$json\./g, `{{ $('${previousNode}').item.json.`);

  if (params === fixedParams) return null;

  node.parameters = JSON.parse(fixedParams);

  return {
    type: 'expression_fix',
    target: `node:${node.name}`,
    description: `Changed $json to explicit $('${previousNode}') reference`,
    before: '$json.',
    after: `$('${previousNode}').item.json.`,
  };
}

/**
 * Find the previous node in the connection chain
 */
function findPreviousNode(workflow: N8nWorkflow, nodeName: string): string | null {
  for (const [sourceName, outputs] of Object.entries(workflow.connections)) {
    for (const outputType of Object.values(outputs)) {
      for (const connections of outputType) {
        for (const conn of connections) {
          if (conn.node === nodeName) {
            return sourceName;
          }
        }
      }
    }
  }
  return null;
}

/**
 * Fix AI structured output settings
 */
function fixAIStructuredOutput(
  workflow: N8nWorkflow,
  warning: ValidationWarning
): AutofixAction | null {
  if (!warning.node) return null;

  const node = workflow.nodes.find((n) => n.name === warning.node);
  if (!node) return null;

  const params = node.parameters as Record<string, unknown>;
  const changes: string[] = [];

  if (params.promptType !== 'define') {
    params.promptType = 'define';
    changes.push('promptType: "define"');
  }

  if (params.hasOutputParser !== true) {
    params.hasOutputParser = true;
    changes.push('hasOutputParser: true');
  }

  if (changes.length === 0) return null;

  return {
    type: 'parameter_fix',
    target: `node:${node.name}`,
    description: `Added AI structured output settings: ${changes.join(', ')}`,
  };
}

/**
 * Format a workflow for consistency
 * - Calculates node positions based on connection graph (like "Tidy Up")
 * - Removes empty/null values
 */
export function formatWorkflow(workflow: N8nWorkflow): N8nWorkflow {
  const formatted: N8nWorkflow = JSON.parse(JSON.stringify(workflow));

  // Calculate positions based on graph layout
  calculateNodePositions(formatted);

  // Clean up parameters - remove undefined/null
  for (const node of formatted.nodes) {
    node.parameters = cleanObject(node.parameters);
  }

  return formatted;
}

// Layout constants matching n8n's canvas (from nodeViewUtils.ts)
// n8n uses GRID_SIZE = 16 as base unit
const GRID_SIZE = 16;
const NODE_WIDTH = GRID_SIZE * 6; // 96 - matches DEFAULT_NODE_SIZE
const NODE_HEIGHT = GRID_SIZE * 6; // 96 - n8n uses square nodes
const HORIZONTAL_SPACING = GRID_SIZE * 8; // 128 - NODE_X_SPACING (ranksep)
const VERTICAL_SPACING = GRID_SIZE * 6; // 96 - NODE_Y_SPACING (nodesep)
const START_X = GRID_SIZE * 11; // 176 - DEFAULT_START_POSITION_X
const START_Y = GRID_SIZE * 15; // 240 - DEFAULT_START_POSITION_Y

/**
 * Calculate node positions using dagre graph layout
 * Provides proper edge crossing minimization and rank assignment
 */
function calculateNodePositions(workflow: N8nWorkflow): void {
  if (workflow.nodes.length === 0) return;

  // Create a new directed graph
  const g = new dagre.graphlib.Graph();

  // Set graph options: left-to-right layout, spacing (matches n8n's useCanvasLayout.ts)
  g.setGraph({
    rankdir: 'LR', // Left to right (triggers on left, outputs on right)
    edgesep: VERTICAL_SPACING, // Edge separation (n8n uses NODE_Y_SPACING)
    nodesep: VERTICAL_SPACING, // Vertical spacing between nodes
    ranksep: HORIZONTAL_SPACING, // Horizontal spacing between ranks/layers
    marginx: START_X,
    marginy: START_Y,
  });

  // Required for dagre
  g.setDefaultEdgeLabel(() => ({}));

  // Add all nodes to the graph
  for (const node of workflow.nodes) {
    g.setNode(node.name, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });
  }

  // Add edges from connections
  for (const [sourceName, outputs] of Object.entries(workflow.connections)) {
    for (const outputType of Object.values(outputs)) {
      for (const connections of outputType) {
        for (const conn of connections) {
          // Only add edge if both nodes exist
          if (g.hasNode(sourceName) && g.hasNode(conn.node)) {
            g.setEdge(sourceName, conn.node);
          }
        }
      }
    }
  }

  // Run the dagre layout algorithm
  dagre.layout(g);

  // Apply calculated positions to workflow nodes
  for (const node of workflow.nodes) {
    const dagreNode = g.node(node.name);
    if (dagreNode) {
      // dagre returns center coordinates, convert to top-left
      node.position = [
        Math.round(dagreNode.x - NODE_WIDTH / 2),
        Math.round(dagreNode.y - NODE_HEIGHT / 2),
      ];
    }
  }

  // Sort nodes by position for consistent output
  workflow.nodes.sort((a, b) => {
    const [ax, ay] = a.position;
    const [bx, by] = b.position;
    if (ax !== bx) return ax - bx;
    return ay - by;
  });
}

/**
 * Remove null/undefined values from object
 */
function cleanObject(obj: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      cleaned[key] = cleanObject(value as Record<string, unknown>);
    } else {
      cleaned[key] = value;
    }
  }

  return cleaned;
}
