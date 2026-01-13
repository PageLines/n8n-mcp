# Node Configuration Guidelines

> Settings that make AI-created nodes human-editable

## Resource Locator Pattern

n8n uses `__rl` (resource locator) format for dropdown fields. Always include `cachedResultName` so humans see friendly names.

```javascript
// Human-editable: shows "My Spreadsheet" in UI
"documentId": {
  "__rl": true,
  "value": "1abc123...",
  "mode": "list",
  "cachedResultName": "My Spreadsheet",
  "cachedResultUrl": "https://docs.google.com/spreadsheets/d/1abc123"
}

// Hard to edit: shows raw ID only
"documentId": {
  "__rl": true,
  "value": "1abc123...",
  "mode": "id"
}
```

| Mode | When to Use |
|------|-------------|
| `list` | Default. Shows dropdown with cached name |
| `id` | Only when ID is dynamic (from expression) |

## Set Node

**Use JSON mode** for MCP-created nodes. Manual mapping is error-prone via API.

```javascript
// JSON mode (reliable)
{
  "mode": "raw",
  "jsonOutput": "={ \"channel_id\": \"{{ $json.channelId || '123' }}\" }"
}

// Manual mapping (fragile via API)
{
  "mode": "manual",
  "assignments": { ... }  // Complex structure, easy to break
}
```

## Google Sheets

Required fields (partial updates lose these):

```javascript
{
  "operation": "append",
  "documentId": {
    "__rl": true,
    "value": "1abc...",
    "mode": "list",
    "cachedResultName": "Sheet Name"
  },
  "sheetName": {
    "__rl": true,
    "value": "gid=0",
    "mode": "list",
    "cachedResultName": "Sheet1"
  },
  "columns": { /* mappings */ }
}
```

## Gmail

Required fields:

```javascript
{
  "operation": "addLabels",  // or send, get, etc.
  "messageId": "={{ $('source').item.json.id }}",
  "labelIds": ["Label_123", "Label_456"]
}
```

Labels need full IDs (`Label_xxx`), not display names.

## Discord

```javascript
{
  "authentication": "webhook",
  "webhookUri": {
    "__rl": true,
    "value": "={{ $env.DISCORD_WEBHOOK }}",
    "mode": "id"
  },
  "content": "Message text"
}
```

For bot mode with guild/channel selection:

```javascript
{
  "guildId": {
    "__rl": true,
    "value": "123456789",
    "mode": "list",
    "cachedResultName": "My Server"
  },
  "channelId": {
    "__rl": true,
    "value": "987654321",
    "mode": "list",
    "cachedResultName": "#general"
  }
}
```

## AI Nodes (Agent, Chain)

Always include structured output settings:

```javascript
{
  "promptType": "define",
  "hasOutputParser": true,
  "schemaType": "manual",  // Required for nullable fields
  "schema": { /* JSON Schema */ }
}
```

Without these, AI outputs are unpredictable strings.

## HTTP Request

Include authentication method explicitly:

```javascript
{
  "method": "POST",
  "url": "https://api.example.com",
  "authentication": "predefinedCredentialType",
  "nodeCredentialType": "anthropicApi",
  "sendBody": true,
  "bodyParameters": { ... }
}
```

## Switch vs If

Always use Switch (not If):

```javascript
// Switch: named outputs, extensible
{
  "type": "n8n-nodes-base.switch",
  "parameters": {
    "rules": {
      "rules": [
        { "output": 0, "conditions": { ... } },
        { "output": 1, "conditions": { ... } }
      ]
    }
  }
}
```

If node only has true/false outputs - Switch scales better.

## Expression Patterns

Always explicit references:

```javascript
// Good
"={{ $('config').item.json.channel_id }}"

// Bad - breaks on node reorder
"={{ $json.channel_id }}"
```

Environment variables for secrets:

```javascript
"={{ $env.API_KEY }}"
```

## Error Handling

Set `onError` for API nodes:

```javascript
{
  "parameters": { ... },
  "onError": "continueRegularOutput"  // or "continueErrorOutput"
}
```

Options:
- `stopWorkflow` - default, halts on error
- `continueRegularOutput` - ignore errors, continue
- `continueErrorOutput` - route errors to second output
