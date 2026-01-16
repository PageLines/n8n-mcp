/**
 * Zod schemas for n8n API request validation
 * Source of truth: n8n OpenAPI spec
 * https://github.com/n8n-io/n8n/blob/master/packages/cli/src/public-api/v1/handlers/workflows/spec/schemas/workflowSettings.yml
 */

import { z } from 'zod';
import { N8N_WORKFLOW_WRITABLE_FIELDS, pickFields, type N8nWorkflow } from './types.js';

/**
 * Workflow settings schema - matches n8n OpenAPI spec exactly
 * The API uses additionalProperties: false, so unknown fields cause errors
 */
export const WorkflowSettingsSchema = z.object({
  saveExecutionProgress: z.boolean().optional(),
  saveManualExecutions: z.boolean().optional(),
  saveDataErrorExecution: z.enum(['all', 'none']).optional(),
  saveDataSuccessExecution: z.enum(['all', 'none']).optional(),
  executionTimeout: z.number().optional(),
  errorWorkflow: z.string().optional(),
  timezone: z.string().optional(),
  executionOrder: z.string().optional(),
  callerPolicy: z.enum(['any', 'none', 'workflowsFromAList', 'workflowsFromSameOwner']).optional(),
  callerIds: z.string().optional(),
  timeSavedPerExecution: z.number().optional(),
  availableInMCP: z.boolean().optional(),
}).strict();

export type WorkflowSettings = z.infer<typeof WorkflowSettingsSchema>;

/**
 * Prepare a workflow object for API requests
 * - Strips read-only fields (id, createdAt, etc.)
 * - Validates and strips unknown settings properties
 *
 * @param workflow - Partial workflow object to prepare
 * @returns Cleaned workflow ready for n8n API
 */
export function prepareWorkflowRequest(workflow: Partial<N8nWorkflow>): Partial<N8nWorkflow> {
  // Pick only writable fields
  const prepared = pickFields(workflow, N8N_WORKFLOW_WRITABLE_FIELDS);

  // Validate and strip unknown settings properties
  if (prepared.settings && typeof prepared.settings === 'object') {
    const result = WorkflowSettingsSchema.safeParse(prepared.settings);
    if (result.success) {
      prepared.settings = result.data;
    } else {
      // Strip unknown fields by only keeping valid ones
      const validSettings: Record<string, unknown> = {};
      for (const key of Object.keys(prepared.settings)) {
        const singleField = { [key]: (prepared.settings as Record<string, unknown>)[key] };
        const fieldResult = WorkflowSettingsSchema.partial().safeParse(singleField);
        if (fieldResult.success) {
          Object.assign(validSettings, fieldResult.data);
        }
      }
      prepared.settings = validSettings;
    }
  }

  return prepared;
}
