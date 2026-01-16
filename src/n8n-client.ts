/**
 * n8n REST API Client
 * Clean, minimal implementation with built-in safety checks
 */

import {
  type N8nWorkflow,
  type N8nWorkflowListItem,
  type N8nExecution,
  type N8nExecutionListItem,
  type N8nListResponse,
  type N8nNode,
  type PatchOperation,
} from './types.js';
import { prepareWorkflowRequest } from './schemas.js';

export interface N8nClientConfig {
  apiUrl: string;
  apiKey: string;
}

export class N8nClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: N8nClientConfig) {
    // Normalize URL (remove trailing slash)
    this.baseUrl = config.apiUrl.replace(/\/$/, '');
    this.headers = {
      'X-N8N-API-KEY': config.apiKey,
      'Content-Type': 'application/json',
    };
  }

  // ─────────────────────────────────────────────────────────────
  // HTTP helpers
  // ─────────────────────────────────────────────────────────────

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`n8n API error (${response.status}): ${text}`);
    }

    // Handle empty responses
    const text = await response.text();
    if (!text) return {} as T;

    return JSON.parse(text) as T;
  }

  // ─────────────────────────────────────────────────────────────
  // Workflow operations
  // ─────────────────────────────────────────────────────────────

  async listWorkflows(options?: {
    limit?: number;
    cursor?: string;
    active?: boolean;
    tags?: string[];
  }): Promise<N8nListResponse<N8nWorkflowListItem>> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.cursor) params.set('cursor', options.cursor);
    if (options?.active !== undefined) params.set('active', String(options.active));
    if (options?.tags?.length) params.set('tags', options.tags.join(','));

    const query = params.toString();
    return this.request('GET', `/api/v1/workflows${query ? `?${query}` : ''}`);
  }

  async getWorkflow(id: string): Promise<N8nWorkflow> {
    return this.request('GET', `/api/v1/workflows/${id}`);
  }

  async createWorkflow(workflow: {
    name: string;
    nodes: N8nNode[];
    connections: N8nWorkflow['connections'];
    settings?: Record<string, unknown>;
  }): Promise<N8nWorkflow> {
    return this.request('POST', '/api/v1/workflows', workflow);
  }

  async updateWorkflow(
    id: string,
    workflow: Partial<N8nWorkflow>
  ): Promise<N8nWorkflow> {
    // Schema-driven: strip read-only fields and validate settings
    const prepared = prepareWorkflowRequest(workflow);
    return this.request('PUT', `/api/v1/workflows/${id}`, prepared);
  }

  async deleteWorkflow(id: string): Promise<void> {
    await this.request('DELETE', `/api/v1/workflows/${id}`);
  }

  async activateWorkflow(id: string): Promise<N8nWorkflow> {
    return this.request('POST', `/api/v1/workflows/${id}/activate`);
  }

  async deactivateWorkflow(id: string): Promise<N8nWorkflow> {
    return this.request('POST', `/api/v1/workflows/${id}/deactivate`);
  }

  // ─────────────────────────────────────────────────────────────
  // Partial update with safety checks
  // ─────────────────────────────────────────────────────────────

  async patchWorkflow(
    id: string,
    operations: PatchOperation[]
  ): Promise<{ workflow: N8nWorkflow; warnings: string[] }> {
    const warnings: string[] = [];

    // Fetch current state
    const current = await this.getWorkflow(id);

    // Apply operations
    const updated = this.applyOperations(current, operations, warnings);

    // Save - prepareWorkflowRequest handles field filtering and settings validation
    const result = await this.updateWorkflow(id, updated);

    return { workflow: result, warnings };
  }

  private applyOperations(
    workflow: N8nWorkflow,
    operations: PatchOperation[],
    warnings: string[]
  ): N8nWorkflow {
    // Deep clone
    const result: N8nWorkflow = JSON.parse(JSON.stringify(workflow));

    for (const op of operations) {
      switch (op.type) {
        case 'addNode': {
          const node: N8nNode = {
            id: op.node.id || crypto.randomUUID(),
            name: op.node.name,
            type: op.node.type,
            typeVersion: op.node.typeVersion,
            position: op.node.position,
            parameters: op.node.parameters,
            ...(op.node.credentials && { credentials: op.node.credentials }),
            ...(op.node.disabled && { disabled: op.node.disabled }),
          };
          result.nodes.push(node);
          break;
        }

        case 'removeNode': {
          const idx = result.nodes.findIndex((n) => n.name === op.nodeName);
          if (idx === -1) {
            warnings.push(`Node not found: ${op.nodeName}`);
          } else {
            result.nodes.splice(idx, 1);
            // Clean up connections
            delete result.connections[op.nodeName];
            for (const [, outputs] of Object.entries(result.connections)) {
              for (const [, connections] of Object.entries(outputs)) {
                for (const connArray of connections) {
                  const toRemove = connArray.filter((c) => c.node === op.nodeName);
                  for (const conn of toRemove) {
                    const i = connArray.indexOf(conn);
                    if (i !== -1) connArray.splice(i, 1);
                  }
                }
              }
            }
          }
          break;
        }

        case 'updateNode': {
          const node = result.nodes.find((n) => n.name === op.nodeName);
          if (!node) {
            warnings.push(`Node not found: ${op.nodeName}`);
          } else {
            // CRITICAL: Warn about parameter replacement
            if (op.properties.parameters) {
              const currentKeys = Object.keys(node.parameters);
              const newKeys = Object.keys(op.properties.parameters);
              const missingKeys = currentKeys.filter((k) => !newKeys.includes(k));
              if (missingKeys.length > 0) {
                warnings.push(
                  `WARNING: Updating "${op.nodeName}" will remove parameters: ${missingKeys.join(', ')}. ` +
                    `Include all existing parameters to preserve them.`
                );
              }
            }
            Object.assign(node, op.properties);
          }
          break;
        }

        case 'addConnection': {
          const outputType = op.outputType || 'main';
          const fromOutput = op.fromOutput || 0;
          const toInput = op.toInput || 0;
          const inputType = op.inputType || 'main';

          if (!result.connections[op.from]) {
            result.connections[op.from] = {};
          }
          if (!result.connections[op.from][outputType]) {
            result.connections[op.from][outputType] = [];
          }
          while (result.connections[op.from][outputType].length <= fromOutput) {
            result.connections[op.from][outputType].push([]);
          }
          result.connections[op.from][outputType][fromOutput].push({
            node: op.to,
            type: inputType,
            index: toInput,
          });
          break;
        }

        case 'removeConnection': {
          const outputType = op.outputType || 'main';
          const fromOutput = op.fromOutput || 0;
          const conns = result.connections[op.from]?.[outputType]?.[fromOutput];
          if (conns) {
            const idx = conns.findIndex((c) => c.node === op.to);
            if (idx !== -1) conns.splice(idx, 1);
          }
          break;
        }

        case 'updateSettings': {
          result.settings = { ...result.settings, ...op.settings };
          break;
        }

        case 'updateName': {
          result.name = op.name;
          break;
        }

        case 'activate': {
          result.active = true;
          break;
        }

        case 'deactivate': {
          result.active = false;
          break;
        }
      }
    }

    return result;
  }

  // ─────────────────────────────────────────────────────────────
  // Execution operations
  // ─────────────────────────────────────────────────────────────

  async listExecutions(options?: {
    workflowId?: string;
    status?: 'success' | 'error' | 'waiting';
    limit?: number;
    cursor?: string;
  }): Promise<N8nListResponse<N8nExecutionListItem>> {
    const params = new URLSearchParams();
    if (options?.workflowId) params.set('workflowId', options.workflowId);
    if (options?.status) params.set('status', options.status);
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.cursor) params.set('cursor', options.cursor);

    const query = params.toString();
    return this.request('GET', `/api/v1/executions${query ? `?${query}` : ''}`);
  }

  async getExecution(id: string): Promise<N8nExecution> {
    return this.request('GET', `/api/v1/executions/${id}`);
  }

  async deleteExecution(id: string): Promise<void> {
    await this.request('DELETE', `/api/v1/executions/${id}`);
  }

  // ─────────────────────────────────────────────────────────────
  // Workflow execution (webhook trigger)
  // ─────────────────────────────────────────────────────────────

  async executeWorkflow(
    id: string,
    data?: Record<string, unknown>
  ): Promise<{ executionId?: string; data?: unknown }> {
    // Get workflow to find webhook path
    const workflow = await this.getWorkflow(id);

    // Find webhook trigger node
    const webhookNode = workflow.nodes.find(
      (n) => n.type === 'n8n-nodes-base.webhook'
    );

    if (!webhookNode) {
      throw new Error('Workflow has no webhook trigger. Cannot execute via API.');
    }

    const path = webhookNode.parameters.path as string;
    if (!path) {
      throw new Error('Webhook node has no path configured.');
    }

    // Execute via webhook
    const webhookUrl = `${this.baseUrl}/webhook/${path}`;
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Webhook execution failed (${response.status}): ${text}`);
    }

    const result = await response.text();
    try {
      return JSON.parse(result);
    } catch {
      return { data: result };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Health check
  // ─────────────────────────────────────────────────────────────

  async healthCheck(): Promise<{ healthy: boolean; version?: string; error?: string }> {
    try {
      // Try to list workflows with limit 1
      await this.listWorkflows({ limit: 1 });
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

}
