## ADDED Requirements

### Requirement: Pretty reporter
The Surface subsystem SHALL provide a human-readable reporter that groups findings for terminal display and clearly indicates when there are no findings.

#### Scenario: Empty result renders cleanly
- **WHEN** the pretty reporter renders a result with no findings
- **THEN** it prints a clear "no issues found" style summary rather than empty or malformed output

### Requirement: JSON reporter
The Surface subsystem SHALL provide a JSON reporter that emits a stable, parseable object containing `findings`, `skips`, and `stats`.

#### Scenario: JSON output is parseable and complete
- **WHEN** the JSON reporter renders a result
- **THEN** the output parses as JSON and contains the `findings`, `skips`, and `stats` keys

### Requirement: Echo diagnostics gated by debug
By default the engine SHALL print only findings and SHALL NOT print skip diagnostics. When `--debug` (or `debug: true` in config) is enabled, each recorded skip SHALL be printed with its reason and source location.

#### Scenario: Skips hidden by default
- **WHEN** a run records skips and debug is not enabled
- **THEN** the printed report contains the findings but none of the skip diagnostics

#### Scenario: Skips shown under debug
- **WHEN** the same run is executed with debug enabled
- **THEN** each skip is printed with its reason and source location

### Requirement: Silent-unless-certain reporting
The engine SHALL report only findings it is certain about. An uncertain item SHALL be recorded as a skip (visible only under debug) and SHALL NOT appear as a finding.

#### Scenario: Uncertain item never becomes a finding
- **WHEN** the engine encounters an item it cannot prove is dead
- **THEN** that item is recorded as a skip and is absent from `findings`
