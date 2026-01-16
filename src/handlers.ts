/**
 * Tool Handlers
 * Extracted from index.ts for modularity and testability
 */

import type { N8nClient } from './n8n-client.js';
import { validateWorkflow } from './validators.js';
import { validateExpressions, checkCircularReferences } from './expressions.js';
import { autofixWorkflow, formatWorkflow } from './autofix.js';
import {
  saveVersion,
  listVersions,
  getVersion,
  diffWorkflows,
  getVersionStats,
} from './versions.js';
import {
  formatWorkflowResponse,
  formatExecutionResponse,
  formatExecutionListResponse,
  type ResponseFormat,
} from './response-format.js';
import type { PatchOperation, N8nConnections, N8nWorkflow } from './types.js';
import { searchNodeTypes, getCategories, getNodeCount } from './node-registry.js';

type Args = Record<string, unknown>;

/**
 * Auto-cleanup pipeline for workflows
 * Used after create/update to validate, fix, and format
 */
async function autoCleanup(
  client: N8nClient,
  workflow: N8nWorkflow
): Promise<{
  workflow: N8nWorkflow;
  validation: { valid: boolean; warnings: unknown[] };
  autoFixed?: string[];
}> {
  const validation = validateWorkflow(workflow);
  const autofix = autofixWorkflow(workflow, validation.warnings);
  let formatted = formatWorkflow(autofix.workflow);

  // Apply cleanup if there were fixes or formatting changes
  if (autofix.fixes.length > 0 || JSON.stringify(workflow) !== JSON.stringify(formatted)) {
    const updated = await client.updateWorkflow(workflow.id, formatted);
    formatted = updated;
  }

  return {
    workflow: formatted,
    validation: {
      ...validation,
      warnings: autofix.unfixable, // Only show unfixable warnings
    },
    autoFixed: autofix.fixes.length > 0 ? autofix.fixes.map(f => f.description) : undefined,
  };
}

/**
 * Create all tool handlers with injected dependencies
 */
export function createHandlers(client: N8nClient) {
  return {
    // ─────────────────────────────────────────────────────────────
    // Workflow Operations
    // ─────────────────────────────────────────────────────────────

    async workflow_list(args: Args) {
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
    },

    async workflow_get(args: Args) {
      const workflow = await client.getWorkflow(args.id as string);
      const format = (args.format as ResponseFormat) || 'compact';
      return formatWorkflowResponse(workflow, format);
    },

    async workflow_create(args: Args) {
      const inputNodes = args.nodes as Array<{
        name: string;
        type: string;
        typeVersion: number;
        position: [number, number];
        parameters: Record<string, unknown>;
        credentials?: Record<string, { id: string; name: string }>;
      }>;

      const nodes = inputNodes.map((n, i) => ({
        id: crypto.randomUUID(),
        name: n.name,
        type: n.type,
        typeVersion: n.typeVersion,
        position: n.position || [250, 250 + i * 100],
        parameters: n.parameters || {},
        ...(n.credentials && { credentials: n.credentials }),
      }));

      const created = await client.createWorkflow({
        name: args.name as string,
        nodes,
        connections: (args.connections as N8nConnections) || {},
        settings: args.settings as Record<string, unknown>,
      });

      const { workflow, validation, autoFixed } = await autoCleanup(client, created);
      const format = (args.format as ResponseFormat) || 'compact';

      return {
        workflow: formatWorkflowResponse(workflow, format),
        validation,
        autoFixed,
      };
    },

    async workflow_update(args: Args) {
      const operations = args.operations as PatchOperation[];

      // Save version before updating
      const currentWorkflow = await client.getWorkflow(args.id as string);
      const versionSaved = await saveVersion(currentWorkflow, 'before_update');

      const { workflow: patched, warnings } = await client.patchWorkflow(
        args.id as string,
        operations
      );

      const { workflow, validation, autoFixed } = await autoCleanup(client, patched);
      const format = (args.format as ResponseFormat) || 'compact';

      return {
        workflow: formatWorkflowResponse(workflow, format),
        patchWarnings: warnings,
        validation,
        autoFixed,
        versionSaved: versionSaved ? versionSaved.id : null,
      };
    },

    async workflow_delete(args: Args) {
      await client.deleteWorkflow(args.id as string);
      return { success: true, message: `Workflow ${args.id} deleted` };
    },

    async workflow_activate(args: Args) {
      const workflow = await client.activateWorkflow(args.id as string);
      return {
        id: workflow.id,
        name: workflow.name,
        active: workflow.active,
      };
    },

    async workflow_deactivate(args: Args) {
      const workflow = await client.deactivateWorkflow(args.id as string);
      return {
        id: workflow.id,
        name: workflow.name,
        active: workflow.active,
      };
    },

    async workflow_execute(args: Args) {
      return client.executeWorkflow(
        args.id as string,
        args.data as Record<string, unknown>
      );
    },

    // ─────────────────────────────────────────────────────────────
    // Execution Operations
    // ─────────────────────────────────────────────────────────────

    async execution_list(args: Args) {
      const response = await client.listExecutions({
        workflowId: args.workflowId as string | undefined,
        status: args.status as 'success' | 'error' | 'waiting' | undefined,
        limit: (args.limit as number) || 20,
      });
      const format = (args.format as ResponseFormat) || 'compact';
      return {
        executions: formatExecutionListResponse(response.data, format),
        total: response.data.length,
      };
    },

    async execution_get(args: Args) {
      const execution = await client.getExecution(args.id as string);
      const format = (args.format as ResponseFormat) || 'compact';
      return formatExecutionResponse(execution, format);
    },

    // ─────────────────────────────────────────────────────────────
    // Validation & Quality
    // ─────────────────────────────────────────────────────────────

    async workflow_validate(args: Args) {
      const workflow = await client.getWorkflow(args.id as string);
      const validation = validateWorkflow(workflow);
      const expressionIssues = validateExpressions(workflow);
      const circularRefs = checkCircularReferences(workflow);

      return {
        workflowId: workflow.id,
        workflowName: workflow.name,
        ...validation,
        expressionIssues,
        circularReferences: circularRefs.length > 0 ? circularRefs : null,
      };
    },

    async workflow_autofix(args: Args) {
      const workflow = await client.getWorkflow(args.id as string);
      const validation = validateWorkflow(workflow);
      const result = autofixWorkflow(workflow, validation.warnings);

      if (args.apply && result.fixes.length > 0) {
        await saveVersion(workflow, 'before_autofix');
        await client.updateWorkflow(args.id as string, result.workflow);

        return {
          applied: true,
          fixes: result.fixes,
          unfixable: result.unfixable,
          workflow: result.workflow,
        };
      }

      return {
        applied: false,
        fixes: result.fixes,
        unfixable: result.unfixable,
        previewWorkflow: result.workflow,
      };
    },

    async workflow_format(args: Args) {
      const workflow = await client.getWorkflow(args.id as string);
      const formatted = formatWorkflow(workflow);

      if (args.apply) {
        await saveVersion(workflow, 'before_format');
        await client.updateWorkflow(args.id as string, formatted);

        return {
          applied: true,
          workflow: formatted,
        };
      }

      return {
        applied: false,
        previewWorkflow: formatted,
      };
    },

    // ─────────────────────────────────────────────────────────────
    // Version Control
    // ─────────────────────────────────────────────────────────────

    async version_list(args: Args) {
      const versions = await listVersions(args.workflowId as string);
      return {
        workflowId: args.workflowId,
        versions,
        total: versions.length,
      };
    },

    async version_get(args: Args) {
      const version = await getVersion(
        args.workflowId as string,
        args.versionId as string
      );
      if (!version) {
        throw new Error(`Version ${args.versionId} not found`);
      }
      const format = (args.format as ResponseFormat) || 'compact';
      return {
        meta: version.meta,
        workflow: formatWorkflowResponse(version.workflow, format),
      };
    },

    async version_save(args: Args) {
      const workflow = await client.getWorkflow(args.workflowId as string);
      const version = await saveVersion(
        workflow,
        (args.reason as string) || 'manual'
      );
      if (!version) {
        return { saved: false, message: 'No changes detected since last version' };
      }
      return { saved: true, version };
    },

    async version_rollback(args: Args) {
      const version = await getVersion(
        args.workflowId as string,
        args.versionId as string
      );
      if (!version) {
        throw new Error(`Version ${args.versionId} not found`);
      }

      const currentWorkflow = await client.getWorkflow(args.workflowId as string);
      await saveVersion(currentWorkflow, 'before_rollback');
      await client.updateWorkflow(args.workflowId as string, version.workflow);
      const format = (args.format as ResponseFormat) || 'compact';

      return {
        success: true,
        restoredVersion: version.meta,
        workflow: formatWorkflowResponse(version.workflow, format),
      };
    },

    async version_diff(args: Args) {
      const toVersion = await getVersion(
        args.workflowId as string,
        args.toVersionId as string
      );
      if (!toVersion) {
        throw new Error(`Version ${args.toVersionId} not found`);
      }

      let fromWorkflow;
      if (args.fromVersionId) {
        const fromVersion = await getVersion(
          args.workflowId as string,
          args.fromVersionId as string
        );
        if (!fromVersion) {
          throw new Error(`Version ${args.fromVersionId} not found`);
        }
        fromWorkflow = fromVersion.workflow;
      } else {
        fromWorkflow = await client.getWorkflow(args.workflowId as string);
      }

      const diff = diffWorkflows(fromWorkflow, toVersion.workflow);

      return {
        from: args.fromVersionId || 'current',
        to: args.toVersionId,
        diff,
      };
    },

    async version_stats() {
      return getVersionStats();
    },

    // ─────────────────────────────────────────────────────────────
    // Node Discovery
    // ─────────────────────────────────────────────────────────────

    async node_types_list(args: Args) {
      const nodes = searchNodeTypes({
        search: args.search as string | undefined,
        category: args.category as string | undefined,
        limit: (args.limit as number) || 100,
      });
      return {
        nodes,
        total: nodes.length,
        totalAvailable: getNodeCount(),
        categories: getCategories(),
      };
    },
  };
}

export type Handlers = ReturnType<typeof createHandlers>;
export type HandlerName = keyof Handlers;
