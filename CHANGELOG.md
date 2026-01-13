# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2025-01-12

### Added

#### Version Control System
- `version_list` - List saved versions of a workflow (stored locally in `~/.n8n-mcp/versions/`)
- `version_get` - Get a specific saved version
- `version_save` - Manually save a version snapshot
- `version_rollback` - Restore a workflow to a previous version
- `version_diff` - Compare two versions or current state vs a version
- `version_stats` - Get version control statistics
- Auto-save versions before workflow updates, rollbacks, and auto-fixes
- Configurable via `N8N_MCP_VERSIONS` and `N8N_MCP_MAX_VERSIONS` env vars

#### Auto-fix System
- `workflow_autofix` - Auto-fix common validation issues:
  - Convert names to snake_case
  - Replace `$json` with explicit `$('node_name')` references
  - Add AI structured output settings
- `workflow_format` - Format workflows: sort nodes by position, clean up null values

#### Expression Validation
- Parse and validate n8n expressions in workflow parameters
- Detect references to non-existent nodes
- Check for syntax errors (unmatched parentheses, brackets)
- Warn about deprecated patterns (`$node.` usage)
- Detect circular references in expressions
- Suggest optional chaining for deep property access

### Changed
- `workflow_validate` now includes expression validation and circular reference detection
- `workflow_update` now auto-saves a version before applying changes

## [0.1.0] - 2025-01-11

### Added
- Initial release
- Workflow operations: list, get, create, update, delete, activate, deactivate, execute
- Execution operations: list, get
- Workflow validation with best practices enforcement:
  - snake_case naming
  - Explicit node references
  - No hardcoded IDs or secrets
  - Orphan node detection
  - Code node usage detection
  - AI node structured output settings
  - In-memory storage detection
- Patch-based workflow updates with parameter preservation warnings
