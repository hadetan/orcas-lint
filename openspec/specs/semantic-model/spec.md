# semantic-model Specification

## Purpose
TBD - created by archiving change detect-dead-imports-exports. Update Purpose after archive.
## Requirements
### Requirement: File parsing and symbol extraction
Sonar SHALL parse each discovered source file and extract its import bindings and export records. Each import binding SHALL carry its source specifier, local name, kind (`named`, `default`, `namespace`, or `side-effect`), the original imported name where applicable, and a type-only flag. Each export record SHALL carry its exported name (`default` for default exports), kind (`named`, `default`, `star-reexport`, or `named-reexport`), the re-export source specifier where applicable, and a type-only flag.

#### Scenario: Extracts named, default, and namespace imports
- **WHEN** a module imports `import a, { b, c as d } from './m'` and `import * as ns from './n'`
- **THEN** Sonar records a default binding `a`, named bindings `b` and `d` (imported name `c`), and a namespace binding `ns`, each with its resolved specifier

#### Scenario: Extracts named, default, star, and re-export exports
- **WHEN** a module declares `export const x = 1`, `export default fn`, `export * from './y'`, and `export { z } from './w'`
- **THEN** Sonar records a `named` export `x`, a `default` export, a `star-reexport` from `./y`, and a `named-reexport` `z` from `./w`

#### Scenario: Records a side-effect import as such
- **WHEN** a module contains `import './styles.css'`
- **THEN** Sonar records a `side-effect` import binding with no local name

### Requirement: Module resolution
Sonar SHALL resolve module specifiers to absolute file paths using `oxc-resolver`, honoring `tsconfig` `paths` aliases and implicit extensions. When a specifier cannot be resolved, resolution SHALL yield `null` and SHALL NOT throw or abort the run.

#### Scenario: Resolves a relative specifier with an implicit extension
- **WHEN** `./util` is imported from a file and `./util.ts` exists
- **THEN** resolution returns the absolute path to `./util.ts`

#### Scenario: Resolves a tsconfig path alias
- **WHEN** `tsconfig` maps `@app/*` to `src/*` and a file imports `@app/util`
- **THEN** resolution returns the absolute path to `src/util.ts`

#### Scenario: Unresolved specifier yields null without error
- **WHEN** a file imports a specifier that resolves to nothing in the project
- **THEN** resolution returns `null` and the run continues

### Requirement: Reference resolution within a module
Sonar SHALL report the number of references to an imported binding within its declaring module, counting usages in value positions, type positions, and JSX. The import declaration itself SHALL NOT count as a reference.

#### Scenario: A used import has at least one reference
- **WHEN** an imported binding `f` is called as `f()` in the module body
- **THEN** the binding's reference count is at least 1

#### Scenario: A type-only usage counts as a reference
- **WHEN** an imported binding `T` is used only in a type annotation
- **THEN** the binding's reference count is at least 1

#### Scenario: A JSX usage counts as a reference
- **WHEN** an imported binding `Comp` is used only as `<Comp />`
- **THEN** the binding's reference count is at least 1

#### Scenario: An unused import has zero references
- **WHEN** an imported binding is never used anywhere in the module
- **THEN** the binding's reference count is 0

### Requirement: Module graph with re-export following
Sonar SHALL build a directed graph of files connected by import and export edges, and SHALL follow re-export edges (`export *`, `export { x } from`) so that a symbol re-exported through one or more barrels links to its origin. Graph traversal SHALL use a visited-set so that import cycles and circular re-exports terminate.

#### Scenario: A re-export edge links a barrel to the origin
- **WHEN** `index.ts` contains `export { x } from './impl'`
- **THEN** the graph links `index.ts`'s exported `x` to its origin declaration in `./impl`

#### Scenario: An import cycle terminates
- **WHEN** module A imports B and B imports A
- **THEN** graph construction and traversal terminate without infinite looping

### Requirement: Cross-module importers
Sonar SHALL answer which sites import a given file's exported name, including direct importers and re-export sites in other modules.

#### Scenario: A direct importer is reported
- **WHEN** module B contains `import { x } from './a'`
- **THEN** `importersOf('a', 'x')` includes a site in module B

#### Scenario: A re-export site counts as an importer of the origin
- **WHEN** a barrel contains `export { x } from './a'`
- **THEN** `importersOf('a', 'x')` includes the barrel's re-export site

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

### Requirement: Test-file classification
Sonar SHALL classify analyzed files as test files using the configured `tests` globs and expose this via `isTest(file)`. Test files SHALL remain in the model (so their imports count as consumption) in default mode, and SHALL be excluded from the analyzed set when `production` is enabled.

#### Scenario: A test file is classified as a test
- **WHEN** a discovered file matches a `tests` glob (e.g. `*.test.ts`)
- **THEN** `isTest` returns true for that file and it still appears in the analyzed file set

#### Scenario: Production mode excludes test files
- **WHEN** analysis runs with `production` enabled
- **THEN** files matching the `tests` globs are absent from the analyzed file set

### Requirement: CJS `require()` tracking in `ModuleInfo`
Sonar SHALL capture CJS `require('literal')` calls during module parsing and expose them on `ModuleInfo` as `requires: readonly RequireBinding[]`. A `RequireBinding` holds the raw specifier string, the resolved in-project target path (or `null` when unresolvable or external), and the source location of the call. Only calls where the argument is a string literal or no-substitution template literal are captured; calls with dynamic/variable arguments are silently skipped.

#### Scenario: A `require('pkg')` call is captured as a RequireBinding
- **WHEN** a file contains `const x = require('lodash')`
- **THEN** `ModuleInfo.requires` includes an entry with `specifier: 'lodash'` and `resolvedFile: null` (external package)

#### Scenario: A destructured `require` is captured
- **WHEN** a file contains `const { join } = require('path')`
- **THEN** `ModuleInfo.requires` includes an entry with `specifier: 'path'`

#### Scenario: A `require()` targeting a relative path resolves to an in-project file
- **WHEN** a file contains `require('./utils')` and `utils.ts` exists in the project
- **THEN** `ModuleInfo.requires` includes an entry with `resolvedFile: 'utils.ts'` (relative to `cwd`)

#### Scenario: A dynamic `require(variable)` is not captured
- **WHEN** a file contains `require(someVariable)` where the argument is not a string literal
- **THEN** no `RequireBinding` is added to `ModuleInfo.requires` for that call

#### Scenario: `require.resolve('pkg')` is not captured
- **WHEN** a file contains `require.resolve('some-package')`
- **THEN** no `RequireBinding` is added — `require.resolve` is a resolution helper, not an import

#### Scenario: A file with no `require()` calls has an empty `requires` array
- **WHEN** a file uses only ESM `import` declarations
- **THEN** `ModuleInfo.requires` is an empty array

### Requirement: `buildEdges` includes CJS require edges
The module-graph edge builder SHALL add a directed edge from file A to file B when A contains `require('./b')` (or equivalent) and the specifier resolves to B within the project. This ensures reachability computation is correct for CJS projects.

#### Scenario: A CJS file required by an entry point is reachable
- **WHEN** entry point `index.js` contains `require('./utils')` and `utils.js` is in the project
- **THEN** `utils.js` is reachable (not flagged as a dead file)

#### Scenario: A CJS file required only by an unreachable file is also unreachable
- **WHEN** orphan `a.js` contains `require('./b')` and neither `a.js` nor `b.js` are reachable from any entry point
- **THEN** both `a.js` and `b.js` are unreachable

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

