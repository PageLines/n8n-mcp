# n8n Best Practices

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

### 1. snake_case

```
Good: fetch_articles, check_approved, generate_content
Bad:  FetchArticles, Check Approved, generate-content
```

Why: Consistency, readability, auto-fixable.

### 2. Explicit References

```javascript
// Bad - breaks when flow changes
{{ $json.field }}

// Good - traceable, stable
{{ $('node_name').item.json.field }}
```

Why: `$json` references "previous node" implicitly. Reorder nodes, it breaks.

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

### 4. Secrets in Environment

```javascript
// Bad
{ "apiKey": "sk_live_abc123" }

// Good
{{ $env.API_KEY }}
```

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

### Structured Output

Always set for predictable JSON:

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
| 5. Validate after | Catch issues immediately |

## Node-Specific Settings

See [Node Config](node-config.md) for:
- Resource locator (`__rl`) format with `cachedResultName`
- Google Sheets, Gmail, Discord required fields
- Set node JSON mode vs manual mapping
- Error handling options
