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
});
