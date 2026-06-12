## Purpose
Establish the foundational engine architecture: programmatic and CLI entry points, the orchestrated pipeline that stages discovery/parsing/graph-building/hunter-execution, safety budgets for cycles and timeouts, the Hunter contract and registry, and guaranteed deterministic output.
## Requirements
### Requirement: Programmatic analyze() API
The engine SHALL expose a programmatic `analyze(options)` entry point that runs the full pipeline and returns an `AnalyzeResult` containing `findings`, `skips`, and `stats`. The CLI SHALL be a thin wrapper over this same function.

#### Scenario: Returns a well-formed result on an empty registry
- **WHEN** `analyze()` is invoked on any project while no detection Hunters are registered
- **THEN** it returns a result whose `findings` and `skips` are empty arrays and whose `stats` reports a non-negative file count and duration

#### Scenario: CLI and API produce identical results
- **WHEN** the `orcas` CLI and a direct `analyze()` call are run over the same project with the same config
- **THEN** the resulting `findings` and `skips` are identical

### Requirement: Orchestrated pipeline
The `Pod` orchestrator SHALL run the analysis as ordered stages (load config → discover files → parse/resolve → build graph seams → run Hunter registry → collect findings/skips) and SHALL return a result even when intermediate stages produce nothing.

#### Scenario: Pipeline completes end-to-end
- **WHEN** the pipeline is run over a small project
- **THEN** every stage executes in order and a valid `AnalyzeResult` is returned without error

### Requirement: Safety and loop budgets
The engine SHALL enforce a configurable interprocedural depth limit, a per-file timeout, and a global wall-clock budget, and SHALL use visited-sets so that cyclic inputs cannot cause unbounded traversal. When a budget is exceeded the engine SHALL stop safely and return partial results rather than hang or crash.

#### Scenario: Cyclic input terminates
- **WHEN** the engine processes input containing a circular reference (e.g. a module import cycle)
- **THEN** analysis terminates and returns a result without infinite looping

#### Scenario: Global time budget is honored
- **WHEN** the global wall-clock budget is exceeded during a run
- **THEN** the engine halts, marks the result as partial in `stats`, and returns the work completed so far

### Requirement: Hunter contract and registry
The engine SHALL define a single Hunter contract that every tracker implements, and a registry that enables, orders, and invokes registered Hunters uniformly. Each Hunter SHALL emit zero or more `findings` and zero or more `skips`.

#### Scenario: Registered Hunter output is aggregated
- **WHEN** a no-op test Hunter that emits one finding and one skip is registered and the pipeline runs
- **THEN** the result contains that finding and that skip

#### Scenario: Empty registry yields nothing
- **WHEN** the pipeline runs with no Hunters registered
- **THEN** the result contains zero findings and zero skips

### Requirement: Deterministic results
Given identical inputs and configuration, the engine SHALL produce identical and stably-ordered `findings` and `skips` across runs.

#### Scenario: Repeated runs match
- **WHEN** `analyze()` is run twice over the same project and config
- **THEN** the two results are deeply equal, including ordering

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

