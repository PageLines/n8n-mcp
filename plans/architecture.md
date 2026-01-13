# Architecture

**Opinionated** n8n workflow automation. Enforces conventions, blocks mistakes, auto-fixes issues.

## vs czlonkowski/n8n-mcp

| Concern | czlonkowski | @pagelines |
|---------|-------------|------------|
| Philosophy | Permissive | Opinionated |
| Node docs | 70MB SQLite, 1084 nodes | None (use Google) |
| Templates | 2,709 indexed | None (use n8n.io) |
| Update mode | Full replace | Patch (preserves params) |
| After mutations | Nothing | Auto-validate, auto-fix, format |
| Invalid node types | API error | Blocked with suggestions |
| Version control | Limited | Auto-snapshot, diff, rollback |
| Validation | Basic | Rules + expressions + circular refs |
| Auto-fix | No | Yes (automatic) |
| Dependencies | SQLite, heavy | Zero runtime |
| Lines of code | ~10k+ | ~1,500 |

## Modules

```
src/
├── index.ts           # MCP server, tool dispatch
├── types.ts           # Type definitions
├── tools.ts           # Tool schemas (JSON Schema)
├── n8n-client.ts      # n8n REST API client
├── validators.ts      # Validation rules + node type validation
├── expressions.ts     # Expression parsing ({{ }})
├── autofix.ts         # Auto-fix transforms
├── versions.ts        # Version control (local fs)
└── response-format.ts # Token-efficient response formatting
```

## Data Flow

```
Claude Request
    ↓
MCP Server (stdio)
    ↓
Tool Handler
    ↓
┌─────────────────────────────────┐
│  n8n-client     validators      │
│  expressions    autofix         │
│  versions       response-format │
└─────────────────────────────────┘
    ↓
JSON Response → Claude
```

## Auto-Cleanup Pipeline

Every `workflow_create` and `workflow_update` runs this automatically:

```
1. Validate node types → Block if invalid (with suggestions)
2. Execute operation
3. Validate workflow → Get warnings
4. Auto-fix fixable issues → snake_case, $json refs, AI settings
5. Format workflow → Sort nodes, remove nulls
6. Update if changes → Apply cleanup to n8n
7. Return result → Only unfixable warnings shown
```

## Tools (20 total)

### Workflow (8)
| Tool | Description |
|------|-------------|
| `workflow_list` | List workflows, filter by active |
| `workflow_get` | Get full workflow |
| `workflow_create` | Create with nodes/connections (auto-validates, auto-fixes) |
| `workflow_update` | Patch operations (auto-validates, auto-fixes) |
| `workflow_delete` | Delete workflow |
| `workflow_activate` | Enable triggers |
| `workflow_deactivate` | Disable triggers |
| `workflow_execute` | Trigger via webhook |

### Execution (2)
| Tool | Description |
|------|-------------|
| `execution_list` | List executions, filter by status |
| `execution_get` | Get execution with run data |

### Validation (3)
| Tool | Description |
|------|-------------|
| `workflow_validate` | Check rules + expressions + circular refs |
| `workflow_autofix` | Fix auto-fixable issues (dry-run default) |
| `workflow_format` | Sort nodes, clean nulls |

### Discovery (1)
| Tool | Description |
|------|-------------|
| `node_types_list` | Search available node types by name/category |

### Version Control (6)
| Tool | Description |
|------|-------------|
| `version_list` | List snapshots for workflow |
| `version_get` | Get specific version |
| `version_save` | Manual snapshot with reason |
| `version_rollback` | Restore previous (auto-saves current first) |
| `version_diff` | Compare versions |
| `version_stats` | Version control statistics |

## Patch Operations

`workflow_update` accepts these operation types:

```
addNode, removeNode, updateNode
addConnection, removeConnection
updateSettings, updateName
```

Key: Preserves unmodified parameters.

## Node Type Validation

Before `workflow_create` or `workflow_update` with `addNode`:

1. Fetch available types from n8n API
2. Validate all node types exist
3. **Block** if invalid with suggestions (fuzzy matching)

```
Error: Invalid node types detected:
Invalid node type "n8n-nodes-base.webhok" for node "trigger".
Did you mean: n8n-nodes-base.webhook?

Use node_types_list to discover available node types.
```

## Validation Rules

All rules are checked automatically on every `workflow_create` and `workflow_update`:

| Rule | Severity | Auto-fix | Description |
|------|----------|----------|-------------|
| `snake_case` | warning | Yes | Names should be snake_case |
| `explicit_reference` | warning | Yes | Use `$('node')` not `$json` |
| `ai_structured_output` | warning | Yes | AI node missing structured output |
| `no_hardcoded_ids` | info | No | Avoid hardcoded IDs |
| `no_hardcoded_secrets` | info | No | Consider using $env vars |
| `code_node_usage` | info | No | Code node detected |
| `in_memory_storage` | warning | No | Non-persistent storage |
| `orphan_node` | warning | No | Node has no connections |
| `node_exists` | error | No | Node doesn't exist (for updates) |
| `parameter_preservation` | error | No | Update would lose parameters |

## Expression Validation

| Issue | Severity | Pattern |
|-------|----------|---------|
| Uses `$json` | warning | `$json.` without `$('` prefix |
| Uses `$input` | info | `$input.` usage |
| Missing node reference | error | `$('node')` where node doesn't exist |
| Unclosed `}}` | error | Unmatched delimiters |
| Unbalanced parens/brackets | error | `(` vs `)`, `[` vs `]` |
| Deprecated `$node` | warning | `$node.` pattern |
| Deep property without `?.` | info | Missing optional chaining |

Plus: **Circular reference detection** across all expressions.

## Auto-Fix

| Rule | Transform |
|------|-----------|
| `snake_case` | Rename + update all references |
| `explicit_reference` | `$json.x` → `$('prev_node').item.json.x` |
| `ai_structured_output` | Add `promptType: "define"`, `hasOutputParser: true` |

**Not fixable** (require judgment): secrets, hardcoded IDs, orphan nodes, code nodes, memory storage.

## Version Control

Storage: `~/.n8n-mcp/versions/{workflowId}/{timestamp}_{hash}.json`

```json
{
  "id": "1704067200000_abc123",
  "workflowId": "123",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "reason": "before update",
  "metadata": {
    "name": "my_workflow",
    "nodeCount": 5,
    "contentHash": "abc123"
  },
  "workflow": { /* full snapshot */ }
}
```

Features:
- Hash-based deduplication (no duplicate saves)
- Max versions pruning (default: 20)
- Auto-save before `workflow_update` and `version_rollback`

## Extension

Add validation rule:
```typescript
// validators.ts
function checkMyRule(workflow: N8nWorkflow): ValidationWarning[] {
  // return warnings
}
// Add to validateWorkflow()
```

Add auto-fix:
```typescript
// autofix.ts
if (warning.rule === 'my_rule' && fixable) {
  // transform workflow
}
```
