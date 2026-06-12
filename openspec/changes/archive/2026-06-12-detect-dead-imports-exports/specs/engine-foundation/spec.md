## ADDED Requirements

### Requirement: Semantic model available to Hunters
The pipeline SHALL construct a read-only semantic model after the parse/resolve stage and expose it on the Hunter context before the Hunter registry runs. The model SHALL provide, at minimum, the analyzed files, each module's import bindings and export records, specifier resolution, the entry-point set, file reachability, and cross-module importers. Hunters SHALL receive this model as a read-only view and SHALL NOT mutate it. The value-graph slot on the context SHALL remain absent unless a value-flow rule is enabled.

#### Scenario: A Hunter can query a file's imports and exports through the context
- **WHEN** a Hunter runs and calls the semantic model for a given file
- **THEN** it receives that file's import bindings and export records without accessing the underlying parser directly

#### Scenario: The model is complete before any Hunter runs
- **WHEN** a whole-program query such as "who imports this export" is made by a Hunter
- **THEN** the answer reflects every analyzed module, because the model is fully built before the registry runs

#### Scenario: The value-graph slot is absent on a reachability-only run
- **WHEN** the pipeline runs with only reachability rules enabled
- **THEN** the Hunter context exposes the semantic model and the value-graph slot is absent
