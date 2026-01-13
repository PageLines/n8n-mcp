/**
 * Opinion-based workflow validation
 * Enforces best practices from n8n-best-practices.md
 */

import type {
  N8nWorkflow,
  N8nNode,
  ValidationResult,
  ValidationWarning,
  NodeTypeValidationError,
} from './types.js';

export function validateWorkflow(workflow: N8nWorkflow): ValidationResult {
  const warnings: ValidationWarning[] = [];

  // Validate workflow name
  validateSnakeCase(workflow.name, 'workflow', warnings);

  // Validate each node
  for (const node of workflow.nodes) {
    validateNode(node, warnings);
  }

  // Check for orphan nodes (no connections)
  validateConnections(workflow, warnings);

  return {
    valid: warnings.filter((w) => w.severity === 'error').length === 0,
    warnings,
  };
}

function validateNode(node: N8nNode, warnings: ValidationWarning[]): void {
  // Check node name is snake_case
  validateSnakeCase(node.name, `node "${node.name}"`, warnings);

  // Check for $json usage (should use explicit references)
  checkForJsonUsage(node, warnings);

  // Check for hardcoded IDs
  checkForHardcodedIds(node, warnings);

  // Check for hardcoded secrets
  checkForHardcodedSecrets(node, warnings);

  // Check for code node usage (should be last resort)
  checkForCodeNodeUsage(node, warnings);

  // Check for AI node structured output settings
  checkForAIStructuredOutput(node, warnings);

  // Check for in-memory storage (non-persistent)
  checkForInMemoryStorage(node, warnings);
}

function validateSnakeCase(name: string, context: string, warnings: ValidationWarning[]): void {
  // Allow spaces for readability, but check the underlying format
  const normalized = name.toLowerCase().replace(/\s+/g, '_');

  // Check if it matches snake_case pattern (allowing numbers)
  const isSnakeCase = /^[a-z][a-z0-9_]*$/.test(normalized);

  // Also allow names that are already snake_case
  const isAlreadySnake = /^[a-z][a-z0-9_]*$/.test(name);

  if (!isSnakeCase && !isAlreadySnake) {
    warnings.push({
      rule: 'snake_case',
      message: `${context} should use snake_case naming: "${name}" → "${normalized}"`,
      severity: 'warning',
    });
  }
}

function checkForJsonUsage(node: N8nNode, warnings: ValidationWarning[]): void {
  const params = JSON.stringify(node.parameters);

  // Detect $json without explicit node reference
  // Bad: $json.field, {{ $json.field }}
  // Good: $('node_name').item.json.field
  const badPatterns = [
    /\$json\./g,
    /\{\{\s*\$json\./g,
  ];

  for (const pattern of badPatterns) {
    if (pattern.test(params)) {
      warnings.push({
        node: node.name,
        rule: 'explicit_reference',
        message: `Node "${node.name}" uses $json - use explicit $('node_name').item.json.field instead`,
        severity: 'warning',
      });
      break;
    }
  }
}

function checkForHardcodedIds(node: N8nNode, warnings: ValidationWarning[]): void {
  const params = JSON.stringify(node.parameters);

  // Detect patterns that look like hardcoded IDs
  const idPatterns = [
    // Discord IDs (17-19 digit numbers)
    /["']\d{17,19}["']/g,
    // UUIDs
    /["'][0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}["']/gi,
    // MongoDB ObjectIds
    /["'][0-9a-f]{24}["']/gi,
  ];

  for (const pattern of idPatterns) {
    if (pattern.test(params)) {
      warnings.push({
        node: node.name,
        rule: 'no_hardcoded_ids',
        message: `Node "${node.name}" may contain hardcoded IDs - consider using config nodes or environment variables`,
        severity: 'info',
      });
      break;
    }
  }
}

function checkForHardcodedSecrets(node: N8nNode, warnings: ValidationWarning[]): void {
  const params = JSON.stringify(node.parameters).toLowerCase();

  // Check for common secret patterns
  const secretPatterns = [
    /api[_-]?key["']\s*:\s*["'][^"']+["']/i,
    /secret["']\s*:\s*["'][^"']+["']/i,
    /password["']\s*:\s*["'][^"']+["']/i,
    /token["']\s*:\s*["'][a-z0-9]{20,}["']/i,
  ];

  for (const pattern of secretPatterns) {
    if (pattern.test(params)) {
      warnings.push({
        node: node.name,
        rule: 'no_hardcoded_secrets',
        message: `Node "${node.name}" may contain hardcoded secrets - consider using $env.VAR_NAME`,
        severity: 'info',
      });
      break;
    }
  }
}

function checkForCodeNodeUsage(node: N8nNode, warnings: ValidationWarning[]): void {
  // Detect code nodes - they should be last resort
  const codeNodeTypes = [
    'n8n-nodes-base.code',
    'n8n-nodes-base.function',
    'n8n-nodes-base.functionItem',
  ];

  if (codeNodeTypes.some((t) => node.type.includes(t))) {
    warnings.push({
      node: node.name,
      rule: 'code_node_usage',
      message: `Node "${node.name}" is a code node - ensure built-in nodes can't achieve this`,
      severity: 'info',
    });
  }
}

function checkForAIStructuredOutput(node: N8nNode, warnings: ValidationWarning[]): void {
  // Check AI/LLM nodes for structured output settings
  const aiNodeTypes = [
    'langchain.agent',
    'langchain.chainLlm',
    'langchain.lmChatOpenAi',
    'langchain.lmChatAnthropic',
    'langchain.lmChatGoogleGemini',
  ];

  const isAINode = aiNodeTypes.some((t) => node.type.toLowerCase().includes(t.toLowerCase()));
  if (!isAINode) return;

  // Check for structured output settings
  const params = node.parameters as Record<string, unknown>;
  const hasPromptType = params.promptType === 'define';
  const hasOutputParser = params.hasOutputParser === true;

  // Only warn if it looks like they want structured output but missed settings
  if (params.outputParser || params.schemaType) {
    if (!hasPromptType || !hasOutputParser) {
      warnings.push({
        node: node.name,
        rule: 'ai_structured_output',
        message: `Node "${node.name}" may need promptType: "define" and hasOutputParser: true for reliable structured output`,
        severity: 'warning',
      });
    }
  }
}

function checkForInMemoryStorage(node: N8nNode, warnings: ValidationWarning[]): void {
  // Detect in-memory storage nodes that don't persist across restarts
  const inMemoryTypes = [
    'memoryBufferWindow',
    'memoryVectorStore',
    'vectorStoreInMemory',
  ];

  const isInMemory = inMemoryTypes.some((t) => node.type.toLowerCase().includes(t.toLowerCase()));
  if (isInMemory) {
    warnings.push({
      node: node.name,
      rule: 'in_memory_storage',
      message: `Node "${node.name}" uses in-memory storage - consider Postgres for production persistence`,
      severity: 'warning',
    });
  }
}

function validateConnections(workflow: N8nWorkflow, warnings: ValidationWarning[]): void {
  const connectedNodes = new Set<string>();

  // Collect all nodes that have connections (as source or target)
  for (const [sourceName, outputs] of Object.entries(workflow.connections)) {
    connectedNodes.add(sourceName);
    for (const outputType of Object.values(outputs)) {
      for (const connections of outputType) {
        for (const conn of connections) {
          connectedNodes.add(conn.node);
        }
      }
    }
  }

  // Check for orphan nodes (excluding trigger nodes which don't need incoming)
  const triggerTypes = [
    'n8n-nodes-base.webhook',
    'n8n-nodes-base.scheduleTrigger',
    'n8n-nodes-base.manualTrigger',
    'n8n-nodes-base.emailTrigger',
    '@n8n/n8n-nodes-langchain.chatTrigger',
  ];

  for (const node of workflow.nodes) {
    const isTrigger = triggerTypes.some((t) => node.type.includes(t.split('.')[1]));
    if (!isTrigger && !connectedNodes.has(node.name)) {
      warnings.push({
        node: node.name,
        rule: 'orphan_node',
        message: `Node "${node.name}" has no connections - may be orphaned`,
        severity: 'warning',
      });
    }
  }
}

/**
 * Validate a partial update to ensure it won't cause issues
 */
export function validatePartialUpdate(
  currentWorkflow: N8nWorkflow,
  nodeName: string,
  newParameters: Record<string, unknown>
): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  const currentNode = currentWorkflow.nodes.find((n) => n.name === nodeName);
  if (!currentNode) {
    warnings.push({
      node: nodeName,
      rule: 'node_exists',
      message: `Node "${nodeName}" not found in workflow`,
      severity: 'error',
    });
    return warnings;
  }

  // Check for parameter loss
  const currentKeys = Object.keys(currentNode.parameters);
  const newKeys = Object.keys(newParameters);
  const missingKeys = currentKeys.filter((k) => !newKeys.includes(k));

  if (missingKeys.length > 0) {
    warnings.push({
      node: nodeName,
      rule: 'parameter_preservation',
      message: `Update will remove parameters: ${missingKeys.join(', ')}. Include all existing parameters to preserve them.`,
      severity: 'error',
    });
  }

  return warnings;
}

// ─────────────────────────────────────────────────────────────
// Node Type Validation
// ─────────────────────────────────────────────────────────────

/**
 * Validate that all node types in an array exist in the available types
 * Returns errors for any invalid node types with suggestions
 */
export function validateNodeTypes(
  nodes: Array<{ name: string; type: string }>,
  availableTypes: Set<string>
): NodeTypeValidationError[] {
  const errors: NodeTypeValidationError[] = [];

  for (const node of nodes) {
    if (!availableTypes.has(node.type)) {
      errors.push({
        nodeType: node.type,
        nodeName: node.name,
        message: `Invalid node type "${node.type}" for node "${node.name}"`,
        suggestions: findSimilarTypes(node.type, availableTypes),
      });
    }
  }

  return errors;
}

/**
 * Find similar node types for suggestions (fuzzy matching)
 * Returns up to 3 suggestions
 */
function findSimilarTypes(invalidType: string, availableTypes: Set<string>): string[] {
  const suggestions: string[] = [];
  const searchTerm = invalidType.toLowerCase();

  // Extract the last part after the dot (e.g., "webhook" from "n8n-nodes-base.webhook")
  const typeParts = searchTerm.split('.');
  const shortName = typeParts[typeParts.length - 1];

  for (const validType of availableTypes) {
    const validLower = validType.toLowerCase();
    const validShortName = validLower.split('.').pop() || '';

    // Check for partial matches (substring)
    if (
      validLower.includes(shortName) ||
      shortName.includes(validShortName) ||
      validShortName.includes(shortName)
    ) {
      suggestions.push(validType);
      if (suggestions.length >= 3) break;
      continue;
    }

    // Check for typos using Levenshtein distance
    const distance = levenshteinDistance(shortName, validShortName);
    const maxLen = Math.max(shortName.length, validShortName.length);
    // Allow up to 2 character differences for short names, or 20% of length for longer ones
    const threshold = Math.max(2, Math.floor(maxLen * 0.2));
    if (distance <= threshold) {
      suggestions.push(validType);
      if (suggestions.length >= 3) break;
    }
  }

  return suggestions;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  // Initialize first column
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }

  // Initialize first row
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }

  // Fill in the rest of the matrix
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[a.length][b.length];
}
