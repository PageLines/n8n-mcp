# Changelog

All notable changes to this project will be documented in this file.

## [0.3.1] - 2025-01-13

### Fixed
- **Critical bug**: `workflow_update`, `workflow_format`, and `workflow_autofix` failing with "request/body must NOT have additional properties" error
- Root cause: n8n API returns additional read-only properties that were being sent back on PUT requests
- Solution: Schema-driven field filtering using `N8N_WORKFLOW_WRITABLE_FIELDS` allowlist (source of truth: n8n OpenAPI spec at `/api/v1/openapi.yml`)

### Changed
- Refactored `updateWorkflow` to use schema-driven approach instead of property denylist
- Added `pickFields` generic utility for type-safe field filtering
- Added comprehensive tests for schema-driven filtering

## [0.3.0] - 2025-01-13

### Added

#### Node Type Discovery & Validation
- `node_types_list` - Search available node types by name/category
- Pre-validation blocks invalid node types before `workflow_create` and `workflow_update`
- Fuzzy matching suggests correct types when invalid types detected

#### Auto-Cleanup Pipeline
- Every `workflow_create` and `workflow_update` now automatically:
  - Validates node types (blocks if invalid)
  - Runs validation rules
  - Auto-fixes fixable issues (snake_case, $json refs, AI settings)
  - Formats workflow (sorts nodes, removes nulls)
  - Returns only unfixable warnings

#### Response Formatting
- New `format` parameter on workflow/execution tools: `compact` (default), `summary`, `full`
- Token-efficient responses (88% reduction with compact, 98% with summary)

### Changed
- Hardcoded secrets: severity `error` → `info` (recommend env vars, don't block)
- Documentation updated with "opinionated" messaging throughout
- Added PageLines logo to README

## [0.2.1] - 2025-01-13

### Added
- [Node Config Guide](docs/node-config.md) - Human-editable node settings (`__rl` resource locator, Set node JSON mode, AI structured output)

### Changed
- Sharpened documentation (31% line reduction, higher data-ink ratio)
- README: Lead with differentiation, compact tool/validation tables
- Best Practices: Quick reference at top, focused on MCP-validated patterns
- Architecture: Technical reference, removed redundant philosophy sections

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
