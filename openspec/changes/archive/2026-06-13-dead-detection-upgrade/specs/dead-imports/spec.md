## ADDED Requirements

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
