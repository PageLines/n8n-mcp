import { describe, it, expect } from 'vitest';
import { WorkflowSettingsSchema, prepareWorkflowRequest } from './schemas.js';
import type { N8nWorkflow } from './types.js';

describe('WorkflowSettingsSchema', () => {
  it('accepts valid settings', () => {
    const settings = {
      saveExecutionProgress: true,
      saveManualExecutions: false,
      saveDataErrorExecution: 'all' as const,
      saveDataSuccessExecution: 'none' as const,
      executionTimeout: 3600,
      errorWorkflow: 'abc123',
      timezone: 'America/New_York',
      executionOrder: 'v1',
      callerPolicy: 'any' as const,
      callerIds: '14, 18, 23',
      timeSavedPerExecution: 60,
      availableInMCP: true,
    };

    const result = WorkflowSettingsSchema.safeParse(settings);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(settings);
    }
  });

  it('strips unknown properties', () => {
    const settings = {
      timezone: 'UTC',
      timeSavedMode: 'fixed', // This is NOT in the API schema
      unknownField: 'should be stripped',
    };

    const result = WorkflowSettingsSchema.safeParse(settings);
    // strict() mode causes failure on unknown properties
    expect(result.success).toBe(false);
  });

  it('accepts empty settings', () => {
    const result = WorkflowSettingsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('validates callerPolicy enum', () => {
    const valid = WorkflowSettingsSchema.safeParse({ callerPolicy: 'workflowsFromAList' });
    expect(valid.success).toBe(true);

    const invalid = WorkflowSettingsSchema.safeParse({ callerPolicy: 'invalidPolicy' });
    expect(invalid.success).toBe(false);
  });

  it('validates saveDataErrorExecution enum', () => {
    const valid = WorkflowSettingsSchema.safeParse({ saveDataErrorExecution: 'all' });
    expect(valid.success).toBe(true);

    const invalid = WorkflowSettingsSchema.safeParse({ saveDataErrorExecution: 'sometimes' });
    expect(invalid.success).toBe(false);
  });
});

describe('prepareWorkflowRequest', () => {
  const createWorkflow = (overrides: Partial<N8nWorkflow> = {}): N8nWorkflow => ({
    id: '123',
    name: 'test_workflow',
    active: true,
    nodes: [],
    connections: {},
    createdAt: '2024-01-01',
    updatedAt: '2024-01-02',
    ...overrides,
  });

  /**
   * Regression test for: "request/body/settings must NOT have additional properties"
   * n8n API returns settings on GET that it rejects on PUT (additionalProperties: false)
   * Common culprits: timeSavedMode, other internal properties
   */
  it('fixes "settings must NOT have additional properties" error', () => {
    // Simulate workflow fetched from n8n with internal settings properties
    const workflowFromApi = createWorkflow({
      settings: {
        timezone: 'UTC',
        executionOrder: 'v1',
        // These are returned by n8n GET but rejected by PUT
        timeSavedMode: 'fixed',
        someInternalFlag: true,
        __internal: { foo: 'bar' },
      } as Record<string, unknown>,
    });

    const prepared = prepareWorkflowRequest(workflowFromApi);

    // Should strip unknown properties, keeping only valid ones
    expect(prepared.settings).toEqual({
      timezone: 'UTC',
      executionOrder: 'v1',
    });
    expect(prepared.settings).not.toHaveProperty('timeSavedMode');
    expect(prepared.settings).not.toHaveProperty('someInternalFlag');
    expect(prepared.settings).not.toHaveProperty('__internal');
  });

  it('strips read-only fields', () => {
    const workflow = createWorkflow();
    const prepared = prepareWorkflowRequest(workflow);

    expect(prepared.id).toBeUndefined();
    expect(prepared.createdAt).toBeUndefined();
    expect(prepared.updatedAt).toBeUndefined();
    expect(prepared.active).toBeUndefined();
    expect(prepared.name).toBe('test_workflow');
    expect(prepared.nodes).toEqual([]);
    expect(prepared.connections).toEqual({});
  });

  it('strips unknown settings properties', () => {
    const workflow = createWorkflow({
      settings: {
        timezone: 'UTC',
        timeSavedMode: 'fixed', // Not in API schema - should be stripped
        internalField: 'value', // Unknown - should be stripped
      } as Record<string, unknown>,
    });

    const prepared = prepareWorkflowRequest(workflow);

    expect(prepared.settings).toEqual({ timezone: 'UTC' });
  });

  it('preserves valid settings', () => {
    const workflow = createWorkflow({
      settings: {
        timezone: 'America/New_York',
        executionTimeout: 3600,
        callerPolicy: 'any',
      },
    });

    const prepared = prepareWorkflowRequest(workflow);

    expect(prepared.settings).toEqual({
      timezone: 'America/New_York',
      executionTimeout: 3600,
      callerPolicy: 'any',
    });
  });

  it('handles undefined settings', () => {
    const workflow = createWorkflow({ settings: undefined });
    const prepared = prepareWorkflowRequest(workflow);

    expect(prepared.settings).toBeUndefined();
  });

  it('handles empty settings', () => {
    const workflow = createWorkflow({ settings: {} });
    const prepared = prepareWorkflowRequest(workflow);

    expect(prepared.settings).toEqual({});
  });

  it('preserves nodes and connections', () => {
    const workflow = createWorkflow({
      nodes: [
        {
          id: 'n1',
          name: 'webhook',
          type: 'n8n-nodes-base.webhook',
          typeVersion: 1,
          position: [0, 0] as [number, number],
          parameters: { path: 'test' },
        },
      ],
      connections: {
        webhook: {
          main: [[{ node: 'next', type: 'main', index: 0 }]],
        },
      },
    });

    const prepared = prepareWorkflowRequest(workflow);

    expect(prepared.nodes).toHaveLength(1);
    expect(prepared.nodes![0].name).toBe('webhook');
    expect(prepared.connections).toHaveProperty('webhook');
  });
});
