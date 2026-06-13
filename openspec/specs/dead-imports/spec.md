# dead-imports Specification

## Purpose
Detect imported bindings that are never referenced within their declaring module. Covers ESM named, default, and namespace imports and CJS destructured require bindings. Side-effect imports and bindings referenced only in type or JSX positions are never flagged.

## Requirements

### Requirement: Reports unreferenced imports
The `dead-import` Hunter SHALL report an imported binding that has zero references within its declaring module as a `dead-import` finding at HIGH certainty, locating the finding at the import binding.

#### Scenario: An unused named import is reported
- **WHEN** a module imports `{ formatDate }` and never references `formatDate`
- **THEN** a `dead-import` finding is reported for `formatDate` at its import location

#### Scenario: An unused default import is reported
- **WHEN** a module has `import foo from './m'` and never references `foo`
- **THEN** a `dead-import` finding is reported for `foo`

#### Scenario: An unused namespace import is reported
- **WHEN** a module has `import * as ns from './m'` and never references `ns`
- **THEN** a `dead-import` finding is reported for `ns`

### Requirement: Never flags side-effect imports
The `dead-import` Hunter SHALL NOT report bare side-effect imports, which have no binding and are present for their evaluation effect.

#### Scenario: A side-effect import is not reported
- **WHEN** a module contains `import './register-globals'`
- **THEN** no `dead-import` finding is produced for it

### Requirement: Counts type-only and JSX usage as reads
The `dead-import` Hunter SHALL treat a binding used only in a type position, or only as a JSX element, as referenced, and SHALL NOT report it.

#### Scenario: A type-only import used in a type position is not reported
- **WHEN** `import type { User } from './types'` is used only in a parameter type annotation
- **THEN** no `dead-import` finding is produced for `User`

#### Scenario: An import used only in JSX is not reported
- **WHEN** an imported component `Button` is used only as `<Button />`
- **THEN** no `dead-import` finding is produced for `Button`

### Requirement: Reports unreferenced CJS destructured require bindings
The `dead-import` Hunter SHALL apply the same zero-reference check to named bindings introduced by destructured CJS `require()` calls with a literal specifier. A name destructured from `require('literal')` that is never referenced in the module is reported as a `dead-import` finding.

#### Scenario: An unused destructured CJS binding is reported
- **WHEN** a module has `const { formatDate } = require('./utils')` and never references `formatDate`
- **THEN** a `dead-import` finding is reported for `formatDate`

#### Scenario: A used destructured CJS binding is not reported
- **WHEN** a module has `const { formatDate } = require('./utils')` and calls `formatDate()`
- **THEN** no `dead-import` finding is produced for `formatDate`

### Requirement: Skips whole-object CJS require bindings without destructuring
When a `require()` result is bound to an identifier without destructuring, the Hunter cannot prove which properties are actually used. It SHALL record an Echo skip with reason `cjs-whole-require` rather than a finding.

#### Scenario: A whole-object require skip is recorded
- **WHEN** a module has `const utils = require('./utils')` (no destructuring) and `utils` is referenced
- **THEN** no `dead-import` finding is produced; a skip with reason `cjs-whole-require` is recorded for that binding

#### Scenario: A dynamic require specifier is silently ignored
- **WHEN** a module contains `require(dynamicPath)` with a non-literal argument
- **THEN** no finding and no skip are produced

### Requirement: Skips when references cannot be determined within budget
When the references of an import binding cannot be resolved with certainty within the per-file analysis budget, the `dead-import` Hunter SHALL record an Echo skip rather than report a finding.

#### Scenario: A file exceeding the per-file budget is skipped, not flagged
- **WHEN** reference resolution for a module is cut off by the per-file timeout
- **THEN** its imports yield a skip with reason `budget-exceeded` and no `dead-import` finding

### Requirement: Never reports findings in test files
The `dead-import` Hunter SHALL NOT report findings located in a test file. Test files are read for their usage edges (so they keep production exports alive) but are never themselves subjects of a finding.

#### Scenario: An unused import in a test file is not reported
- **WHEN** a test file imports a binding it never references
- **THEN** no `dead-import` finding is produced for that test file

### Requirement: JSX factory imports are runtime-aware
The `dead-import` Hunter SHALL treat the JSX factory import (e.g. `React`) as used when a module contains JSX and the project uses the classic JSX runtime, and SHALL report it as unused when the project uses the automatic JSX runtime and the import is otherwise unreferenced.

#### Scenario: A React import used only via classic-runtime JSX is not reported
- **WHEN** a module under `jsx: react` imports `React` and uses it only through JSX syntax
- **THEN** no `dead-import` finding is produced for `React`

#### Scenario: An unnecessary React import under the automatic runtime is reported
- **WHEN** a module under `jsx: react-jsx` imports `React` but only uses JSX (which needs no `React` import)
- **THEN** a `dead-import` finding is reported for `React`
