# n8n MCP Server

Workflow validation, version control, and patch-based updates for n8n.

## Why This MCP?

**The problem:** Other n8n MCPs replace entire nodes when you update one field. Change a message? Lose your channel ID, auth settings, everything else. No undo. And they bundle 70MB of node docs you can just Google.

**This MCP:**
- **Patches, not replaces** - Update one field, keep everything else
- **Auto-snapshots** - Every mutation saves a version first. Always have rollback.
- **Validates expressions** - Catches `$json` refs that break on reorder, circular dependencies, missing nodes
- **Auto-fixes** - Renames to snake_case, converts `$json` to explicit `$('node')` refs
- **Lightweight** - 1,200 lines, zero runtime dependencies

| | This MCP | Others |
|--|----------|--------|
| Update a node | Preserves untouched params | Loses them |
| Before mutations | Auto-saves version | Hope you backed up |
| Expression validation | Syntax, refs, circular deps | Basic |
| Auto-fix issues | Yes | No |
| Size | ~1,200 LOC | 10k+ LOC, 70MB SQLite |

## Setup

Add to your MCP client config:

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

No install step needed - npx handles it.

---

## Reference

### Tools

| Category | Tools |
|----------|-------|
| Workflow | `list` `get` `create` `update` `delete` `activate` `deactivate` `execute` |
| Execution | `list` `get` |
| Validation | `validate` `autofix` `format` |
| Versions | `list` `get` `save` `rollback` `diff` `stats` |

### Validation Rules

| Rule | Severity | Auto-fix |
|------|----------|----------|
| snake_case naming | warning | Yes |
| Explicit refs (`$('node')` not `$json`) | warning | Yes |
| AI structured output | warning | Yes |
| Hardcoded secrets | error | No |
| Orphan nodes | warning | No |
| Expression syntax | error | No |
| Circular references | error | No |

### Config

| Variable | Default | Description |
|----------|---------|-------------|
| `N8N_API_URL` | required | n8n instance URL |
| `N8N_API_KEY` | required | API key |
| `N8N_MCP_VERSIONS` | `true` | Enable version control |
| `N8N_MCP_MAX_VERSIONS` | `20` | Max snapshots per workflow |

### Docs

- [Best Practices](docs/best-practices.md) - Expression patterns, config nodes, AI settings
- [Node Config](docs/node-config.md) - Human-editable node settings
- [Architecture](plans/architecture.md) - Technical reference

## License

MIT - [PageLines](https://github.com/pagelines)
