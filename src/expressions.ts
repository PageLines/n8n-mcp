/**
 * n8n expression validation
 * Parses and validates expressions in workflow parameters
 */

import type { N8nWorkflow, N8nNode, ValidationWarning } from './types.js';

export interface ExpressionIssue {
  node: string;
  parameter: string;
  expression: string;
  issue: string;
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
}

/**
 * Validate all expressions in a workflow
 */
export function validateExpressions(workflow: N8nWorkflow): ExpressionIssue[] {
  const issues: ExpressionIssue[] = [];
  const nodeNames = new Set(workflow.nodes.map((n) => n.name));

  for (const node of workflow.nodes) {
    const nodeIssues = validateNodeExpressions(node, nodeNames);
    issues.push(...nodeIssues);
  }

  return issues;
}

/**
 * Validate expressions in a single node
 */
function validateNodeExpressions(node: N8nNode, nodeNames: Set<string>): ExpressionIssue[] {
  const issues: ExpressionIssue[] = [];
  const expressions = extractExpressions(node.parameters);

  for (const { path, expression } of expressions) {
    const exprIssues = validateExpression(expression, nodeNames);
    for (const issue of exprIssues) {
      issues.push({
        node: node.name,
        parameter: path,
        expression,
        ...issue,
      });
    }
  }

  return issues;
}

/**
 * Extract all expressions from parameters
 */
function extractExpressions(
  params: Record<string, unknown>,
  basePath: string = ''
): Array<{ path: string; expression: string }> {
  const results: Array<{ path: string; expression: string }> = [];

  for (const [key, value] of Object.entries(params)) {
    const path = basePath ? `${basePath}.${key}` : key;

    if (typeof value === 'string') {
      // Check for expression patterns
      const exprMatches = value.match(/\{\{.*?\}\}/g) || [];
      for (const match of exprMatches) {
        results.push({ path, expression: match });
      }
      // Also check for ={{ prefix (common in n8n)
      if (value.startsWith('={{')) {
        results.push({ path, expression: value });
      }
    } else if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          if (typeof value[i] === 'object' && value[i] !== null) {
            results.push(...extractExpressions(value[i] as Record<string, unknown>, `${path}[${i}]`));
          } else if (typeof value[i] === 'string') {
            const strVal = value[i] as string;
            const exprMatches = strVal.match(/\{\{.*?\}\}/g) || [];
            for (const match of exprMatches) {
              results.push({ path: `${path}[${i}]`, expression: match });
            }
          }
        }
      } else {
        results.push(...extractExpressions(value as Record<string, unknown>, path));
      }
    }
  }

  return results;
}

/**
 * Validate a single expression
 */
function validateExpression(
  expression: string,
  nodeNames: Set<string>
): Array<Omit<ExpressionIssue, 'node' | 'parameter' | 'expression'>> {
  const issues: Array<Omit<ExpressionIssue, 'node' | 'parameter' | 'expression'>> = [];

  // Strip wrapper
  let inner = expression;
  if (inner.startsWith('={{')) {
    inner = inner.slice(3).trim();
  } else if (inner.startsWith('{{') && inner.endsWith('}}')) {
    inner = inner.slice(2, -2).trim();
  }

  // Check for $json usage (should use explicit reference)
  if (/\$json\./.test(inner) && !/\$\(['"]/.test(inner)) {
    issues.push({
      issue: 'Uses $json instead of explicit node reference',
      severity: 'warning',
      suggestion: "Use $('node_name').item.json.field instead",
    });
  }

  // Check for $input usage (acceptable but check context)
  if (/\$input\./.test(inner)) {
    issues.push({
      issue: '$input reference found - ensure this is intentional',
      severity: 'info',
      suggestion: "Consider explicit $('node_name') for clarity",
    });
  }

  // Check for node references that don't exist
  const nodeRefMatches = inner.matchAll(/\$\(['"]([^'"]+)['"]\)/g);
  for (const match of nodeRefMatches) {
    const refNodeName = match[1];
    if (!nodeNames.has(refNodeName)) {
      issues.push({
        issue: `References non-existent node "${refNodeName}"`,
        severity: 'error',
        suggestion: `Check if the node exists or was renamed`,
      });
    }
  }

  // Check for common syntax errors
  if (expression.includes('{{') && !expression.includes('}}')) {
    issues.push({
      issue: 'Missing closing }}',
      severity: 'error',
    });
  }

  // Check for unmatched parentheses
  const openParens = (inner.match(/\(/g) || []).length;
  const closeParens = (inner.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    issues.push({
      issue: 'Unmatched parentheses',
      severity: 'error',
    });
  }

  // Check for unmatched brackets
  const openBrackets = (inner.match(/\[/g) || []).length;
  const closeBrackets = (inner.match(/\]/g) || []).length;
  if (openBrackets !== closeBrackets) {
    issues.push({
      issue: 'Unmatched brackets',
      severity: 'error',
    });
  }

  // Check for deprecated patterns
  if (/\$node\./.test(inner)) {
    issues.push({
      issue: '$node is deprecated',
      severity: 'warning',
      suggestion: "Use $('node_name') instead",
    });
  }

  // Check for potential undefined access
  if (/\.json\.[a-zA-Z_]+\.[a-zA-Z_]+/.test(inner) && !/\?\./g.test(inner)) {
    issues.push({
      issue: 'Deep property access without optional chaining',
      severity: 'info',
      suggestion: 'Consider using ?. for safer access: obj?.nested?.field',
    });
  }

  return issues;
}

/**
 * Get all referenced nodes from expressions
 */
export function getReferencedNodes(workflow: N8nWorkflow): Map<string, string[]> {
  const references = new Map<string, string[]>();

  for (const node of workflow.nodes) {
    const expressions = extractExpressions(node.parameters);
    const refsForNode: string[] = [];

    for (const { expression } of expressions) {
      const matches = expression.matchAll(/\$\(['"]([^'"]+)['"]\)/g);
      for (const match of matches) {
        const refName = match[1];
        if (!refsForNode.includes(refName)) {
          refsForNode.push(refName);
        }
      }
    }

    if (refsForNode.length > 0) {
      references.set(node.name, refsForNode);
    }
  }

  return references;
}

/**
 * Check for circular references in expressions
 */
export function checkCircularReferences(workflow: N8nWorkflow): string[][] {
  const references = getReferencedNodes(workflow);
  const cycles: string[][] = [];

  function findCycle(start: string, path: string[] = []): void {
    if (path.includes(start)) {
      const cycleStart = path.indexOf(start);
      cycles.push([...path.slice(cycleStart), start]);
      return;
    }

    const refs = references.get(start) || [];
    for (const ref of refs) {
      findCycle(ref, [...path, start]);
    }
  }

  for (const nodeName of references.keys()) {
    findCycle(nodeName);
  }

  // Deduplicate cycles
  const uniqueCycles = cycles.filter((cycle, index) => {
    const key = [...cycle].sort().join(',');
    return cycles.findIndex((c) => [...c].sort().join(',') === key) === index;
  });

  return uniqueCycles;
}
