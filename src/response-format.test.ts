import { describe, it, expect } from 'vitest';
import {
  formatWorkflowResponse,
  formatExecutionResponse,
  formatExecutionListResponse,
  cleanResponse,
  stringifyResponse,
  type WorkflowSummary,
  type WorkflowCompact,
  type ExecutionSummary,
  type ExecutionCompact,
} from './response-format.js';
import type { N8nWorkflow, N8nExecution, N8nExecutionListItem } from './types.js';

const createWorkflow = (overrides: Partial<N8nWorkflow> = {}): N8nWorkflow => ({
  id: '1',
  name: 'test_workflow',
  active: false,
  nodes: [
    {
      id: 'node1',
      name: 'webhook_trigger',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 1,
      position: [0, 0],
      parameters: { path: 'test', httpMethod: 'POST' },
    },
    {
      id: 'node2',
      name: 'set_data',
      type: 'n8n-nodes-base.set',
      typeVersion: 1,
      position: [200, 0],
      parameters: { values: { string: [{ name: 'key', value: 'value' }] } },
      credentials: { httpBasicAuth: { id: '1', name: 'My Auth' } },
    },
  ],
  connections: {
    webhook_trigger: {
      main: [[{ node: 'set_data', type: 'main', index: 0 }]],
    },
  },
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-02T00:00:00.000Z',
  ...overrides,
});

const createExecution = (overrides: Partial<N8nExecution> = {}): N8nExecution => ({
  id: 'exec1',
  workflowId: '1',
  finished: true,
  mode: 'manual',
  startedAt: '2024-01-01T00:00:00.000Z',
  stoppedAt: '2024-01-01T00:00:05.000Z',
  status: 'success',
  data: {
    resultData: {
      runData: {
        webhook_trigger: [{ data: { main: [[{ json: { test: 'data' } }]] } }],
        set_data: [{ data: { main: [[{ json: { key: 'value' } }]] } }],
      },
    },
  },
  ...overrides,
});

describe('formatWorkflowResponse', () => {
  describe('summary format', () => {
    it('returns minimal workflow info', () => {
      const workflow = createWorkflow();
      const result = formatWorkflowResponse(workflow, 'summary') as WorkflowSummary;

      expect(result.id).toBe('1');
      expect(result.name).toBe('test_workflow');
      expect(result.active).toBe(false);
      expect(result.nodeCount).toBe(2);
      expect(result.connectionCount).toBe(1);
      expect(result.updatedAt).toBe('2024-01-02T00:00:00.000Z');
      expect(result.nodeTypes).toContain('n8n-nodes-base.webhook');
      expect(result.nodeTypes).toContain('n8n-nodes-base.set');
      // Should not have full nodes or connections
      expect((result as any).nodes).toBeUndefined();
      expect((result as any).connections).toBeUndefined();
    });
  });

  describe('compact format', () => {
    it('returns nodes without parameters', () => {
      const workflow = createWorkflow();
      const result = formatWorkflowResponse(workflow, 'compact') as WorkflowCompact;

      expect(result.id).toBe('1');
      expect(result.name).toBe('test_workflow');
      expect(result.nodes).toHaveLength(2);

      // Nodes should have name, type, position but no parameters
      expect(result.nodes[0].name).toBe('webhook_trigger');
      expect(result.nodes[0].type).toBe('n8n-nodes-base.webhook');
      expect(result.nodes[0].position).toEqual([0, 0]);
      expect(result.nodes[0].hasCredentials).toBe(false);
      expect((result.nodes[0] as any).parameters).toBeUndefined();

      // Second node has credentials
      expect(result.nodes[1].hasCredentials).toBe(true);
    });

    it('simplifies connections to node -> [targets] map', () => {
      const workflow = createWorkflow();
      const result = formatWorkflowResponse(workflow, 'compact') as WorkflowCompact;

      expect(result.connections).toEqual({
        webhook_trigger: ['set_data'],
      });
    });

    it('marks disabled nodes', () => {
      const workflow = createWorkflow({
        nodes: [
          {
            id: 'node1',
            name: 'disabled_node',
            type: 'n8n-nodes-base.set',
            typeVersion: 1,
            position: [0, 0],
            parameters: {},
            disabled: true,
          },
        ],
      });
      const result = formatWorkflowResponse(workflow, 'compact') as WorkflowCompact;

      expect(result.nodes[0].disabled).toBe(true);
    });
  });

  describe('full format', () => {
    it('returns complete workflow', () => {
      const workflow = createWorkflow();
      const result = formatWorkflowResponse(workflow, 'full') as N8nWorkflow;

      expect(result).toEqual(workflow);
      expect(result.nodes[0].parameters).toEqual({ path: 'test', httpMethod: 'POST' });
    });
  });

  describe('default format', () => {
    it('defaults to compact', () => {
      const workflow = createWorkflow();
      const result = formatWorkflowResponse(workflow);

      // Should be compact (no parameters)
      expect((result as any).nodes[0].parameters).toBeUndefined();
    });
  });
});

describe('formatExecutionResponse', () => {
  describe('summary format', () => {
    it('returns minimal execution info', () => {
      const execution = createExecution();
      const result = formatExecutionResponse(execution, 'summary') as ExecutionSummary;

      expect(result.id).toBe('exec1');
      expect(result.workflowId).toBe('1');
      expect(result.status).toBe('success');
      expect(result.mode).toBe('manual');
      expect(result.durationMs).toBe(5000);
      expect(result.hasError).toBe(false);
      // Should not have runData
      expect((result as any).data).toBeUndefined();
    });

    it('includes error message when present', () => {
      const execution = createExecution({
        status: 'error',
        data: {
          resultData: {
            error: { message: 'Something went wrong' },
          },
        },
      });
      const result = formatExecutionResponse(execution, 'summary') as ExecutionSummary;

      expect(result.hasError).toBe(true);
      expect(result.errorMessage).toBe('Something went wrong');
    });
  });

  describe('compact format', () => {
    it('returns execution without runData but with node summaries', () => {
      const execution = createExecution();
      const result = formatExecutionResponse(execution, 'compact') as ExecutionCompact;

      expect(result.id).toBe('exec1');
      expect(result.status).toBe('success');
      expect(result.finished).toBe(true);
      // Should have node result summaries
      expect(result.nodeResults).toHaveLength(2);
      expect(result.nodeResults![0].nodeName).toBe('webhook_trigger');
      expect(result.nodeResults![0].itemCount).toBe(1);
      // Should not have full runData
      expect((result as any).data).toBeUndefined();
    });

    it('includes error in compact format', () => {
      const execution = createExecution({
        status: 'error',
        data: {
          resultData: {
            error: { message: 'Failed' },
          },
        },
      });
      const result = formatExecutionResponse(execution, 'compact') as ExecutionCompact;

      expect(result.error).toEqual({ message: 'Failed' });
    });
  });

  describe('full format', () => {
    it('returns complete execution with runData', () => {
      const execution = createExecution();
      const result = formatExecutionResponse(execution, 'full') as N8nExecution;

      expect(result).toEqual(execution);
      expect(result.data?.resultData?.runData).toBeDefined();
    });
  });
});

describe('formatExecutionListResponse', () => {
  const executions: N8nExecutionListItem[] = [
    { id: '1', workflowId: 'w1', status: 'success', startedAt: '2024-01-01', mode: 'manual' },
    { id: '2', workflowId: 'w1', status: 'error', startedAt: '2024-01-02', mode: 'webhook' },
  ];

  it('summary returns id, status, startedAt only', () => {
    const result = formatExecutionListResponse(executions, 'summary');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ id: '1', status: 'success', startedAt: '2024-01-01' });
    expect((result[0] as any).workflowId).toBeUndefined();
    expect((result[0] as any).mode).toBeUndefined();
  });

  it('compact and full return same as input', () => {
    const compactResult = formatExecutionListResponse(executions, 'compact');
    const fullResult = formatExecutionListResponse(executions, 'full');

    expect(compactResult).toEqual(executions);
    expect(fullResult).toEqual(executions);
  });
});

describe('cleanResponse', () => {
  it('removes null values', () => {
    const obj = { a: 1, b: null, c: 'test' };
    const result = cleanResponse(obj);

    expect(result).toEqual({ a: 1, c: 'test' });
  });

  it('removes undefined values', () => {
    const obj = { a: 1, b: undefined, c: 'test' };
    const result = cleanResponse(obj);

    expect(result).toEqual({ a: 1, c: 'test' });
  });

  it('removes empty objects', () => {
    const obj = { a: 1, b: {}, c: 'test' };
    const result = cleanResponse(obj);

    expect(result).toEqual({ a: 1, c: 'test' });
  });

  it('removes empty arrays', () => {
    const obj = { a: 1, b: [], c: 'test' };
    const result = cleanResponse(obj);

    expect(result).toEqual({ a: 1, c: 'test' });
  });

  it('handles nested objects', () => {
    const obj = { a: { b: null, c: 1 }, d: { e: {} } };
    const result = cleanResponse(obj);

    expect(result).toEqual({ a: { c: 1 } });
  });

  it('handles arrays', () => {
    const arr = [{ a: 1, b: null }, { c: 2 }];
    const result = cleanResponse(arr);

    expect(result).toEqual([{ a: 1 }, { c: 2 }]);
  });
});

describe('stringifyResponse', () => {
  it('minifies by default', () => {
    const obj = { a: 1, b: 'test' };
    const result = stringifyResponse(obj);

    expect(result).toBe('{"a":1,"b":"test"}');
    expect(result).not.toContain('\n');
  });

  it('can pretty print when minify=false', () => {
    const obj = { a: 1 };
    const result = stringifyResponse(obj, false);

    expect(result).toContain('\n');
  });

  it('cleans null values before stringifying', () => {
    const obj = { a: 1, b: null };
    const result = stringifyResponse(obj);

    expect(result).toBe('{"a":1}');
  });
});

describe('token reduction estimates', () => {
  it('compact format significantly reduces workflow size', () => {
    const workflow = createWorkflow({
      nodes: Array.from({ length: 10 }, (_, i) => ({
        id: `node${i}`,
        name: `node_${i}`,
        type: 'n8n-nodes-base.set',
        typeVersion: 1,
        position: [i * 200, 0] as [number, number],
        parameters: {
          values: {
            string: Array.from({ length: 10 }, (_, j) => ({
              name: `param_${j}`,
              value: `This is a long value that takes up tokens ${j}`,
            })),
          },
        },
      })),
    });

    const fullJson = JSON.stringify(workflow);
    const compactJson = stringifyResponse(formatWorkflowResponse(workflow, 'compact'));
    const summaryJson = stringifyResponse(formatWorkflowResponse(workflow, 'summary'));

    // Compact should be significantly smaller than full
    expect(compactJson.length).toBeLessThan(fullJson.length * 0.5);
    // Summary should be smallest
    expect(summaryJson.length).toBeLessThan(compactJson.length);

    console.log(`Full: ${fullJson.length} chars, Compact: ${compactJson.length} chars, Summary: ${summaryJson.length} chars`);
    console.log(`Reduction: ${Math.round((1 - compactJson.length / fullJson.length) * 100)}% (compact), ${Math.round((1 - summaryJson.length / fullJson.length) * 100)}% (summary)`);
  });
});
