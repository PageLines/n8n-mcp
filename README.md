# pl-n8n-mcp

> **@pagelines/n8n-mcp** - Opinionated MCP server for n8n workflow automation by [PageLines](https://github.com/pagelines)

## Features

- **Minimal footprint** - ~1,200 lines total, no database, no bloat
- **Patch-based updates** - Never lose parameters, always preserves existing data
- **Built-in validation** - Enforces best practices automatically
- **Safety warnings** - Alerts when updates might cause issues

## Best Practices Enforced

- `snake_case` naming for workflows and nodes
- Explicit node references (`$('node_name').item.json.field` not `$json`)
- No hardcoded IDs or secrets
- No orphan nodes

## Installation

```bash
npm install @pagelines/n8n-mcp
```

Or run directly:

```bash
npx @pagelines/n8n-mcp
```

## Configuration

### Claude Code / Cursor

Add to your MCP settings (`~/.claude/mcp.json` or IDE config):

```json
{
  "mcpServers": {
    "pl-n8n": {
      "command": "npx",
      "args": ["-y", "@pagelines/n8n-mcp"],
      "env": {
        "N8N_API_URL": "https://your-n8n-instance.com",
        "N8N_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `N8N_API_URL` | Your n8n instance URL |
| `N8N_API_KEY` | API key from n8n settings |

## Tools

### Workflow Operations

| Tool | Description |
|------|-------------|
| `workflow_list` | List all workflows |
| `workflow_get` | Get workflow by ID |
| `workflow_create` | Create new workflow |
| `workflow_update` | Update workflow with patch operations |
| `workflow_delete` | Delete workflow |
| `workflow_activate` | Enable triggers |
| `workflow_deactivate` | Disable triggers |
| `workflow_execute` | Execute via webhook |
| `workflow_validate` | Validate against best practices |

### Execution Operations

| Tool | Description |
|------|-------------|
| `execution_list` | List executions |
| `execution_get` | Get execution details |

## Patch Operations

The `workflow_update` tool uses patch operations to safely modify workflows:

```javascript
// Add a node
{ "type": "addNode", "node": { "name": "my_node", "type": "n8n-nodes-base.set", ... } }

// Update a node (INCLUDE ALL existing parameters)
{ "type": "updateNode", "nodeName": "my_node", "properties": { "parameters": { ...existing, "newParam": "value" } } }

// Remove a node
{ "type": "removeNode", "nodeName": "my_node" }

// Add connection
{ "type": "addConnection", "from": "node_a", "to": "node_b" }

// Remove connection
{ "type": "removeConnection", "from": "node_a", "to": "node_b" }

// Update settings
{ "type": "updateSettings", "settings": { "executionOrder": "v1" } }

// Rename workflow
{ "type": "updateName", "name": "new_name" }
```

## Validation Rules

| Rule | Severity | Description |
|------|----------|-------------|
| `snake_case` | warning | Names should be snake_case |
| `explicit_reference` | warning | Use `$('node')` not `$json` |
| `no_hardcoded_ids` | info | Avoid hardcoded IDs |
| `no_hardcoded_secrets` | error | Never hardcode secrets |
| `orphan_node` | warning | Node has no connections |
| `parameter_preservation` | error | Update would remove parameters |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Run tests
npm test
```

## Deployment

### npm

Published automatically on push to `main` via GitHub Actions.

Manual publish:
```bash
npm publish --access public
```

### MCP Registry

This server is registered at [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io) as `io.github.pagelines/n8n-mcp`.

The `server.json` file contains the registry metadata.

## License

MIT
