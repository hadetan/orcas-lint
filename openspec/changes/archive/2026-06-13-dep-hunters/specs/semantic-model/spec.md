## ADDED Requirements

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
