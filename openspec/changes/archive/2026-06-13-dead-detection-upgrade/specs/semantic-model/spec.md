## ADDED Requirements

### Requirement: Export-level liveness predicate
The `SemanticModel` SHALL expose `isExportLive(file, exportName): boolean`. An export is live when: (a) its file is an entry point, or (b) it is directly imported by any module in the workspace, or (c) it is transitively consumed through a re-export chain that eventually reaches a live direct consumer. The computation uses a BFS seeded at entry-point exports and follows re-export chains with a visited-set to prevent cycles.

#### Scenario: An export directly imported by a reachable module is live
- **WHEN** module B imports `foo` from module A
- **THEN** `isExportLive(A, 'foo')` returns `true`

#### Scenario: An export in an entry-point file is always live
- **WHEN** file `src/index.ts` is an entry point and exports `bar`
- **THEN** `isExportLive('src/index.ts', 'bar')` returns `true` regardless of importers

#### Scenario: An export in a reachable file with no direct importers is not live
- **WHEN** file `src/utils.ts` is reachable (other exports are imported) but `deadHelper` has no importers
- **THEN** `isExportLive('src/utils.ts', 'deadHelper')` returns `false`

#### Scenario: An export re-exported through a live barrel is live
- **WHEN** `index.ts` re-exports `x` from `./impl` and a module imports `x` from `index.ts`
- **THEN** `isExportLive('./impl', 'x')` returns `true`

#### Scenario: Re-export cycles terminate without error
- **WHEN** module A re-exports from B, and B re-exports from A (circular re-export)
- **THEN** `isExportLive` terminates and does not loop infinitely

### Requirement: CJS import kinds in ImportBinding
The `ImportKind` union SHALL include `'cjs-named'` (a single name destructured from a require call: `const { foo } = require('./x')`) and `'cjs-namespace'` (a whole-object require binding: `const utils = require('./x')`). CJS bindings appear in `ModuleInfo.imports` alongside ESM bindings. `isTypeOnly` is always `false` for CJS kinds.

#### Scenario: Destructured require appears as cjs-named bindings
- **WHEN** a file contains `const { foo, bar } = require('./utils')`
- **THEN** `ModuleInfo.imports` contains two bindings with `kind: 'cjs-named'`, `importedName: 'foo'` and `importedName: 'bar'` respectively

#### Scenario: Whole-object require appears as a cjs-namespace binding
- **WHEN** a file contains `const utils = require('./utils')`
- **THEN** `ModuleInfo.imports` contains one binding with `kind: 'cjs-namespace'` and `localName: 'utils'`

### Requirement: CJS export kind in ExportRecord
The `ExportKind` union SHALL include `'cjs-named'` for exports defined via `module.exports = { … }` or `exports.X = …`. CJS export records appear in `ModuleInfo.exports` alongside ESM records.

#### Scenario: module.exports object literal produces cjs-named export records
- **WHEN** a file contains `module.exports = { alpha, beta }`
- **THEN** `ModuleInfo.exports` contains two records with `kind: 'cjs-named'`, `exportedName: 'alpha'` and `exportedName: 'beta'`

#### Scenario: exports.X assignment produces a cjs-named export record
- **WHEN** a file contains `exports.gamma = value`
- **THEN** `ModuleInfo.exports` contains a record with `kind: 'cjs-named'` and `exportedName: 'gamma'`

### Requirement: findImporters recognizes CJS consumers
`importersOf(file, exportName)` SHALL return import sites where the consumer uses a `cjs-named` binding with matching `importedName`, or a `cjs-namespace` binding (which counts as consuming all named exports of the target).

#### Scenario: A destructured require binding counts as a named consumer
- **WHEN** file B has `const { alpha } = require('./a')` and A exports `alpha` as `cjs-named`
- **THEN** `importersOf(A, 'alpha')` includes file B as an import site

#### Scenario: A whole-object require counts as consuming all named exports
- **WHEN** file B has `const utils = require('./a')` (cjs-namespace)
- **THEN** `importersOf(A, anyExportName)` includes file B for every named export of A
