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

// ─────────────────────────────────────────────────────────────
// Schema-driven field definitions
// Source of truth: n8n OpenAPI spec at /api/v1/openapi.yml
// ─────────────────────────────────────────────────────────────

/**
 * Fields that n8n API accepts on PUT /workflows/:id
 * All other fields (id, createdAt, homeProject, etc.) are read-only
 *
 * Derived from: n8n OpenAPI spec (GET {n8n-url}/api/v1/openapi.yml)
 * Path: /workflows/{id} → put → requestBody → content → application/json → schema
 *
 * If n8n adds new writable fields, check the OpenAPI spec and update this array.
 */
export const N8N_WORKFLOW_WRITABLE_FIELDS = [
  'name',
  'nodes',
  'connections',
  'settings',
  'staticData',
  // Note: 'tags' is read-only in some n8n versions
] as const;

export type N8nWorkflowWritableField = (typeof N8N_WORKFLOW_WRITABLE_FIELDS)[number];
export type N8nWorkflowUpdate = Pick<N8nWorkflow, N8nWorkflowWritableField>;

/**
 * Pick only specified fields from an object (strips everything else)
 * Generic utility for schema-driven field filtering
 */
export function pickFields<T, K extends keyof T>(
  obj: T,
  fields: readonly K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const field of fields) {
    if (field in (obj as object) && obj[field] !== undefined) {
      result[field] = obj[field];
    }
  }
  return result;
}
