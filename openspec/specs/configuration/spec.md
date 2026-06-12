## ADDED Requirements

### Requirement: Zero-config defaults
The engine SHALL run with no configuration file present, applying built-in defaults for project globs, rule severities, budgets, and reporter.

#### Scenario: Runs without a config file
- **WHEN** `analyze()` or the CLI runs in a project that has no `orcas.config.*`
- **THEN** the run succeeds using default settings and does not error on missing config

### Requirement: Config discovery and formats
The engine SHALL discover and load configuration from `orcas.config.{ts,js,mjs,json,yaml}` at the project root, and SHALL provide a typed `defineConfig` helper for authoring. Loaded values SHALL override the corresponding defaults.

#### Scenario: Config overrides defaults
- **WHEN** a project contains an `orcas.config.ts` that sets a non-default reporter
- **THEN** the loaded configuration reflects that reporter instead of the default

### Requirement: Per-rule severities
Each rule SHALL accept a severity of `off`, `warn`, or `error`. A rule set to `off` SHALL never produce a reported finding.

#### Scenario: Disabled rule is silent
- **WHEN** a rule's severity is configured as `off`
- **THEN** no finding for that rule appears in the result

### Requirement: Ignore globs
The engine SHALL exclude files matching configured `ignore` globs from analysis.

#### Scenario: Ignored file is not analyzed
- **WHEN** a file matches a configured `ignore` glob
- **THEN** that file is not included in the analyzed file set reported in `stats`

### Requirement: Invalid configuration is reported, not fatal
When configuration is malformed or invalid, the engine SHALL surface a clear configuration error rather than crashing with an unhandled exception.

#### Scenario: Malformed config produces a usage error
- **WHEN** the config file is syntactically invalid or fails schema validation
- **THEN** the engine reports a configuration error and the CLI exits with the usage-error code
