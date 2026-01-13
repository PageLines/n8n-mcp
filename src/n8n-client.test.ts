import { describe, it, expect, vi, beforeEach } from 'vitest';
import { N8nClient } from './n8n-client.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('N8nClient', () => {
  let client: N8nClient;

  beforeEach(() => {
    client = new N8nClient({
      apiUrl: 'https://n8n.example.com',
      apiKey: 'test-api-key',
    });
    mockFetch.mockReset();
  });

  describe('constructor', () => {
    it('normalizes URL by removing trailing slash', () => {
      const clientWithSlash = new N8nClient({
        apiUrl: 'https://n8n.example.com/',
        apiKey: 'key',
      });
      // Access private property for testing
      expect((clientWithSlash as any).baseUrl).toBe('https://n8n.example.com');
    });
  });

  describe('listWorkflows', () => {
    it('calls correct endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ data: [] }),
      });

      await client.listWorkflows();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://n8n.example.com/api/v1/workflows',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-N8N-API-KEY': 'test-api-key',
          }),
        })
      );
    });

    it('includes query params when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ data: [] }),
      });

      await client.listWorkflows({ active: true, limit: 10 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('active=true'),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10'),
        expect.any(Object)
      );
    });
  });

  describe('patchWorkflow', () => {
    const mockWorkflow = {
      id: '1',
      name: 'test_workflow',
      active: false,
      nodes: [
        {
          id: 'node1',
          name: 'existing_node',
          type: 'n8n-nodes-base.set',
          typeVersion: 1,
          position: [0, 0] as [number, number],
          parameters: { param1: 'value1', param2: 'value2' },
        },
      ],
      connections: {},
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    beforeEach(() => {
      // Mock GET workflow
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockWorkflow),
      });
      // Mock PUT workflow
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockWorkflow),
      });
    });

    it('warns when updateNode would remove parameters', async () => {
      const { warnings } = await client.patchWorkflow('1', [
        {
          type: 'updateNode',
          nodeName: 'existing_node',
          properties: {
            parameters: { newParam: 'newValue' }, // Missing param1, param2
          },
        },
      ]);

      expect(warnings).toContainEqual(
        expect.stringContaining('remove parameters')
      );
      expect(warnings).toContainEqual(
        expect.stringContaining('param1')
      );
    });

    it('warns when removing non-existent node', async () => {
      const { warnings } = await client.patchWorkflow('1', [
        {
          type: 'removeNode',
          nodeName: 'nonexistent_node',
        },
      ]);

      expect(warnings).toContainEqual(
        expect.stringContaining('not found')
      );
    });

    it('adds node correctly', async () => {
      mockFetch.mockReset();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockWorkflow),
      });

      const updatedWorkflow = {
        ...mockWorkflow,
        nodes: [
          ...mockWorkflow.nodes,
          {
            id: 'new-id',
            name: 'new_node',
            type: 'n8n-nodes-base.code',
            typeVersion: 1,
            position: [100, 100],
            parameters: {},
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(updatedWorkflow),
      });

      const { workflow } = await client.patchWorkflow('1', [
        {
          type: 'addNode',
          node: {
            name: 'new_node',
            type: 'n8n-nodes-base.code',
            typeVersion: 1,
            position: [100, 100],
            parameters: {},
          },
        },
      ]);

      // Verify PUT was called with the new node
      const putCall = mockFetch.mock.calls[1];
      const putBody = JSON.parse(putCall[1].body);
      expect(putBody.nodes).toHaveLength(2);
      expect(putBody.nodes[1].name).toBe('new_node');
    });

    it('adds connection correctly', async () => {
      mockFetch.mockReset();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockWorkflow),
      });

      const updatedWorkflow = {
        ...mockWorkflow,
        connections: {
          existing_node: {
            main: [[{ node: 'target_node', type: 'main', index: 0 }]],
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(updatedWorkflow),
      });

      await client.patchWorkflow('1', [
        {
          type: 'addConnection',
          from: 'existing_node',
          to: 'target_node',
        },
      ]);

      const putCall = mockFetch.mock.calls[1];
      const putBody = JSON.parse(putCall[1].body);
      expect(putBody.connections.existing_node.main[0][0].node).toBe('target_node');
    });
  });

  describe('error handling', () => {
    it('throws on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not found',
      });

      await expect(client.getWorkflow('999')).rejects.toThrow('n8n API error (404)');
    });
  });

  describe('listNodeTypes', () => {
    it('calls correct endpoint', async () => {
      const mockNodeTypes = [
        {
          name: 'n8n-nodes-base.webhook',
          displayName: 'Webhook',
          description: 'Starts workflow on webhook call',
          group: ['trigger'],
          version: 2,
        },
        {
          name: 'n8n-nodes-base.set',
          displayName: 'Set',
          description: 'Set values',
          group: ['transform'],
          version: 3,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(mockNodeTypes),
      });

      const result = await client.listNodeTypes();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://n8n.example.com/api/v1/nodes',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-N8N-API-KEY': 'test-api-key',
          }),
        })
      );

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('n8n-nodes-base.webhook');
      expect(result[1].name).toBe('n8n-nodes-base.set');
    });
  });

  describe('updateWorkflow', () => {
    it('strips disallowed properties before sending to API', async () => {
      const fullWorkflow = {
        id: '123',
        name: 'test_workflow',
        active: true,
        nodes: [{ id: 'n1', name: 'node1', type: 'test', typeVersion: 1, position: [0, 0] as [number, number], parameters: {} }],
        connections: {},
        settings: { timezone: 'UTC' },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
        versionId: 'v1',
        staticData: undefined,
        tags: [{ id: 't1', name: 'tag1' }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(fullWorkflow),
      });

      await client.updateWorkflow('123', fullWorkflow);

      // Verify the request body does NOT contain disallowed properties
      const putCall = mockFetch.mock.calls[0];
      const putBody = JSON.parse(putCall[1].body);

      // These should be stripped
      expect(putBody.id).toBeUndefined();
      expect(putBody.createdAt).toBeUndefined();
      expect(putBody.updatedAt).toBeUndefined();
      expect(putBody.active).toBeUndefined();
      expect(putBody.versionId).toBeUndefined();

      // These should be preserved
      expect(putBody.name).toBe('test_workflow');
      expect(putBody.nodes).toHaveLength(1);
      expect(putBody.connections).toEqual({});
      expect(putBody.settings).toEqual({ timezone: 'UTC' });
      expect(putBody.staticData).toBeUndefined();
      expect(putBody.tags).toEqual([{ id: 't1', name: 'tag1' }]);
    });

    it('works with partial workflow (only some fields)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify({ id: '123', name: 'updated' }),
      });

      await client.updateWorkflow('123', { name: 'updated', nodes: [] });

      const putCall = mockFetch.mock.calls[0];
      const putBody = JSON.parse(putCall[1].body);

      expect(putBody.name).toBe('updated');
      expect(putBody.nodes).toEqual([]);
    });

    it('handles workflow from formatWorkflow (simulating workflow_format apply)', async () => {
      // This simulates the exact scenario that caused the bug:
      // workflow_format returns a full N8nWorkflow object with id, createdAt, etc.
      const formattedWorkflow = {
        id: 'zbB1fCxWgZXgpjB1',
        name: 'my_workflow',
        active: false,
        nodes: [],
        connections: {},
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => JSON.stringify(formattedWorkflow),
      });

      // This should NOT throw "must NOT have additional properties"
      await client.updateWorkflow('zbB1fCxWgZXgpjB1', formattedWorkflow);

      const putCall = mockFetch.mock.calls[0];
      const putBody = JSON.parse(putCall[1].body);

      // Critical: these must NOT be in the request body
      expect(putBody.id).toBeUndefined();
      expect(putBody.createdAt).toBeUndefined();
      expect(putBody.updatedAt).toBeUndefined();
      expect(putBody.active).toBeUndefined();

      // Only allowed properties should be sent
      expect(Object.keys(putBody).sort()).toEqual(['connections', 'name', 'nodes']);
    });
  });
});
