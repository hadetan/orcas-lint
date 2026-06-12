## ADDED Requirements

### Requirement: Command runs analysis and prints a report
The `orcas` command SHALL run `analyze()` over the resolved project and print the result using the selected reporter.

#### Scenario: Default invocation prints a report
- **WHEN** `orcas` is run with no arguments in a project
- **THEN** it analyzes the project and prints a report to stdout

### Requirement: Recognized flags
The CLI SHALL recognize `--debug`, `--json`, `--reporter <pretty|json>`, `--config <path>`, `--no-cache`, `--trace-depth <n>`, `--rule <id>=<sev>`, `--production`, and `--max-time <ms>`, and SHALL map each to the corresponding engine option.

#### Scenario: JSON output flag
- **WHEN** `orcas --json` is run
- **THEN** the output is machine-readable JSON rather than the pretty format

#### Scenario: Debug flag surfaces diagnostics
- **WHEN** `orcas --debug` is run
- **THEN** the report includes skip diagnostics that are hidden by default

#### Scenario: Rule severity override
- **WHEN** `orcas --rule dead-import=off` is run
- **THEN** the engine treats the `dead-import` rule as disabled for that run

### Requirement: Standardized exit codes
The CLI SHALL exit `0` when there are no `error`-severity findings, `1` when at least one `error`-severity finding exists, and `2` on a configuration or usage error.

#### Scenario: Clean run exits zero
- **WHEN** a run produces no `error`-severity findings
- **THEN** the process exits with code `0`

#### Scenario: Error findings exit one
- **WHEN** a run produces at least one `error`-severity finding
- **THEN** the process exits with code `1`

#### Scenario: Usage error exits two
- **WHEN** the CLI is given an invalid flag or an invalid config
- **THEN** the process exits with code `2`
