import { describe, it, expect } from 'vitest';
import { autofixWorkflow, formatWorkflow, toSnakeCase } from './autofix.js';
import type { N8nWorkflow, ValidationWarning } from './types.js';

// ─────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────

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

const createWarning = (overrides: Partial<ValidationWarning> = {}): ValidationWarning => ({
  rule: 'test_rule',
  message: 'Test message',
  severity: 'warning',
  ...overrides,
});

// ─────────────────────────────────────────────────────────────
// toSnakeCase
// ─────────────────────────────────────────────────────────────

describe('toSnakeCase', () => {
  it('converts camelCase', () => {
    expect(toSnakeCase('myWorkflowName')).toBe('my_workflow_name');
  });

  it('converts PascalCase', () => {
    expect(toSnakeCase('MyWorkflowName')).toBe('my_workflow_name');
  });

  it('converts kebab-case', () => {
    expect(toSnakeCase('my-workflow-name')).toBe('my_workflow_name');
  });

  it('converts spaces', () => {
    expect(toSnakeCase('My Workflow Name')).toBe('my_workflow_name');
  });

  it('handles mixed formats', () => {
    expect(toSnakeCase('My-Workflow Name')).toBe('my_workflow_name');
  });

  it('collapses multiple underscores', () => {
    expect(toSnakeCase('my__workflow')).toBe('my_workflow');
  });

  it('leaves valid snake_case unchanged', () => {
    expect(toSnakeCase('my_workflow_name')).toBe('my_workflow_name');
  });

  it('handles single word', () => {
    expect(toSnakeCase('Workflow')).toBe('workflow');
  });

  it('handles empty string', () => {
    expect(toSnakeCase('')).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────
// autofixWorkflow
// ─────────────────────────────────────────────────────────────

describe('autofixWorkflow', () => {
  describe('pure function behavior', () => {
    it('does not mutate input workflow', () => {
      const original = createWorkflow({ name: 'MyWorkflow' });
      const originalCopy = JSON.stringify(original);

      autofixWorkflow(original, [createWarning({ rule: 'snake_case' })]);

      expect(JSON.stringify(original)).toBe(originalCopy);
    });

    it('returns new workflow object', () => {
      const original = createWorkflow();
      const result = autofixWorkflow(original, []);

      expect(result.workflow).not.toBe(original);
    });
  });

  describe('snake_case fixes', () => {
    it('fixes workflow name', () => {
      const workflow = createWorkflow({ name: 'MyWorkflow' });
      const warnings = [createWarning({ rule: 'snake_case' })];

      const result = autofixWorkflow(workflow, warnings);

      expect(result.workflow.name).toBe('my_workflow');
      expect(result.fixes).toHaveLength(1);
      expect(result.fixes[0]).toMatchObject({
        type: 'rename',
        target: 'workflow',
        before: 'MyWorkflow',
        after: 'my_workflow',
      });
    });

    it('fixes node name', () => {
      const workflow = createWorkflow({
        nodes: [{
          id: '1',
          name: 'MyNode',
          type: 'n8n-nodes-base.set',
          typeVersion: 1,
          position: [0, 0],
          parameters: {},
        }],
      });
      const warnings = [createWarning({ rule: 'snake_case', node: 'MyNode' })];

      const result = autofixWorkflow(workflow, warnings);

      expect(result.workflow.nodes[0].name).toBe('my_node');
      expect(result.fixes[0]).toMatchObject({
        type: 'rename',
        target: 'node:MyNode',
        before: 'MyNode',
        after: 'my_node',
      });
    });

    it('updates connection sources when renaming node', () => {
      const workflow = createWorkflow({
        nodes: [
          { id: '1', name: 'SourceNode', type: 'n8n-nodes-base.set', typeVersion: 1, position: [0, 0], parameters: {} },
          { id: '2', name: 'target_node', type: 'n8n-nodes-base.set', typeVersion: 1, position: [100, 0], parameters: {} },
        ],
        connections: {
          'SourceNode': { main: [[{ node: 'target_node', type: 'main', index: 0 }]] },
        },
      });
      const warnings = [createWarning({ rule: 'snake_case', node: 'SourceNode' })];

      const result = autofixWorkflow(workflow, warnings);

      expect(result.workflow.connections['source_node']).toBeDefined();
      expect(result.workflow.connections['SourceNode']).toBeUndefined();
    });

    it('updates connection targets when renaming node', () => {
      const workflow = createWorkflow({
        nodes: [
          { id: '1', name: 'source_node', type: 'n8n-nodes-base.set', typeVersion: 1, position: [0, 0], parameters: {} },
          { id: '2', name: 'TargetNode', type: 'n8n-nodes-base.set', typeVersion: 1, position: [100, 0], parameters: {} },
        ],
        connections: {
          'source_node': { main: [[{ node: 'TargetNode', type: 'main', index: 0 }]] },
        },
      });
      const warnings = [createWarning({ rule: 'snake_case', node: 'TargetNode' })];

      const result = autofixWorkflow(workflow, warnings);

      expect(result.workflow.connections['source_node'].main[0][0].node).toBe('target_node');
    });

    it('skips fix if already snake_case', () => {
      const workflow = createWorkflow({ name: 'my_workflow' });
      const warnings = [createWarning({ rule: 'snake_case' })];

      const result = autofixWorkflow(workflow, warnings);

      expect(result.fixes).toHaveLength(0);
      expect(result.unfixable).toHaveLength(1);
    });
  });

  describe('explicit_reference fixes', () => {
    it('replaces $json with explicit node reference', () => {
      const workflow = createWorkflow({
        nodes: [
          { id: '1', name: 'trigger', type: 'n8n-nodes-base.webhook', typeVersion: 1, position: [0, 0], parameters: {} },
          { id: '2', name: 'process', type: 'n8n-nodes-base.set', typeVersion: 1, position: [100, 0], parameters: { value: '={{ $json.field }}' } },
        ],
        connections: {
          'trigger': { main: [[{ node: 'process', type: 'main', index: 0 }]] },
        },
      });
      const warnings = [createWarning({ rule: 'explicit_reference', node: 'process' })];

      const result = autofixWorkflow(workflow, warnings);

      expect(result.workflow.nodes[1].parameters.value).toBe("={{ $('trigger').item.json.field }}");
      expect(result.fixes[0]).toMatchObject({
        type: 'expression_fix',
        target: 'node:process',
      });
    });

    it('handles template syntax', () => {
      const workflow = createWorkflow({
        nodes: [
          { id: '1', name: 'trigger', type: 'n8n-nodes-base.webhook', typeVersion: 1, position: [0, 0], parameters: {} },
          { id: '2', name: 'process', type: 'n8n-nodes-base.set', typeVersion: 1, position: [100, 0], parameters: { value: '{{ $json.field }}' } },
        ],
        connections: {
          'trigger': { main: [[{ node: 'process', type: 'main', index: 0 }]] },
        },
      });
      const warnings = [createWarning({ rule: 'explicit_reference', node: 'process' })];

      const result = autofixWorkflow(workflow, warnings);

      expect(result.workflow.nodes[1].parameters.value).toBe("{{ $('trigger').item.json.field }}");
    });

    it('returns unfixable when no previous node found', () => {
      const workflow = createWorkflow({
        nodes: [
          { id: '1', name: 'orphan', type: 'n8n-nodes-base.set', typeVersion: 1, position: [0, 0], parameters: { value: '={{ $json.field }}' } },
        ],
        connections: {},
      });
      const warnings = [createWarning({ rule: 'explicit_reference', node: 'orphan' })];

      const result = autofixWorkflow(workflow, warnings);

      expect(result.fixes).toHaveLength(0);
      expect(result.unfixable).toHaveLength(1);
    });
  });

  describe('ai_structured_output fixes', () => {
    it('adds promptType and hasOutputParser', () => {
      const workflow = createWorkflow({
        nodes: [{
          id: '1',
          name: 'ai_agent',
          type: '@n8n/n8n-nodes-langchain.agent',
          typeVersion: 1,
          position: [0, 0],
          parameters: { outputParser: true },
        }],
      });
      const warnings = [createWarning({ rule: 'ai_structured_output', node: 'ai_agent' })];

      const result = autofixWorkflow(workflow, warnings);

      expect(result.workflow.nodes[0].parameters).toMatchObject({
        promptType: 'define',
        hasOutputParser: true,
      });
      expect(result.fixes[0]).toMatchObject({
        type: 'parameter_fix',
        target: 'node:ai_agent',
      });
    });

    it('preserves existing parameters', () => {
      const workflow = createWorkflow({
        nodes: [{
          id: '1',
          name: 'ai_agent',
          type: '@n8n/n8n-nodes-langchain.agent',
          typeVersion: 1,
          position: [0, 0],
          parameters: { outputParser: true, schemaType: 'manual', existingParam: 'value' },
        }],
      });
      const warnings = [createWarning({ rule: 'ai_structured_output', node: 'ai_agent' })];

      const result = autofixWorkflow(workflow, warnings);

      expect(result.workflow.nodes[0].parameters.existingParam).toBe('value');
    });

    it('skips fix if settings already correct', () => {
      const workflow = createWorkflow({
        nodes: [{
          id: '1',
          name: 'ai_agent',
          type: '@n8n/n8n-nodes-langchain.agent',
          typeVersion: 1,
          position: [0, 0],
          parameters: { promptType: 'define', hasOutputParser: true },
        }],
      });
      const warnings = [createWarning({ rule: 'ai_structured_output', node: 'ai_agent' })];

      const result = autofixWorkflow(workflow, warnings);

      expect(result.fixes).toHaveLength(0);
      expect(result.unfixable).toHaveLength(1);
    });
  });

  describe('unfixable warnings', () => {
    it('returns unfixable for hardcoded secrets', () => {
      const workflow = createWorkflow();
      const warnings = [createWarning({ rule: 'no_hardcoded_secrets' })];

      const result = autofixWorkflow(workflow, warnings);

      expect(result.fixes).toHaveLength(0);
      expect(result.unfixable).toHaveLength(1);
      expect(result.unfixable[0].rule).toBe('no_hardcoded_secrets');
    });

    it('returns unfixable for orphan nodes', () => {
      const workflow = createWorkflow();
      const warnings = [createWarning({ rule: 'orphan_node' })];

      const result = autofixWorkflow(workflow, warnings);

      expect(result.unfixable[0].rule).toBe('orphan_node');
    });

    it('returns unfixable for code node usage', () => {
      const workflow = createWorkflow();
      const warnings = [createWarning({ rule: 'code_node_usage' })];

      const result = autofixWorkflow(workflow, warnings);

      expect(result.unfixable[0].rule).toBe('code_node_usage');
    });
  });

  describe('multiple fixes', () => {
    it('applies multiple fixes in sequence', () => {
      const workflow = createWorkflow({
        name: 'MyWorkflow',
        nodes: [
          { id: '1', name: 'MyTrigger', type: 'n8n-nodes-base.webhook', typeVersion: 1, position: [0, 0], parameters: {} },
        ],
      });
      const warnings = [
        createWarning({ rule: 'snake_case' }),
        createWarning({ rule: 'snake_case', node: 'MyTrigger' }),
      ];

      const result = autofixWorkflow(workflow, warnings);

      expect(result.workflow.name).toBe('my_workflow');
      expect(result.workflow.nodes[0].name).toBe('my_trigger');
      expect(result.fixes).toHaveLength(2);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// formatWorkflow
// ─────────────────────────────────────────────────────────────

describe('formatWorkflow', () => {
  describe('pure function behavior', () => {
    it('does not mutate input workflow', () => {
      const original = createWorkflow({
        nodes: [{ id: '1', name: 'test', type: 'n8n-nodes-base.set', typeVersion: 1, position: [500, 500], parameters: {} }],
      });
      const originalCopy = JSON.stringify(original);

      formatWorkflow(original);

      expect(JSON.stringify(original)).toBe(originalCopy);
    });

    it('returns new workflow object', () => {
      const original = createWorkflow();
      const result = formatWorkflow(original);

      expect(result).not.toBe(original);
    });
  });

  describe('position calculation', () => {
    it('handles empty workflow', () => {
      const workflow = createWorkflow({ nodes: [] });
      const result = formatWorkflow(workflow);

      expect(result.nodes).toHaveLength(0);
    });

    it('positions single node', () => {
      const workflow = createWorkflow({
        nodes: [{ id: '1', name: 'test', type: 'n8n-nodes-base.set', typeVersion: 1, position: [999, 999], parameters: {} }],
      });

      const result = formatWorkflow(workflow);

      // Should have valid position (exact values depend on dagre margins)
      expect(result.nodes[0].position).toHaveLength(2);
      expect(typeof result.nodes[0].position[0]).toBe('number');
      expect(typeof result.nodes[0].position[1]).toBe('number');
    });

    it('positions connected nodes left-to-right', () => {
      const workflow = createWorkflow({
        nodes: [
          { id: '1', name: 'trigger', type: 'n8n-nodes-base.webhook', typeVersion: 1, position: [0, 0], parameters: {} },
          { id: '2', name: 'process', type: 'n8n-nodes-base.set', typeVersion: 1, position: [0, 0], parameters: {} },
        ],
        connections: {
          'trigger': { main: [[{ node: 'process', type: 'main', index: 0 }]] },
        },
      });

      const result = formatWorkflow(workflow);

      // trigger should be left of process
      expect(result.nodes[0].position[0]).toBeLessThan(result.nodes[1].position[0]);
    });

    it('handles branching workflows', () => {
      const workflow = createWorkflow({
        nodes: [
          { id: '1', name: 'trigger', type: 'n8n-nodes-base.webhook', typeVersion: 1, position: [0, 0], parameters: {} },
          { id: '2', name: 'branch_a', type: 'n8n-nodes-base.set', typeVersion: 1, position: [0, 0], parameters: {} },
          { id: '3', name: 'branch_b', type: 'n8n-nodes-base.set', typeVersion: 1, position: [0, 0], parameters: {} },
        ],
        connections: {
          'trigger': { main: [[{ node: 'branch_a', type: 'main', index: 0 }, { node: 'branch_b', type: 'main', index: 0 }]] },
        },
      });

      const result = formatWorkflow(workflow);

      // Both branches should be right of trigger
      const triggerX = result.nodes.find(n => n.name === 'trigger')!.position[0];
      const branchAX = result.nodes.find(n => n.name === 'branch_a')!.position[0];
      const branchBX = result.nodes.find(n => n.name === 'branch_b')!.position[0];

      expect(branchAX).toBeGreaterThan(triggerX);
      expect(branchBX).toBeGreaterThan(triggerX);
    });
  });

  describe('parameter cleanup', () => {
    it('removes null values from parameters', () => {
      const workflow = createWorkflow({
        nodes: [{
          id: '1',
          name: 'test',
          type: 'n8n-nodes-base.set',
          typeVersion: 1,
          position: [0, 0],
          parameters: { valid: 'value', nullVal: null },
        }],
      });

      const result = formatWorkflow(workflow);

      expect(result.nodes[0].parameters.valid).toBe('value');
      expect('nullVal' in result.nodes[0].parameters).toBe(false);
    });

    it('removes undefined values from parameters', () => {
      const workflow = createWorkflow({
        nodes: [{
          id: '1',
          name: 'test',
          type: 'n8n-nodes-base.set',
          typeVersion: 1,
          position: [0, 0],
          parameters: { valid: 'value', undefinedVal: undefined },
        }],
      });

      const result = formatWorkflow(workflow);

      expect(result.nodes[0].parameters.valid).toBe('value');
      expect('undefinedVal' in result.nodes[0].parameters).toBe(false);
    });

    it('recursively cleans nested objects', () => {
      const workflow = createWorkflow({
        nodes: [{
          id: '1',
          name: 'test',
          type: 'n8n-nodes-base.set',
          typeVersion: 1,
          position: [0, 0],
          parameters: {
            nested: {
              valid: 'value',
              nullVal: null,
              deeper: { alsoNull: null, keep: 'this' }
            }
          },
        }],
      });

      const result = formatWorkflow(workflow);

      const nested = result.nodes[0].parameters.nested as Record<string, unknown>;
      expect(nested.valid).toBe('value');
      expect('nullVal' in nested).toBe(false);

      const deeper = nested.deeper as Record<string, unknown>;
      expect(deeper.keep).toBe('this');
      expect('alsoNull' in deeper).toBe(false);
    });

    it('preserves arrays', () => {
      const workflow = createWorkflow({
        nodes: [{
          id: '1',
          name: 'test',
          type: 'n8n-nodes-base.set',
          typeVersion: 1,
          position: [0, 0],
          parameters: { items: [1, 2, 3] },
        }],
      });

      const result = formatWorkflow(workflow);

      expect(result.nodes[0].parameters.items).toEqual([1, 2, 3]);
    });
  });

  describe('node sorting', () => {
    it('sorts nodes by position for consistent output', () => {
      const workflow = createWorkflow({
        nodes: [
          { id: '3', name: 'third', type: 'n8n-nodes-base.set', typeVersion: 1, position: [300, 0], parameters: {} },
          { id: '1', name: 'first', type: 'n8n-nodes-base.set', typeVersion: 1, position: [100, 0], parameters: {} },
          { id: '2', name: 'second', type: 'n8n-nodes-base.set', typeVersion: 1, position: [200, 0], parameters: {} },
        ],
        connections: {
          'first': { main: [[{ node: 'second', type: 'main', index: 0 }]] },
          'second': { main: [[{ node: 'third', type: 'main', index: 0 }]] },
        },
      });

      const result = formatWorkflow(workflow);

      // Nodes should be sorted left-to-right based on dagre layout
      const positions = result.nodes.map(n => n.position[0]);
      const sortedPositions = [...positions].sort((a, b) => a - b);
      expect(positions).toEqual(sortedPositions);
    });
  });
});
