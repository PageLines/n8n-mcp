/**
 * Local version control for n8n workflows
 * Stores workflow snapshots in ~/.n8n-mcp/versions/
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { N8nWorkflow } from './types.js';

export interface WorkflowVersion {
  id: string;
  workflowId: string;
  workflowName: string;
  timestamp: string;
  reason: string;
  nodeCount: number;
  hash: string;
}

export interface VersionConfig {
  enabled: boolean;
  maxVersions: number;
  storageDir: string;
}

const DEFAULT_CONFIG: VersionConfig = {
  enabled: true,
  maxVersions: 20,
  storageDir: path.join(os.homedir(), '.n8n-mcp', 'versions'),
};

let config: VersionConfig = { ...DEFAULT_CONFIG };

/**
 * Initialize version control with custom config
 */
export function initVersionControl(customConfig: Partial<VersionConfig> = {}): void {
  config = { ...DEFAULT_CONFIG, ...customConfig };
}

/**
 * Get the storage directory for a workflow
 */
function getWorkflowDir(workflowId: string): string {
  return path.join(config.storageDir, workflowId);
}

/**
 * Generate a simple hash for workflow content
 */
function hashWorkflow(workflow: N8nWorkflow): string {
  const content = JSON.stringify({
    nodes: workflow.nodes,
    connections: workflow.connections,
    settings: workflow.settings,
  });
  // Simple hash - good enough for comparison
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Save a workflow version
 */
export async function saveVersion(
  workflow: N8nWorkflow,
  reason: string = 'manual'
): Promise<WorkflowVersion | null> {
  if (!config.enabled) return null;

  const workflowDir = getWorkflowDir(workflow.id);
  await fs.mkdir(workflowDir, { recursive: true });

  const timestamp = new Date().toISOString();
  const hash = hashWorkflow(workflow);

  // Check if this exact version already exists (avoid duplicates)
  const existing = await listVersions(workflow.id);
  if (existing.length > 0 && existing[0].hash === hash) {
    return null; // No changes, skip
  }

  const versionId = `${timestamp.replace(/[:.]/g, '-')}_${hash.slice(0, 6)}`;
  const versionFile = path.join(workflowDir, `${versionId}.json`);

  const versionMeta: WorkflowVersion = {
    id: versionId,
    workflowId: workflow.id,
    workflowName: workflow.name,
    timestamp,
    reason,
    nodeCount: workflow.nodes.length,
    hash,
  };

  const versionData = {
    meta: versionMeta,
    workflow,
  };

  await fs.writeFile(versionFile, JSON.stringify(versionData, null, 2));

  // Prune old versions
  await pruneVersions(workflow.id);

  return versionMeta;
}

/**
 * List all versions for a workflow
 */
export async function listVersions(workflowId: string): Promise<WorkflowVersion[]> {
  const workflowDir = getWorkflowDir(workflowId);

  try {
    const files = await fs.readdir(workflowDir);
    const versions: WorkflowVersion[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const filePath = path.join(workflowDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      if (data.meta) {
        versions.push(data.meta);
      }
    }

    // Sort by timestamp descending (newest first)
    return versions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Get a specific version's full workflow data
 */
export async function getVersion(
  workflowId: string,
  versionId: string
): Promise<{ meta: WorkflowVersion; workflow: N8nWorkflow } | null> {
  const workflowDir = getWorkflowDir(workflowId);
  const versionFile = path.join(workflowDir, `${versionId}.json`);

  try {
    const content = await fs.readFile(versionFile, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Get the most recent version
 */
export async function getLatestVersion(
  workflowId: string
): Promise<{ meta: WorkflowVersion; workflow: N8nWorkflow } | null> {
  const versions = await listVersions(workflowId);
  if (versions.length === 0) return null;
  return getVersion(workflowId, versions[0].id);
}

/**
 * Prune old versions beyond maxVersions
 */
async function pruneVersions(workflowId: string): Promise<number> {
  const versions = await listVersions(workflowId);

  if (versions.length <= config.maxVersions) {
    return 0;
  }

  const toDelete = versions.slice(config.maxVersions);
  const workflowDir = getWorkflowDir(workflowId);

  for (const version of toDelete) {
    const versionFile = path.join(workflowDir, `${version.id}.json`);
    await fs.unlink(versionFile);
  }

  return toDelete.length;
}

/**
 * Compare two workflow versions
 */
export interface VersionDiff {
  nodesAdded: string[];
  nodesRemoved: string[];
  nodesModified: string[];
  connectionsChanged: boolean;
  settingsChanged: boolean;
  summary: string;
}

export function diffWorkflows(
  oldWorkflow: N8nWorkflow,
  newWorkflow: N8nWorkflow
): VersionDiff {
  const oldNodes = new Map(oldWorkflow.nodes.map((n) => [n.name, n]));
  const newNodes = new Map(newWorkflow.nodes.map((n) => [n.name, n]));

  const nodesAdded: string[] = [];
  const nodesRemoved: string[] = [];
  const nodesModified: string[] = [];

  // Find added and modified nodes
  for (const [name, node] of newNodes) {
    if (!oldNodes.has(name)) {
      nodesAdded.push(name);
    } else {
      const oldNode = oldNodes.get(name)!;
      if (JSON.stringify(oldNode.parameters) !== JSON.stringify(node.parameters)) {
        nodesModified.push(name);
      }
    }
  }

  // Find removed nodes
  for (const name of oldNodes.keys()) {
    if (!newNodes.has(name)) {
      nodesRemoved.push(name);
    }
  }

  const connectionsChanged =
    JSON.stringify(oldWorkflow.connections) !== JSON.stringify(newWorkflow.connections);

  const settingsChanged =
    JSON.stringify(oldWorkflow.settings) !== JSON.stringify(newWorkflow.settings);

  // Generate summary
  const parts: string[] = [];
  if (nodesAdded.length) parts.push(`+${nodesAdded.length} nodes`);
  if (nodesRemoved.length) parts.push(`-${nodesRemoved.length} nodes`);
  if (nodesModified.length) parts.push(`~${nodesModified.length} modified`);
  if (connectionsChanged) parts.push('connections changed');
  if (settingsChanged) parts.push('settings changed');

  return {
    nodesAdded,
    nodesRemoved,
    nodesModified,
    connectionsChanged,
    settingsChanged,
    summary: parts.length ? parts.join(', ') : 'no changes',
  };
}

/**
 * Delete all versions for a workflow
 */
export async function deleteAllVersions(workflowId: string): Promise<number> {
  const versions = await listVersions(workflowId);
  const workflowDir = getWorkflowDir(workflowId);

  for (const version of versions) {
    const versionFile = path.join(workflowDir, `${version.id}.json`);
    await fs.unlink(versionFile);
  }

  // Remove the directory if empty
  try {
    await fs.rmdir(workflowDir);
  } catch {
    // Ignore if not empty
  }

  return versions.length;
}

/**
 * Get version control status/stats
 */
export async function getVersionStats(): Promise<{
  enabled: boolean;
  storageDir: string;
  maxVersions: number;
  workflowCount: number;
  totalVersions: number;
}> {
  let workflowCount = 0;
  let totalVersions = 0;

  try {
    const workflows = await fs.readdir(config.storageDir);
    workflowCount = workflows.length;

    for (const workflowId of workflows) {
      const versions = await listVersions(workflowId);
      totalVersions += versions.length;
    }
  } catch {
    // Storage dir doesn't exist yet
  }

  return {
    enabled: config.enabled,
    storageDir: config.storageDir,
    maxVersions: config.maxVersions,
    workflowCount,
    totalVersions,
  };
}
