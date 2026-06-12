## Why

Orcas's value lives in deep value-flow analysis, but none of it can be built — or trusted — without a stable spine: a buildable, testable project and the architectural seams (orchestration, parse/resolve, the value graph, pluggable trackers, diagnostics, reporting, cache) wired end-to-end. This change establishes that spine as a **walking skeleton**: the engine runs from both CLI and API, enforces its safety budgets, and produces a report — while detecting *nothing* yet. Doing the groundwork first means every later capability (the nine Hunters) drops into a proven, locked architecture instead of reshaping it.

## What Changes

- **Project tooling**: TS build (`tsup`), `tsc` typecheck, Vitest harness + a hermetic fixture-runner, `oxlint` + `prettier`, `.gitignore`, an MIT `LICENSE`, and a README stub — all green on an empty skeleton.
- **Source skeleton** mirroring Technical PRD §3: `cli`, `pod`, `sonar`, `atlas` (+ `current`), `hunters`, `echo`, `surface`, `den`, `config`, `constants`, `types`. Heavy subsystems are pre-chunked; all strings/limits live under `constants/`.
- **Core architectural contracts** (types/interfaces — the locked seams): `Finding`, `Skip` + `SkipReason`, `Severity`, `Certainty`, `RuleId`, `AnalyzeOptions` / `AnalyzeResult` / `Stats`; the **Hunter contract** + **registry**; interface shapes for Sonar, Atlas, and Current.
- **Working end-to-end pipeline**: `Pod` orchestrates the stages, enforces budgets (interprocedural depth, per-file timeout, global wall-clock, visited-set cycle safety), runs the (empty) Hunter registry, and returns an `AnalyzeResult`.
- **Programmatic API** `analyze()` and the **`orcas` CLI** (flags + exit codes) wired through **Surface** reporters (pretty + JSON) and **Echo** diagnostics (`--debug`).
- **Configuration**: `defineConfig`, zero-config defaults, rule severities, ignore globs, and discovery/loading via `c12`.
- **`test/` mirror of `src/`** plus a fixture-runner that proves the harness on trivial scaffolding fixtures.
- **NOT in scope** (explicit non-goals, each a later change): any detection logic (the nine Hunters' algorithms), real value-graph construction, real escape/alias analysis, real module resolution / manifest reading beyond interface wiring, cache internals, workspace/monorepo traversal, and framework plugins.

## Capabilities

### New Capabilities
- `engine-foundation`: the orchestrated run pipeline (`Pod`), the programmatic `analyze()` contract, the safety/loop budgets, and the **Hunter plugin contract + registry** that all future trackers implement.
- `configuration`: the config schema, `defineConfig`, and discovery + loading with zero-config defaults and per-rule severities.
- `cli`: the `orcas` command — argument parsing, reporter selection, and standardized exit codes.
- `reporting`: the **Surface** reporters (pretty / JSON) and the **Echo** skip-diagnostics surfaced via `--debug`.

### Modified Capabilities
<!-- None — greenfield project, no existing specs in openspec/specs/. -->

## Impact

- **New files**: tooling configs (`tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `.oxlintrc.json`, `.prettierrc`, `.gitignore`), the `src/` skeleton, the `test/` harness, `LICENSE`, README stub. `package.json` already declares the deps/scripts this relies on.
- **Dependencies** (already declared): `ts-morph`, `oxc-resolver`, `cac`, `tinyglobby`, `picocolors`, `c12`; dev: `tsup`, `vitest` (+ coverage), `oxlint`, `prettier`, `publint`, `typescript`.
- **End-user behavior**: none yet — runs are intentionally empty. This change establishes the contracts that later changes implement against, plus the self-analysis (`selfcheck`) wiring.
- **Risk**: low. There is no analysis logic to get wrong; the only real risk is locking interface shapes prematurely, mitigated by the already-locked Technical PRD.
