# n8n Best Practices

> **These rules are automatically enforced.** The MCP validates, auto-fixes, and formats on every `workflow_create` and `workflow_update`. You'll only see warnings for issues that can't be auto-fixed.

## Quick Reference

```javascript
// Explicit reference (always use this)
{{ $('node_name').item.json.field }}

// Environment variable
{{ $env.API_KEY }}

// Config node reference
{{ $('config').item.json.setting }}

// Fallback
{{ $('source').item.json.text || 'default' }}

// Date
{{ $now.format('yyyy-MM-dd') }}
```

## The Rules

### 1. snake_case (auto-fixed)

```
Good: fetch_articles, check_approved, generate_content
Bad:  FetchArticles, Check Approved, generate-content
```

Why: Consistency, readability. **Auto-fixed:** renamed automatically with all references updated.

### 2. Explicit References (auto-fixed)

```javascript
// Bad - breaks when flow changes
{{ $json.field }}

// Good - traceable, stable
{{ $('node_name').item.json.field }}
```

Why: `$json` references "previous node" implicitly. Reorder nodes, it breaks. **Auto-fixed:** converted to explicit `$('prev_node')` references.

### 3. Config Node

Single source for workflow settings:

```
[trigger] → [config] → [rest of workflow]
```

Config node (JSON mode):
```javascript
={
  "channel_id": "{{ $json.body.channelId || '123456' }}",
  "max_items": 10,
  "ai_model": "gpt-4.1-mini"
}
```

Reference everywhere: `{{ $('config').item.json.channel_id }}`

Why: Change once, not in 5 nodes.

### 4. Secrets in Environment (recommended)

```javascript
// Hardcoded (works, but less portable)
{ "apiKey": "sk_live_abc123" }

// Environment variable (recommended)
{{ $env.API_KEY }}
```

Why: Env vars make workflows portable across environments and avoid committing secrets.

## Parameter Preservation

**Critical:** Partial updates REPLACE the entire `parameters` object.

```javascript
// Bad - loses operation and labelIds
{
  "type": "updateNode",
  "nodeName": "archive_email",
  "properties": {
    "parameters": {
      "messageId": "={{ $json.message_id }}"
    }
  }
}

// Good - include ALL parameters
{
  "type": "updateNode",
  "nodeName": "archive_email",
  "properties": {
    "parameters": {
      "operation": "addLabels",
      "messageId": "={{ $json.message_id }}",
      "labelIds": ["Label_123"]
    }
  }
}
```

Before updating: read current state with `workflow_get`.

## AI Nodes

### Structured Output (auto-fixed)

Always set for predictable JSON. **Auto-fixed:** `promptType: "define"` and `hasOutputParser: true` added automatically.

| Setting | Value |
|---------|-------|
| `promptType` | `"define"` |
| `hasOutputParser` | `true` |
| `schemaType` | `"manual"` (for nullable fields) |

### Memory

| Don't Use | Use Instead |
|-----------|-------------|
| Windowed Buffer Memory | Postgres Chat Memory |
| In-Memory Vector Store | Postgres pgvector |

In-memory dies on restart, doesn't scale.

## Code Nodes: Last Resort

| Need | Use Instead |
|------|-------------|
| Transform fields | Set node with expressions |
| Filter items | Filter node or Switch |
| Merge data | Merge node |
| Loop | n8n processes arrays natively |
| Date formatting | `{{ $now.format('yyyy-MM-dd') }}` |

When code IS necessary:
- Re-establishing `pairedItem` after chain breaks
- Complex conditional logic
- API parsing expressions can't handle

## Pre-Edit Checklist

| Step | Why |
|------|-----|
| 1. Get explicit user approval | Don't surprise |
| 2. List versions | Know rollback point |
| 3. Read full workflow | Understand current state |
| 4. Make targeted change | Minimal surface area |

> **Note:** Validation and cleanup are now automatic. Every create/update validates, auto-fixes, and formats automatically.

## Node-Specific Settings

See [Node Config](node-config.md) for:
- Resource locator (`__rl`) format with `cachedResultName`
- Google Sheets, Gmail, Discord required fields
- Set node JSON mode vs manual mapping
- Error handling options
