/**
 * Response Format Transformers
 * Reduces response size for MCP to prevent context overflow
 */

import type { N8nWorkflow, N8nNode, N8nExecution, N8nExecutionListItem } from './types.js';

export type ResponseFormat = 'full' | 'compact' | 'summary';

// ─────────────────────────────────────────────────────────────
// Workflow Formatting
// ─────────────────────────────────────────────────────────────

export interface WorkflowSummary {
  id: string;
  name: string;
  active: boolean;
  nodeCount: number;
  connectionCount: number;
  updatedAt: string;
  nodeTypes: string[];
}

export interface WorkflowCompact {
  id: string;
  name: string;
  active: boolean;
  updatedAt: string;
  nodes: CompactNode[];
  connections: Record<string, string[]>; // simplified: nodeName -> [targetNodes]
  settings?: Record<string, unknown>;
}

export interface CompactNode {
  name: string;
  type: string;
  position: [number, number];
  hasCredentials: boolean;
  disabled?: boolean;
  // Parameters omitted to save tokens
}

/**
 * Format a workflow based on the requested format level
 */
export function formatWorkflowResponse(
  workflow: N8nWorkflow,
  format: ResponseFormat = 'compact'
): N8nWorkflow | WorkflowCompact | WorkflowSummary {
  switch (format) {
    case 'summary':
      return toWorkflowSummary(workflow);
    case 'compact':
      return toWorkflowCompact(workflow);
    case 'full':
    default:
      return workflow;
  }
}

function toWorkflowSummary(workflow: N8nWorkflow): WorkflowSummary {
  const connectionCount = Object.values(workflow.connections).reduce((acc, outputs) => {
    return acc + Object.values(outputs).reduce((a, conns) => {
      return a + conns.reduce((b, c) => b + c.length, 0);
    }, 0);
  }, 0);

  return {
    id: workflow.id,
    name: workflow.name,
    active: workflow.active,
    nodeCount: workflow.nodes.length,
    connectionCount,
    updatedAt: workflow.updatedAt,
    nodeTypes: [...new Set(workflow.nodes.map((n) => n.type))],
  };
}

function toWorkflowCompact(workflow: N8nWorkflow): WorkflowCompact {
  // Simplify connections to just show flow: nodeName -> [targetNodeNames]
  const simpleConnections: Record<string, string[]> = {};
  for (const [nodeName, outputs] of Object.entries(workflow.connections)) {
    const targets: string[] = [];
    for (const conns of Object.values(outputs)) {
      for (const connList of conns) {
        for (const conn of connList) {
          if (!targets.includes(conn.node)) {
            targets.push(conn.node);
          }
        }
      }
    }
    if (targets.length > 0) {
      simpleConnections[nodeName] = targets;
    }
  }

  return {
    id: workflow.id,
    name: workflow.name,
    active: workflow.active,
    updatedAt: workflow.updatedAt,
    nodes: workflow.nodes.map(toCompactNode),
    connections: simpleConnections,
    ...(workflow.settings && Object.keys(workflow.settings).length > 0 && { settings: workflow.settings }),
  };
}

function toCompactNode(node: N8nNode): CompactNode {
  return {
    name: node.name,
    type: node.type,
    position: node.position,
    hasCredentials: !!node.credentials && Object.keys(node.credentials).length > 0,
    ...(node.disabled && { disabled: true }),
  };
}

// ─────────────────────────────────────────────────────────────
// Execution Formatting
// ─────────────────────────────────────────────────────────────

export interface ExecutionSummary {
  id: string;
  workflowId: string;
  status: string;
  mode: string;
  startedAt: string;
  stoppedAt?: string;
  durationMs?: number;
  hasError: boolean;
  errorMessage?: string;
}

export interface ExecutionCompact {
  id: string;
  workflowId: string;
  status: string;
  mode: string;
  startedAt: string;
  stoppedAt?: string;
  finished: boolean;
  error?: { message: string };
  // runData omitted - often huge
  nodeResults?: NodeResultSummary[];
}

export interface NodeResultSummary {
  nodeName: string;
  itemCount: number;
  success: boolean;
}

/**
 * Format an execution based on the requested format level
 */
export function formatExecutionResponse(
  execution: N8nExecution,
  format: ResponseFormat = 'compact'
): N8nExecution | ExecutionCompact | ExecutionSummary {
  switch (format) {
    case 'summary':
      return toExecutionSummary(execution);
    case 'compact':
      return toExecutionCompact(execution);
    case 'full':
    default:
      return execution;
  }
}

function toExecutionSummary(execution: N8nExecution): ExecutionSummary {
  const durationMs = execution.stoppedAt && execution.startedAt
    ? new Date(execution.stoppedAt).getTime() - new Date(execution.startedAt).getTime()
    : undefined;

  return {
    id: execution.id,
    workflowId: execution.workflowId,
    status: execution.status,
    mode: execution.mode,
    startedAt: execution.startedAt,
    stoppedAt: execution.stoppedAt,
    durationMs,
    hasError: execution.status === 'error',
    errorMessage: execution.data?.resultData?.error?.message,
  };
}

function toExecutionCompact(execution: N8nExecution): ExecutionCompact {
  const nodeResults: NodeResultSummary[] = [];

  if (execution.data?.resultData?.runData) {
    for (const [nodeName, runs] of Object.entries(execution.data.resultData.runData)) {
      // runData is Record<string, unknown>, so we need to handle it carefully
      const runArray = runs as Array<{ data?: { main?: Array<Array<unknown>> } }>;
      if (Array.isArray(runArray) && runArray.length > 0) {
        const lastRun = runArray[runArray.length - 1];
        const itemCount = lastRun?.data?.main?.[0]?.length ?? 0;
        nodeResults.push({
          nodeName,
          itemCount,
          success: true,
        });
      }
    }
  }

  return {
    id: execution.id,
    workflowId: execution.workflowId,
    status: execution.status,
    mode: execution.mode,
    startedAt: execution.startedAt,
    stoppedAt: execution.stoppedAt,
    finished: execution.finished,
    ...(execution.data?.resultData?.error && { error: { message: execution.data.resultData.error.message } }),
    ...(nodeResults.length > 0 && { nodeResults }),
  };
}

/**
 * Format execution list items
 */
export function formatExecutionListResponse(
  executions: N8nExecutionListItem[],
  format: ResponseFormat = 'compact'
): N8nExecutionListItem[] | Array<{ id: string; status: string; startedAt: string }> {
  if (format === 'summary') {
    return executions.map((e) => ({
      id: e.id,
      status: e.status,
      startedAt: e.startedAt,
    }));
  }
  // compact and full are the same for list items (already minimal)
  return executions;
}

// ─────────────────────────────────────────────────────────────
// Generic Response Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Remove null/undefined values and empty objects to reduce size
 */
export function cleanResponse<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(cleanResponse) as T;
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value !== null && value !== undefined) {
        const cleanedValue = cleanResponse(value);
        // Skip empty objects and arrays
        if (typeof cleanedValue === 'object' && cleanedValue !== null) {
          if (Array.isArray(cleanedValue) && cleanedValue.length === 0) continue;
          if (!Array.isArray(cleanedValue) && Object.keys(cleanedValue).length === 0) continue;
        }
        cleaned[key] = cleanedValue;
      }
    }
    return cleaned as T;
  }
  return obj;
}

/**
 * Stringify with optional minification
 */
export function stringifyResponse(obj: unknown, minify = true): string {
  const cleaned = cleanResponse(obj);
  return minify ? JSON.stringify(cleaned) : JSON.stringify(cleaned, null, 2);
}
