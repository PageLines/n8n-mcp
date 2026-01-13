<img src="logo.png" width="64" height="64" alt="PageLines">

# n8n MCP Server

**Opinionated** workflow automation for n8n. Enforces best practices, auto-fixes issues, and prevents mistakes.

## Why This MCP?

**The problem:** Other n8n MCPs replace entire nodes when you update one field. Change a message? Lose your channel ID, auth settings, everything else. No undo. And they bundle 70MB of node docs you can just Google.

**This MCP is opinionated:**
- **Patches, not replaces** - Update one field, keep everything else
- **Auto-cleanup** - Every create/update validates, auto-fixes, and formats automatically
- **Auto-snapshots** - Every mutation saves a version first. Always have rollback.
- **Node type validation** - Blocks invalid node types with suggestions before they hit n8n
- **Expression validation** - Catches `$json` refs that break on reorder, circular deps, missing nodes
- **Enforces conventions** - snake_case naming, explicit references, recommends env vars
- **Lightweight** - ~1,500 lines, zero runtime dependencies

| | This MCP | Others |
|--|----------|--------|
| Update a node | Preserves untouched params | Loses them |
| After create/update | Auto-validates, auto-fixes, formats | Manual cleanup |
| Invalid node types | Blocked with suggestions | API error |
| Before mutations | Auto-saves version | Hope you backed up |
| Expression validation | Syntax, refs, circular deps | Basic |
| Size | ~1,500 LOC | 10k+ LOC, 70MB SQLite |

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
| Discovery | `node_types_list` |
| Versions | `list` `get` `save` `rollback` `diff` `stats` |

### Opinions Enforced

These rules are checked and auto-fixed on every `workflow_create` and `workflow_update`:

| Rule | Severity | Auto-fix |
|------|----------|----------|
| snake_case naming | warning | Yes |
| Explicit refs (`$('node')` not `$json`) | warning | Yes |
| AI structured output settings | warning | Yes |
| Invalid node types | error | Blocked |
| Hardcoded secrets | info | No |
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
