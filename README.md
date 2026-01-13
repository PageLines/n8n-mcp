# n8n MCP Server

Workflow validation, version control, and patch-based updates for n8n.

## The Problem

Other n8n MCPs replace entire nodes on update—losing parameters you didn't touch. No rollback. 70MB of SQLite for node docs you can Google.

## This MCP

| Feature | This | Others |
|---------|------|--------|
| Update approach | Patch (preserves params) | Replace (loses params) |
| Version control | Auto-snapshot before mutations | Manual/none |
| Validation | Expression syntax, circular refs, secrets | Basic |
| Auto-fix | snake_case, $json→$('node'), AI settings | None |
| Size | ~1,200 LOC, zero deps | 10k+ LOC, 70MB SQLite |

## Install

```bash
npx @pagelines/n8n-mcp
```

Add to `~/.claude/mcp.json`:

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

| Category | Tools |
|----------|-------|
| Workflow | `list` `get` `create` `update` `delete` `activate` `deactivate` `execute` |
| Execution | `list` `get` |
| Validation | `validate` `autofix` `format` |
| Versions | `list` `get` `save` `rollback` `diff` `stats` |

## Validation

| Rule | Severity | Auto-fix |
|------|----------|----------|
| snake_case naming | warning | Yes |
| Explicit refs (`$('node')` not `$json`) | warning | Yes |
| AI structured output | warning | Yes |
| Hardcoded secrets | error | No |
| Orphan nodes | warning | No |
| Expression syntax | error | No |
| Circular references | error | No |

## Config

| Variable | Default | Description |
|----------|---------|-------------|
| `N8N_API_URL` | required | n8n instance URL |
| `N8N_API_KEY` | required | API key |
| `N8N_MCP_VERSIONS` | `true` | Enable version control |
| `N8N_MCP_MAX_VERSIONS` | `20` | Max snapshots per workflow |

## Docs

- [Best Practices](docs/best-practices.md) - Expression patterns, config nodes, AI settings
- [Node Config](docs/node-config.md) - Human-editable node settings (`__rl`, Set node, etc.)
- [Architecture](plans/architecture.md) - Technical reference

## License

MIT - [PageLines](https://github.com/pagelines)
