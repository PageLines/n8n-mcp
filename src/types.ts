/**
 * n8n API Types
 * Minimal types for workflow management
 */

export interface N8nNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, unknown>;
  credentials?: Record<string, { id: string; name: string }>;
  disabled?: boolean;
  notes?: string;
  notesInFlow?: boolean;
}

export interface N8nConnection {
  node: string;
  type: string;
  index: number;
}

export interface N8nConnections {
  [nodeName: string]: {
    [outputType: string]: N8nConnection[][];
  };
}

export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  nodes: N8nNode[];
  connections: N8nConnections;
  settings?: Record<string, unknown>;
  staticData?: Record<string, unknown>;
  tags?: { id: string; name: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface N8nWorkflowListItem {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  tags?: { id: string; name: string }[];
}

export interface N8nExecution {
  id: string;
  workflowId: string;
  finished: boolean;
  mode: string;
  startedAt: string;
  stoppedAt?: string;
  status: 'success' | 'error' | 'waiting' | 'running';
  data?: {
    resultData?: {
      runData?: Record<string, unknown>;
      error?: { message: string };
    };
  };
}

export interface N8nExecutionListItem {
  id: string;
  workflowId: string;
  status: string;
  startedAt: string;
  stoppedAt?: string;
  mode: string;
}

// Patch operations for partial updates
export type PatchOperation =
  | { type: 'addNode'; node: Omit<N8nNode, 'id'> & { id?: string } }
  | { type: 'removeNode'; nodeName: string }
  | { type: 'updateNode'; nodeName: string; properties: Partial<N8nNode> }
  | { type: 'addConnection'; from: string; to: string; fromOutput?: number; toInput?: number; outputType?: string; inputType?: string }
  | { type: 'removeConnection'; from: string; to: string; fromOutput?: number; toInput?: number; outputType?: string }
  | { type: 'updateSettings'; settings: Record<string, unknown> }
  | { type: 'updateName'; name: string }
  | { type: 'activate' }
  | { type: 'deactivate' };

// Validation
export interface ValidationWarning {
  node?: string;
  rule: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ValidationResult {
  valid: boolean;
  warnings: ValidationWarning[];
}

// API response wrappers
export interface N8nListResponse<T> {
  data: T[];
  nextCursor?: string;
}

// Node type information from n8n API (GET /api/v1/nodes)
export interface N8nNodeType {
  name: string;           // e.g., "n8n-nodes-base.webhook"
  displayName: string;    // e.g., "Webhook"
  description: string;
  group: string[];        // e.g., ["trigger"]
  version: number;
  defaults?: {
    name: string;
  };
  codex?: {
    categories?: string[];
    alias?: string[];
  };
}

// Simplified node type for tool responses (reduced tokens)
export interface N8nNodeTypeSummary {
  type: string;           // Full type name
  name: string;           // Display name
  description: string;
  category: string;
  version: number;
}

// Node type validation error
export interface NodeTypeValidationError {
  nodeType: string;
  nodeName: string;
  message: string;
  suggestions?: string[];
}
