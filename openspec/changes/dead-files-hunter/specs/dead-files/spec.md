## ADDED Requirements

### Requirement: Report unreachable project files
The `dead-file` Hunter SHALL report every project file that is not reachable from any entry point through the resolved static import graph. A file is unreachable when no sequence of static import or re-export edges from any entry point leads to it. Each finding SHALL use rule `dead-file`, the configured severity, a human-readable message, and a source location of `line: 1, column: 1` (file-level diagnostic convention).

#### Scenario: An orphaned file with no importers is reported
- **WHEN** a file exists in the project and no other file imports it and it is not an entry point
- **THEN** a `dead-file` finding is emitted for that file

#### Scenario: A file in a dead import chain is reported
- **WHEN** file A is unreachable and file A imports file B (so B is also unreachable)
- **THEN** both A and B each receive a `dead-file` finding

#### Scenario: An entry point is never reported as dead
- **WHEN** a file is listed as an entry point (via `package.json` or `entry` config)
- **THEN** no `dead-file` finding is emitted for it

#### Scenario: A file reachable through a re-export chain is not reported
- **WHEN** entry → barrel.ts → impl.ts (via `export * from`)
- **THEN** no `dead-file` finding is emitted for impl.ts

### Requirement: Skip test files silently
The `dead-file` Hunter SHALL NOT emit findings or skip records for files classified as test files. Test files are considered to have the test runner as their implicit entry point, which is outside the static import graph.

#### Scenario: A test file with no importer is not reported
- **WHEN** a file matches the `tests` glob pattern and nothing in the project imports it
- **THEN** no `dead-file` finding or skip is emitted for it

### Requirement: Skip unreachable files when reachable code contains non-literal dynamic imports
When any reachable file contains a non-literal dynamic `import()` expression, the `dead-file` Hunter SHALL record an Echo skip (reason `dynamic-access`) for each file that would otherwise be reported, instead of emitting a finding. A non-literal dynamic import in an unreachable file SHALL NOT trigger this bail-out, since that file can never execute.

#### Scenario: Reachable code has a dynamic import — orphan is skipped
- **WHEN** a reachable file contains `import(someVariable)` and another file is unreachable
- **THEN** the unreachable file yields a skip with reason `dynamic-access` and no `dead-file` finding

#### Scenario: Dynamic import only in unreachable code — other orphan is still reported
- **WHEN** an unreachable file A contains `import(someVariable)` and a separate unreachable file B has no dynamic imports
- **THEN** a `dead-file` finding is emitted for both A and B (neither is in reachable code, so the bail-out does not trigger)

#### Scenario: No dynamic import anywhere — orphan is reported
- **WHEN** no file in the project contains a non-literal dynamic import
- **THEN** unreachable files yield `dead-file` findings without skips

### Requirement: Config files are implicit entry points
The `dead-file` Hunter (via Sonar's entry-point derivation) SHALL treat recognized build-tool config files at the project root as implicit entry points. Recognized config files are those matching `*.config.{ts,js,mjs,cjs}` at the root level (non-recursive). This prevents build-tool configuration files and their transitive imports from being flagged as dead files.

#### Scenario: A root-level config file is not reported as dead
- **WHEN** a file named `vite.config.ts` (or similar) exists at the project root and is not imported by any other project file
- **THEN** no `dead-file` finding is emitted for it

#### Scenario: A file imported only from a config file is not reported as dead
- **WHEN** `vite.config.ts` imports `./scripts/build-utils.ts` and nothing else imports `build-utils.ts`
- **THEN** no `dead-file` finding is emitted for `build-utils.ts`

#### Scenario: A nested config file is not auto-detected as an entry point
- **WHEN** a config file exists at `test/fixtures/foo/vite.config.ts` (nested, not root)
- **THEN** it is NOT automatically added to the entry set (it may still be an entry if covered by user `entry` globs)

### Requirement: Rule can be disabled
The `dead-file` rule SHALL respect the configured severity. When the rule is set to `off`, no findings or skips are emitted by this Hunter.

#### Scenario: Rule off produces no output
- **WHEN** `rules['dead-file']` is `'off'`
- **THEN** the hunter emits zero findings and zero skips
