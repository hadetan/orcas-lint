# dead-exports Specification

## Purpose
Detect exported symbols that no module in the analyzed workspace consumes — checked at the individual export level, not the file level. Covers ESM named/default/type exports and CJS named exports from `module.exports` and `exports.X` patterns. A symbol is dead when it is not live: not an entry-point export, not directly imported by any module, and not transitively reached through a live re-export chain.

## Requirements

### Requirement: Reports unused exports
The `dead-export` Hunter SHALL check each export **individually** in every non-entry-point file. A file that is reachable from entry points (because some of its exports are consumed) is NOT skipped — only the specific live exports within it are exempt. An export is reported when it is not live: not directly imported by any module in the workspace and not transitively consumed through a live re-export chain.

#### Scenario: A dead export in a reachable file is reported
- **WHEN** a module (not an entry point) exports `helperA` and `helperB`, only `helperA` is imported elsewhere, and `helperB` has no importers
- **THEN** a `dead-export` finding is reported for `helperB`; no finding is reported for `helperA`

#### Scenario: An export imported by nobody is reported
- **WHEN** a module exports `helperNobodyCalls` and no other module imports it and it is not an entry point
- **THEN** a `dead-export` finding is reported at the export location

### Requirement: Never flags entry points or their exports
The `dead-export` Hunter SHALL NOT report any symbol exported from a file that is an entry point (a file reachable from `package.json` `main`/`module`/`exports`/`bin`/`types` or a user-declared `entry` glob). Only entry-point files themselves are skipped wholesale — not all reachable files.

#### Scenario: A symbol exported from a package entry is not reported
- **WHEN** a symbol is part of the package's `exports` or `bin` entry surface
- **THEN** no `dead-export` finding is produced for it

#### Scenario: A symbol in a non-entry-point reachable file is still checked
- **WHEN** file `src/utils.ts` is reachable (some of its exports are used) but not an entry point, and exports `deadHelper` that no module imports
- **THEN** a `dead-export` finding is reported for `deadHelper`

### Requirement: Type exports are detected the same as value exports
The `dead-export` Hunter SHALL apply identical detection logic to type-only exports (`export type Foo = …`, `export interface Bar { … }`). A type export with no importers (neither `import type { Foo }` nor `import { Foo }` from any module) is reported as a `dead-export` finding. No separate rule ID is used — type exports are not a distinct capability.

#### Scenario: A type alias with no importers is reported
- **WHEN** a module contains `export type DeadType = string` and no module imports `DeadType`
- **THEN** a `dead-export` finding is reported for `DeadType`

#### Scenario: An interface with no importers is reported
- **WHEN** a module contains `export interface DeadInterface { … }` and no module imports it
- **THEN** a `dead-export` finding is reported for `DeadInterface`

#### Scenario: A type export consumed only via `import type` is not reported
- **WHEN** another module does `import type { Foo } from './types'` and uses `Foo` in a type position
- **THEN** no `dead-export` finding is produced for `Foo`

### Requirement: Follows re-export and barrel chains
The `dead-export` Hunter SHALL treat a symbol transitively consumed through a live re-export chain as used. A symbol whose only re-export path is dead (unreachable and unimported) SHALL be reported.

#### Scenario: A symbol used via a live barrel re-export is not reported
- **WHEN** `index.ts` re-exports `x` from `./impl` and a reachable module imports `x` from `index.ts`
- **THEN** no `dead-export` finding is produced for `x` in `./impl`

#### Scenario: A symbol re-exported only by a dead barrel is reported
- **WHEN** `x` in `./impl` is re-exported only by a barrel that itself has no importers and is not an entry point
- **THEN** a `dead-export` finding is reported for `x`

### Requirement: Detects dead CJS named exports
The `dead-export` Hunter SHALL apply the same detection logic to named CJS exports: properties in a `module.exports = { … }` literal and `exports.foo = …` property assignments. A CJS named export with no consumers (no destructured `require` of that name from any module) is reported as a `dead-export` finding.

#### Scenario: A CJS named export with no consumers is reported
- **WHEN** a file does `module.exports = { alpha, beta }` and no other file does `const { beta } = require('./this-file')`
- **THEN** a `dead-export` finding is reported for `beta`

#### Scenario: A CJS property export with no consumers is reported
- **WHEN** a file does `exports.gamma = value` and no other file destructures `gamma` from a require of that file
- **THEN** a `dead-export` finding is reported for `gamma`

#### Scenario: A CJS named export consumed by a destructured require is not reported
- **WHEN** another file does `const { alpha } = require('./this-file')`
- **THEN** no `dead-export` finding is produced for `alpha`

#### Scenario: A dynamic or non-literal `module.exports` is not analyzed
- **WHEN** a file does `module.exports = someVariable` (not a literal object)
- **THEN** no findings or skips are produced for that file's CJS exports

### Requirement: Skips when the consumer cannot be seen
When an export may be consumed through an unresolved specifier, a re-export crossing the analyzed-project boundary, or a non-literal dynamic import, the `dead-export` Hunter SHALL record an Echo skip rather than report a finding.

#### Scenario: An export potentially consumed outside the project is skipped
- **WHEN** the only path to an export is a re-export whose target resolves outside the analyzed project
- **THEN** the export yields a skip with reason `escapes-boundary` and no `dead-export` finding

#### Scenario: An export targeted by a non-literal dynamic import is skipped
- **WHEN** a module performs `import(variable)` that could resolve to the exporting module
- **THEN** affected exports yield a skip with reason `dynamic-access` and no `dead-export` finding

### Requirement: Test files are consumers, not subjects
By default the `dead-export` Hunter SHALL treat a test file's imports as real consumption, so an export consumed only by a test is not reported, and SHALL NOT report findings located in a test file. In `production` mode, test files are excluded from analysis, so an export consumed only by a test SHALL be reported as dead.

#### Scenario: An export used only by a test is not flagged by default
- **WHEN** a production module's export is imported only by a test file and default (non-production) analysis runs
- **THEN** no `dead-export` finding is produced for that export

#### Scenario: A test-only export is flagged in production mode
- **WHEN** the same export is analyzed with `production` enabled (test files excluded)
- **THEN** a `dead-export` finding is reported for that export
