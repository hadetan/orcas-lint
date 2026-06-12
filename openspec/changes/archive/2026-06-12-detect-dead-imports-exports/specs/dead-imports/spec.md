## ADDED Requirements

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
