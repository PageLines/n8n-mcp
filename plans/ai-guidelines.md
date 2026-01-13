# AI Guidelines for @pagelines/n8n-mcp

Entry point for AI assistants working on this codebase.

## Quick Start

```bash
npm run dev      # Watch mode
npm run test     # Run tests
npm run build    # Compile TypeScript
```

## Codebase Map

| File | Purpose | When to modify |
|------|---------|----------------|
| `src/index.ts` | MCP server, tool dispatch | Adding new tools |
| `src/types.ts` | Type definitions | New data structures |
| `src/tools.ts` | Tool JSON schemas | New tool definitions |
| `src/n8n-client.ts` | n8n REST API calls | New API operations |
| `src/validators.ts` | Validation rules | New lint rules |
| `src/expressions.ts` | Expression parsing | Expression handling |
| `src/autofix.ts` | Auto-fix transforms | New auto-fixes |
| `src/versions.ts` | Version control | Version features |

## Coding Standards

### Do
- Write pure functions that return values
- Use async/await, never callbacks
- Add types for all parameters and returns
- Keep functions under 50 lines
- Name variables descriptively
- Write tests for new validators

### Don't
- Use `any` type
- Mutate input parameters
- Add external dependencies without strong justification
- Create abstraction before duplication (rule of 3)
- Add features not explicitly requested

## Adding a New Tool

1. **Define type** in `types.ts` (if needed)
2. **Add schema** in `tools.ts`:
```typescript
{
  name: 'my_tool',
  description: 'What it does',
  inputSchema: {
    type: 'object',
    properties: { /* ... */ },
    required: ['param1']
  }
}
```
3. **Add handler** in `index.ts`:
```typescript
case 'my_tool':
  return await handleMyTool(args);
```
4. **Implement logic** in appropriate module
5. **Add test** in `*.test.ts`

## Adding a Validation Rule

1. **Add rule function** in `validators.ts`:
```typescript
function checkMyRule(workflow: N8nWorkflow): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  // validation logic
  if (problem) {
    warnings.push({
      rule: 'my_rule',
      severity: 'warning', // or 'error' | 'info'
      message: 'Description of issue',
      nodeId: node.id,
      nodeName: node.name,
      suggestion: 'How to fix'
    });
  }
  return warnings;
}
```

2. **Add to composition** in `validateWorkflow()`:
```typescript
...checkMyRule(workflow),
```

3. **Add test** in `validators.test.ts`:
```typescript
it('detects my_rule violations', () => {
  const workflow = createWorkflow({
    // problematic config
  });
  const warnings = validateWorkflow(workflow);
  expect(warnings).toContainEqual(
    expect.objectContaining({ rule: 'my_rule' })
  );
});
```

## Adding an Auto-Fix

1. **Check if fixable** - some issues require human judgment
2. **Add fix logic** in `autofix.ts`:
```typescript
if (warning.rule === 'my_rule') {
  // transform workflow
  fixed.push(warning);
} else {
  unfixed.push(warning);
}
```
3. **Update references** if renaming anything
4. **Test both dry-run and apply modes**

## Patterns to Follow

### Safe Mutations
```typescript
// Always clone before mutating
const copy = JSON.parse(JSON.stringify(original));
// Modify copy, return copy
```

### Async Operations
```typescript
// All file/network operations are async
async function doThing(): Promise<Result> {
  const data = await fetchData();
  return transform(data);
}
```

### Error Responses
```typescript
// MCP error format
return {
  content: [{ type: 'text', text: 'Error message' }],
  isError: true
};
```

### Validation Returns
```typescript
// Always return array (empty if valid)
function validate(): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  // ... checks ...
  return warnings;
}
```

## Testing Patterns

### Fixture Factory
```typescript
function createWorkflow(overrides: Partial<N8nWorkflow> = {}): N8nWorkflow {
  return {
    id: 'test-id',
    name: 'test_workflow',
    nodes: [],
    connections: {},
    ...overrides
  };
}
```

### Assertion Patterns
```typescript
// Check warning exists
expect(warnings).toContainEqual(
  expect.objectContaining({ rule: 'rule_name' })
);

// Check no warnings
expect(warnings).toHaveLength(0);

// Check severity
expect(warnings[0].severity).toBe('error');
```

## Out of Scope

Do not implement:
- Node documentation/search (use web search)
- Template marketplace features
- Credential management
- Multi-instance sync
- Real-time execution monitoring

These are either security risks or solved problems (Google, n8n UI).

## Questions to Ask

Before adding a feature:
1. Does this serve workflow editing/validation/versioning?
2. Can this be solved with existing web search?
3. Does this add runtime dependencies?
4. Is there duplication that justifies abstraction?

If any answer suggests bloat, reconsider.

## File Locations

```
~/.n8n-mcp/versions/     # Version control storage
  {workflowId}/
    {timestamp}_{hash}.json
```

## Environment Variables

```bash
N8N_API_URL=http://localhost:5678  # n8n instance URL
N8N_API_KEY=your-api-key           # n8n API key
```

## Debugging

```bash
# Run with verbose output
DEBUG=* npm run dev

# Test single file
npx vitest run src/validators.test.ts

# Watch single test
npx vitest watch src/validators.test.ts
```
