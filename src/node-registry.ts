/**
 * Static node registry for n8n node types
 * Generated from n8n-nodes-base package via scripts/update-nodes.ts
 */

import nodeData from './node-registry.json' with { type: 'json' };

export interface NodeTypeEntry {
  type: string;
  name: string;
  category: string;
}

// Type assertion for imported JSON
const NODE_REGISTRY: NodeTypeEntry[] = nodeData as NodeTypeEntry[];

export interface NodeSearchOptions {
  search?: string;
  category?: string;
  limit?: number;
}

/**
 * Search node types with optional filtering
 */
export function searchNodeTypes(options: NodeSearchOptions = {}): NodeTypeEntry[] {
  const { search, category, limit = 100 } = options;

  let results = NODE_REGISTRY;

  // Filter by category (case-insensitive)
  if (category) {
    const categoryLower = category.toLowerCase();
    results = results.filter((n) => n.category.toLowerCase() === categoryLower);
  }

  // Search by name or type (case-insensitive, fuzzy)
  if (search) {
    const searchLower = search.toLowerCase();
    results = results.filter(
      (n) =>
        n.name.toLowerCase().includes(searchLower) ||
        n.type.toLowerCase().includes(searchLower)
    );
  }

  // Apply limit
  return results.slice(0, limit);
}

/**
 * Get all available categories
 */
export function getCategories(): string[] {
  const categories = new Set(NODE_REGISTRY.map((n) => n.category));
  return [...categories].sort();
}

/**
 * Get total node count
 */
export function getNodeCount(): number {
  return NODE_REGISTRY.length;
}

/**
 * Check if a node type exists in the registry
 */
export function nodeTypeExists(type: string): boolean {
  return NODE_REGISTRY.some((n) => n.type === type);
}
