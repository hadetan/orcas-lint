## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Type exports are detected the same as value exports
The `dead-export` Hunter SHALL apply identical detection logic to type-only exports (`export type Foo = …`, `export interface Bar { … }`). A type export with no importers is reported as a `dead-export` finding using the same rule ID — type exports are not a distinct capability.

#### Scenario: A type alias with no importers is reported
- **WHEN** a module contains `export type DeadType = string` and no module imports `DeadType`
- **THEN** a `dead-export` finding is reported for `DeadType`

#### Scenario: An interface with no importers is reported
- **WHEN** a module contains `export interface DeadInterface { … }` and no module imports it
- **THEN** a `dead-export` finding is reported for `DeadInterface`

#### Scenario: A type export consumed only via `import type` is not reported
- **WHEN** another module does `import type { Foo } from './types'` and uses `Foo` in a type position
- **THEN** no `dead-export` finding is produced for `Foo`

### Requirement: Detects dead CJS named exports
The `dead-export` Hunter SHALL detect named CJS exports that have no consumers. Named CJS exports include properties of a `module.exports = { … }` literal and `exports.foo = …` property assignments. A named CJS export with no consumers is reported as a `dead-export` finding.

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
