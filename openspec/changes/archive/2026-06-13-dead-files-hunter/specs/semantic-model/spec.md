## ADDED Requirements

### Requirement: Per-file dynamic import tracking
The SemanticModel SHALL track which specific files contain non-literal dynamic `import()` expressions (where the specifier is not a string literal), and SHALL expose a per-file query `hasDynamicImportIn(file: string): boolean`. The existing `hasDynamicImport(): boolean` method SHALL be preserved and SHALL return `true` when any file in the project contains a non-literal dynamic import (equivalent to checking whether the per-file set is non-empty).

#### Scenario: hasDynamicImportIn returns true for the file that has the dynamic import
- **WHEN** file `src/router.ts` contains `import(routeName)` with a variable specifier
- **THEN** `hasDynamicImportIn('src/router.ts')` returns `true`

#### Scenario: hasDynamicImportIn returns false for files without dynamic imports
- **WHEN** file `src/utils.ts` contains only static imports
- **THEN** `hasDynamicImportIn('src/utils.ts')` returns `false`

#### Scenario: hasDynamicImport() still returns true when any file has a non-literal import
- **WHEN** at least one file in the project contains a non-literal dynamic import
- **THEN** `hasDynamicImport()` returns `true` (backward-compatible behavior)

#### Scenario: A literal dynamic import does not register as a non-literal dynamic import
- **WHEN** a file contains `import('./utils')` with a string literal specifier
- **THEN** `hasDynamicImportIn` does not record that file, and `hasDynamicImport()` is unaffected

## MODIFIED Requirements

### Requirement: Entry-point derivation and reachability
Sonar SHALL derive entry points from `package.json` (`main`, `module`, `exports`, `bin`, `types`), the configuration's `entry` globs, and recognized build-tool config files at the project root matching `*.config.{ts,js,mjs,cjs}` (non-recursive). All three sources are resolved to in-project files. A file SHALL be reachable when it is an entry point or is transitively reachable from an entry point through resolved import and followed re-export edges.

#### Scenario: package.json bin and exports become entry points
- **WHEN** `package.json` contains `"bin": { "cli": "./bin/cli.js" }` and `"exports": { ".": "./src/index.ts" }`
- **THEN** both `bin/cli.js` and `src/index.ts` are in the entry set

#### Scenario: Config entry globs become entry points
- **WHEN** `orcas.config` sets `entry: ['src/index.ts', 'bin/*.ts']`
- **THEN** all matched files are in the entry set

#### Scenario: Root-level config files become entry points automatically
- **WHEN** `vite.config.ts` exists at the project root and matches `*.config.{ts,js,mjs,cjs}`
- **THEN** `vite.config.ts` is added to the entry set without requiring user configuration

#### Scenario: Nested config files are not auto-detected
- **WHEN** a file `packages/foo/vite.config.ts` exists but the project root is the workspace root
- **THEN** that nested config file is NOT added to the entry set by auto-detection
