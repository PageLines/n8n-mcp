import { describe, it, expect } from 'vitest';
import { searchNodeTypes, getCategories, getNodeCount, nodeTypeExists } from './node-registry.js';

describe('node-registry', () => {
  describe('searchNodeTypes', () => {
    it('returns nodes when no filters applied', () => {
      const results = searchNodeTypes({ limit: 10 });
      expect(results.length).toBe(10);
      expect(results[0]).toHaveProperty('type');
      expect(results[0]).toHaveProperty('name');
      expect(results[0]).toHaveProperty('category');
    });

    it('filters by search term (case-insensitive)', () => {
      const results = searchNodeTypes({ search: 'slack' });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((n) => n.name.toLowerCase().includes('slack'))).toBe(true);
    });

    it('filters by category', () => {
      const results = searchNodeTypes({ category: 'Triggers' });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((n) => n.category === 'Triggers')).toBe(true);
    });

    it('filters by category case-insensitively', () => {
      const results = searchNodeTypes({ category: 'triggers' });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((n) => n.category === 'Triggers')).toBe(true);
    });

    it('combines search and category filters', () => {
      const results = searchNodeTypes({ search: 'webhook', category: 'Triggers' });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((n) => n.category === 'Triggers')).toBe(true);
      expect(results.every((n) => n.name.toLowerCase().includes('webhook'))).toBe(true);
    });

    it('respects limit', () => {
      const results = searchNodeTypes({ limit: 5 });
      expect(results.length).toBe(5);
    });

    it('returns empty array for no matches', () => {
      const results = searchNodeTypes({ search: 'nonexistentnodetype123' });
      expect(results).toEqual([]);
    });
  });

  describe('getCategories', () => {
    it('returns array of category strings', () => {
      const categories = getCategories();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
      expect(categories).toContain('Triggers');
      expect(categories).toContain('Core');
      expect(categories).toContain('Integration');
    });

    it('returns sorted categories', () => {
      const categories = getCategories();
      const sorted = [...categories].sort();
      expect(categories).toEqual(sorted);
    });
  });

  describe('getNodeCount', () => {
    it('returns total node count', () => {
      const count = getNodeCount();
      expect(count).toBeGreaterThan(400); // n8n has 400+ built-in nodes
    });
  });

  describe('nodeTypeExists', () => {
    it('returns true for existing node type', () => {
      expect(nodeTypeExists('n8n-nodes-base.webhook')).toBe(true);
      expect(nodeTypeExists('n8n-nodes-base.set')).toBe(true);
      expect(nodeTypeExists('n8n-nodes-base.if')).toBe(true);
    });

    it('returns false for non-existing node type', () => {
      expect(nodeTypeExists('n8n-nodes-base.nonexistent')).toBe(false);
      expect(nodeTypeExists('some-random-type')).toBe(false);
    });
  });
});
