import { describe, it, expect } from 'vitest';
import { validateWorkflow, validatePartialUpdate } from './validators.js';
import type { N8nWorkflow } from './types.js';

const createWorkflow = (overrides: Partial<N8nWorkflow> = {}): N8nWorkflow => ({
  id: '1',
  name: 'test_workflow',
  active: false,
  nodes: [],
  connections: {},
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01',
  ...overrides,
});

describe('validateWorkflow', () => {
  it('passes for valid snake_case workflow', () => {
    const workflow = createWorkflow({
      name: 'my_workflow',
      nodes: [
        {
          id: '1',
          name: 'webhook_trigger',
          type: 'n8n-nodes-base.webhook',
          typeVersion: 1,
          position: [0, 0],
          parameters: { path: 'test' },
        },
      ],
    });

    const result = validateWorkflow(workflow);
    expect(result.valid).toBe(true);
  });

  it('warns on non-snake_case workflow name', () => {
    const workflow = createWorkflow({ name: 'My-Workflow-Name' });
    const result = validateWorkflow(workflow);

    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        rule: 'snake_case',
        severity: 'warning',
      })
    );
  });

  it('warns on $json usage', () => {
    const workflow = createWorkflow({
      nodes: [
        {
          id: '1',
          name: 'set_node',
          type: 'n8n-nodes-base.set',
          typeVersion: 1,
          position: [0, 0],
          parameters: { value: '={{ $json.field }}' },
        },
      ],
    });

    const result = validateWorkflow(workflow);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        rule: 'explicit_reference',
        severity: 'warning',
      })
    );
  });

  it('warns on hardcoded secrets', () => {
    const workflow = createWorkflow({
      nodes: [
        {
          id: '1',
          name: 'http_node',
          type: 'n8n-nodes-base.httpRequest',
          typeVersion: 1,
          position: [0, 0],
          parameters: { apiKey: 'sk_live_abc123def456' },
        },
      ],
    });

    const result = validateWorkflow(workflow);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        rule: 'no_hardcoded_secrets',
        severity: 'info',
      })
    );
  });

  it('warns on orphan nodes', () => {
    const workflow = createWorkflow({
      nodes: [
        {
          id: '1',
          name: 'orphan_node',
          type: 'n8n-nodes-base.set',
          typeVersion: 1,
          position: [0, 0],
          parameters: {},
        },
      ],
      connections: {},
    });

    const result = validateWorkflow(workflow);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        rule: 'orphan_node',
        severity: 'warning',
      })
    );
  });

  it('info on code node usage', () => {
    const workflow = createWorkflow({
      nodes: [
        {
          id: '1',
          name: 'my_code',
          type: 'n8n-nodes-base.code',
          typeVersion: 1,
          position: [0, 0],
          parameters: { jsCode: 'return items;' },
        },
      ],
    });

    const result = validateWorkflow(workflow);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        rule: 'code_node_usage',
        severity: 'info',
      })
    );
  });

  it('warns on AI node without structured output settings', () => {
    const workflow = createWorkflow({
      nodes: [
        {
          id: '1',
          name: 'ai_agent',
          type: '@n8n/n8n-nodes-langchain.agent',
          typeVersion: 1,
          position: [0, 0],
          parameters: {
            outputParser: true,
            schemaType: 'manual',
            // Missing promptType: 'define' and hasOutputParser: true
          },
        },
      ],
    });

    const result = validateWorkflow(workflow);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        rule: 'ai_structured_output',
        severity: 'warning',
      })
    );
  });

  it('passes AI node with correct structured output settings', () => {
    const workflow = createWorkflow({
      nodes: [
        {
          id: '1',
          name: 'ai_agent',
          type: '@n8n/n8n-nodes-langchain.agent',
          typeVersion: 1,
          position: [0, 0],
          parameters: {
            outputParser: true,
            schemaType: 'manual',
            promptType: 'define',
            hasOutputParser: true,
          },
        },
      ],
    });

    const result = validateWorkflow(workflow);
    const aiWarnings = result.warnings.filter((w) => w.rule === 'ai_structured_output');
    expect(aiWarnings).toHaveLength(0);
  });

  it('warns on in-memory storage nodes', () => {
    const workflow = createWorkflow({
      nodes: [
        {
          id: '1',
          name: 'memory_buffer',
          type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
          typeVersion: 1,
          position: [0, 0],
          parameters: {},
        },
      ],
    });

    const result = validateWorkflow(workflow);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({
        rule: 'in_memory_storage',
        severity: 'warning',
      })
    );
  });
});

describe('validatePartialUpdate', () => {
  it('errors when node not found', () => {
    const workflow = createWorkflow();
    const warnings = validatePartialUpdate(workflow, 'nonexistent', {});

    expect(warnings).toContainEqual(
      expect.objectContaining({
        rule: 'node_exists',
        severity: 'error',
      })
    );
  });

  it('errors on parameter loss', () => {
    const workflow = createWorkflow({
      nodes: [
        {
          id: '1',
          name: 'my_node',
          type: 'n8n-nodes-base.set',
          typeVersion: 1,
          position: [0, 0],
          parameters: { existingParam: 'value', anotherParam: 'value2' },
        },
      ],
    });

    const warnings = validatePartialUpdate(workflow, 'my_node', {
      newParam: 'value', // Missing existingParam and anotherParam
    });

    expect(warnings).toContainEqual(
      expect.objectContaining({
        rule: 'parameter_preservation',
        severity: 'error',
      })
    );
  });

  it('passes when all parameters preserved', () => {
    const workflow = createWorkflow({
      nodes: [
        {
          id: '1',
          name: 'my_node',
          type: 'n8n-nodes-base.set',
          typeVersion: 1,
          position: [0, 0],
          parameters: { existingParam: 'value' },
        },
      ],
    });

    const warnings = validatePartialUpdate(workflow, 'my_node', {
      existingParam: 'value',
      newParam: 'new',
    });

    expect(warnings).toHaveLength(0);
  });
});
