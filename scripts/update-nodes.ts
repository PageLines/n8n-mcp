#!/usr/bin/env npx tsx
/**
 * Fetch n8n node types from official repo and generate node-registry.json
 * Run: npx tsx scripts/update-nodes.ts
 */

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface NodeEntry {
  type: string;
  name: string;
  category: string;
}

// Core nodes that are always available (special handling)
const CORE_CATEGORIES: Record<string, string> = {
  'Code': 'Core',
  'ExecuteWorkflow': 'Flow',
  'ExecuteWorkflowTrigger': 'Triggers',
  'Filter': 'Core',
  'Function': 'Core',
  'FunctionItem': 'Core',
  'If': 'Core',
  'ItemLists': 'Core',
  'Merge': 'Core',
  'NoOp': 'Flow',
  'Set': 'Core',
  'SplitInBatches': 'Core',
  'Switch': 'Core',
  'Wait': 'Flow',
  'Webhook': 'Triggers',
  'HttpRequest': 'HTTP',
  'RespondToWebhook': 'HTTP',
  'ManualTrigger': 'Triggers',
  'ScheduleTrigger': 'Triggers',
  'Cron': 'Triggers',
  'ErrorTrigger': 'Triggers',
  'WorkflowTrigger': 'Triggers',
  'StopAndError': 'Flow',
  'NoChatTrigger': 'Triggers',
  'ChatTrigger': 'Triggers',
};

function deriveCategory(folder: string, name: string): string {
  // Check core categories first
  if (CORE_CATEGORIES[name]) {
    return CORE_CATEGORIES[name];
  }

  // Triggers
  if (name.endsWith('Trigger')) {
    return 'Triggers';
  }

  // Use top-level folder as category for nested paths
  const parts = folder.split('/');
  if (parts.length > 1) {
    return parts[0]; // e.g., "Google/Sheet" → "Google"
  }

  return 'Integration';
}

async function main() {
  console.log('Fetching n8n-nodes-base package.json...');

  const response = await fetch(
    'https://raw.githubusercontent.com/n8n-io/n8n/master/packages/nodes-base/package.json'
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status}`);
  }

  const pkg = await response.json();
  const nodePaths: string[] = pkg.n8n?.nodes || [];

  console.log(`Found ${nodePaths.length} node paths`);

  const seen = new Set<string>();
  const nodes: NodeEntry[] = [];

  for (const path of nodePaths) {
    // Parse path: "dist/nodes/Slack/Slack.node.js" or "dist/nodes/Google/Sheet/GoogleSheets.node.js"
    const match = path.match(/dist\/nodes\/(.+?)\.node\.js$/);
    if (!match) continue;

    const fullPath = match[1]; // "Slack/Slack" or "Google/Sheet/GoogleSheets"
    const parts = fullPath.split('/');
    const fileName = parts.pop()!; // "Slack" or "GoogleSheets"
    const folder = parts.join('/'); // "Slack" or "Google/Sheet"

    // Derive the n8n type name (lowercase, camelCase preserved)
    // n8n uses lowercase for the type suffix
    const typeName = fileName.replace(/([A-Z])/g, (m, p1, offset) =>
      offset === 0 ? p1.toLowerCase() : p1
    );

    const type = `n8n-nodes-base.${typeName.charAt(0).toLowerCase() + typeName.slice(1)}`;

    // Skip duplicates
    if (seen.has(type)) continue;
    seen.add(type);

    nodes.push({
      type,
      name: fileName,
      category: deriveCategory(folder || fileName, fileName),
    });
  }

  // Sort by name
  nodes.sort((a, b) => a.name.localeCompare(b.name));

  console.log(`Parsed ${nodes.length} unique nodes`);

  // Write to src/node-registry.json
  const outputPath = resolve(__dirname, '../src/node-registry.json');
  writeFileSync(outputPath, JSON.stringify(nodes, null, 2));

  console.log(`Written to ${outputPath}`);

  // Print categories summary
  const categories = new Map<string, number>();
  for (const node of nodes) {
    categories.set(node.category, (categories.get(node.category) || 0) + 1);
  }
  console.log('\nCategories:');
  for (const [cat, count] of [...categories.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
