## ADDED Requirements

### Requirement: Reports unused exports
The `dead-export` Hunter SHALL report an exported symbol as a `dead-export` finding at HIGH certainty when no module in the analyzed set imports it (directly or through a re-export) **and** it is not reachable from any entry point.

#### Scenario: An export imported by nobody is reported
- **WHEN** a module exports `helperNobodyCalls` and no other module imports it and it is not an entry point
- **THEN** a `dead-export` finding is reported at the export location

### Requirement: Never flags entry points or public API
The `dead-export` Hunter SHALL NOT report any symbol that is an entry point or reachable from one, nor any symbol imported by another module in the analyzed set. This preserves a library's public API.

#### Scenario: A symbol exported from a package entry is not reported
- **WHEN** a symbol is part of the package's `exports` or `bin` entry surface
- **THEN** no `dead-export` finding is produced for it

#### Scenario: A symbol imported by a sibling module is not reported
- **WHEN** module B imports a symbol exported by module A
- **THEN** no `dead-export` finding is produced for that symbol in A

### Requirement: Follows re-export and barrel chains
The `dead-export` Hunter SHALL treat a symbol consumed only through a re-export (barrel) chain as used. A symbol whose only re-export path is itself unreachable and unimported SHALL be reported.

#### Scenario: A symbol used via a barrel re-export is not reported
- **WHEN** `index.ts` re-exports `x` from `./impl` and a reachable module imports `x` from `index.ts`
- **THEN** no `dead-export` finding is produced for `x` in `./impl`

#### Scenario: A symbol re-exported only by an unreachable barrel is reported
- **WHEN** `x` in `./impl` is re-exported only by a barrel that is itself unreachable and imported by nobody
- **THEN** a `dead-export` finding is reported for `x`

### Requirement: Skips when the consumer cannot be seen
When an export may be consumed through an unresolved specifier, a non-literal dynamic import, or a re-export crossing the analyzed-project boundary, the `dead-export` Hunter SHALL record an Echo skip rather than report a finding.

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
