# Architecture

## vs czlonkowski/n8n-mcp

| Concern | czlonkowski | @pagelines |
|---------|-------------|------------|
| Node docs | 70MB SQLite, 1084 nodes | None (use Google) |
| Templates | 2,709 indexed | None (use n8n.io) |
| Update mode | Full replace | Patch (preserves params) |
| Version control | Limited | Auto-snapshot, diff, rollback |
| Validation | Basic | Rules + expressions + circular refs |
| Auto-fix | No | Yes |
| Dependencies | SQLite, heavy | Zero runtime |
| Lines of code | ~10k+ | ~1,200 |

## Modules

```
src/
├── index.ts        # MCP server, tool dispatch
├── types.ts        # Type definitions
├── tools.ts        # Tool schemas (JSON Schema)
├── n8n-client.ts   # n8n REST API client
├── validators.ts   # Validation rules
├── expressions.ts  # Expression parsing ({{ }})
├── autofix.ts      # Auto-fix transforms
└── versions.ts     # Version control (local fs)
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
│  versions                       │
└─────────────────────────────────┘
    ↓
JSON Response → Claude
```

## Tools (19 total)

### Workflow (8)
| Tool | Description |
|------|-------------|
| `workflow_list` | List workflows, filter by active |
| `workflow_get` | Get full workflow |
| `workflow_create` | Create with nodes/connections |
| `workflow_update` | Patch operations |
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

## Validation Rules

| Rule | Severity | Description |
|------|----------|-------------|
| `snake_case` | warning | Names should be snake_case |
| `explicit_reference` | warning | Use `$('node')` not `$json` |
| `no_hardcoded_ids` | info | Avoid hardcoded IDs |
| `no_hardcoded_secrets` | error | Never hardcode secrets |
| `code_node_usage` | info | Code node detected |
| `ai_structured_output` | warning | AI node missing structured output |
| `in_memory_storage` | warning | Non-persistent storage |
| `orphan_node` | warning | Node has no connections |
| `node_exists` | error | Node doesn't exist (for updates) |
| `parameter_preservation` | error | Update would lose parameters |

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
