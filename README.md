# n8n MCP Server

> Version control, validation, and patch-based updates for n8n workflows.

[![npm version](https://img.shields.io/npm/v/@pagelines/n8n-mcp.svg)](https://www.npmjs.com/package/@pagelines/n8n-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Install

```bash
npx @pagelines/n8n-mcp
```

Add to MCP config (`~/.claude/mcp.json`):

```json
{
  "mcpServers": {
    "n8n": {
      "command": "npx",
      "args": ["-y", "@pagelines/n8n-mcp"],
      "env": {
        "N8N_API_URL": "https://your-n8n.com",
        "N8N_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Tools

### Workflow Operations

| Tool | Description |
|------|-------------|
| `workflow_list` | List all workflows |
| `workflow_get` | Get workflow by ID |
| `workflow_create` | Create new workflow |
| `workflow_update` | Patch-based updates (preserves parameters) |
| `workflow_delete` | Delete workflow |
| `workflow_activate` | Enable triggers |
| `workflow_deactivate` | Disable triggers |
| `workflow_execute` | Execute via webhook |

### Quality & Validation

| Tool | Description |
|------|-------------|
| `workflow_validate` | Check best practices, expressions, circular refs |
| `workflow_autofix` | Auto-fix snake_case, explicit refs, AI settings |
| `workflow_format` | Sort nodes, clean nulls |

### Version Control

| Tool | Description |
|------|-------------|
| `version_list` | List saved versions |
| `version_get` | Get specific version |
| `version_save` | Manual snapshot |
| `version_rollback` | Restore previous version |
| `version_diff` | Compare versions |

## Validation Rules

| Rule | Severity |
|------|----------|
| `snake_case` naming | warning |
| Explicit refs (`$('node')` not `$json`) | warning |
| No hardcoded secrets | error |
| No orphan nodes | warning |
| AI structured output | warning |
| Expression syntax | error |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `N8N_API_URL` | Your n8n instance URL |
| `N8N_API_KEY` | API key from n8n settings |
| `N8N_MCP_VERSIONS` | Enable version control (default: true) |
| `N8N_MCP_MAX_VERSIONS` | Max versions per workflow (default: 20) |

## License

MIT - [PageLines](https://github.com/pagelines)
