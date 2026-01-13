# n8n Best Practices

> Enforced by `@pagelines/n8n-mcp`

## Guiding Principle

**What is most stable and easiest to maintain?**

| Rule | Why |
|------|-----|
| Minimize nodes | Fewer failure points, easier debugging |
| YAGNI | Build only what's needed now |
| Explicit references | `$('node_name')` not `$json` - traceable, stable |
| snake_case | `node_name` not `NodeName` - consistent, readable |

---

## Naming Convention

**snake_case everywhere**

```
Workflows: content_factory, publish_linkedin, upload_image
Nodes: trigger_webhook, fetch_articles, check_approved
```

Never `NodeName`. Always `node_name`.

---

## Expression References

**NEVER use `$json`. Always explicit node references.**

```javascript
// Bad - breaks when flow changes
{{ $json.field }}

// Good - traceable and debuggable
{{ $('node_name').item.json.field }}

// Parallel branch (lookup nodes)
{{ $('lookup_node').all().length > 0 }}

// Environment variable
{{ $env.API_KEY }}

// Fallback pattern
{{ $('source').item.json.text || $('source').item.json.media_url }}
```

---

## Secrets and Configuration

**Secrets in environment variables. Always.**

```javascript
// Bad
{ "apiKey": "sk_live_abc123" }

// Good
{{ $env.API_KEY }}
```

**For workflow-specific settings, use a config node:**

```
[trigger] → [config] → [rest of workflow]
```

Config node uses JSON output mode:
```javascript
={
  "channel_id": "{{ $json.body.channelId || '1234567890' }}",
  "max_items": 10,
  "ai_model": "gpt-4.1-mini"
}
```

Then reference: `{{ $('config').item.json.channel_id }}`

---

## Workflow Editing Safety

### The Golden Rule

**Never edit a workflow without explicit confirmation and backup.**

### Pre-Edit Checklist

1. **Confirm** - Get explicit user approval
2. **List versions** - Know your rollback point
3. **Read full state** - Understand current config
4. **Make targeted change** - Use patch operations only
5. **Verify** - Confirm expected state

### Parameter Preservation

**CRITICAL:** Partial updates REPLACE the entire `parameters` object.

```javascript
// Bad: Only updates messageId, loses operation and labelIds
{
  "type": "updateNode",
  "nodeName": "archive_email",
  "properties": {
    "parameters": {
      "messageId": "={{ $json.message_id }}"
    }
  }
}

// Good: Include ALL required parameters
{
  "type": "updateNode",
  "nodeName": "archive_email",
  "properties": {
    "parameters": {
      "operation": "addLabels",
      "messageId": "={{ $json.message_id }}",
      "labelIds": ["Label_123", "Label_456"]
    }
  }
}
```

---

## Code Nodes

**Code nodes are a last resort.** Exhaust built-in options first:

| Need | Use Instead |
|------|-------------|
| Transform fields | Set node with expressions |
| Filter items | Filter node or If/Switch |
| Merge data | Merge node |
| Loop processing | n8n processes arrays natively |
| Date formatting | `{{ $now.format('yyyy-MM-dd') }}` |

**When code IS necessary:**
- Re-establishing `pairedItem` after chain breaks
- Complex conditional logic
- API response parsing expressions can't handle

**Code node rules:**
- Single responsibility (one clear purpose)
- Name it for what it does: `merge_context`, `parse_response`
- No side effects - pure data transformation

---

## AI Agent Best Practices

### Structured Output

**Always enable "Require Specific Output Format"** for reliable JSON:

```javascript
{
  "promptType": "define",
  "hasOutputParser": true,
  "schemaType": "manual"  // Required for nullable fields
}
```

Without these, AI outputs are unpredictable.

### Memory Storage

**Never use in-memory storage in production:**

| Don't Use | Use Instead |
|-----------|-------------|
| Windowed Buffer Memory | Postgres Chat Memory |
| In-Memory Vector Store | Postgres pgvector |

In-memory dies with restart and doesn't scale.

---

## Architecture Patterns

### Single Responsibility

Don't build monolith workflows:

```
Bad: One workflow doing signup → email → CRM → calendar → reports

Good: Five focused workflows that communicate via webhooks
```

### Switch > If Node

Always use Switch instead of If:
- Named outputs (not just true/false)
- Unlimited conditional branches
- Send to all matching option

---

## Validation Rules Enforced

| Rule | Severity | Description |
|------|----------|-------------|
| `snake_case` | warning | Names should be snake_case |
| `explicit_reference` | warning | Use `$('node')` not `$json` |
| `no_hardcoded_ids` | info | Avoid hardcoded IDs |
| `no_hardcoded_secrets` | error | Never hardcode secrets |
| `orphan_node` | warning | Node has no connections |
| `parameter_preservation` | error | Update would remove parameters |
| `code_node_usage` | info | Code node detected |
| `ai_structured_output` | warning | AI node missing structured output |
| `in_memory_storage` | warning | Using non-persistent storage |

---

## Quick Reference

```javascript
// Explicit reference
{{ $('node_name').item.json.field }}

// Environment variable
{{ $env.VAR_NAME }}

// Config node reference
{{ $('config').item.json.setting }}

// Parallel branch query
{{ $('lookup').all().some(i => i.json.id === $json.id) }}

// Date formatting
{{ $now.format('yyyy-MM-dd') }}

// Fallback
{{ $json.text || $json.description || 'default' }}
```
