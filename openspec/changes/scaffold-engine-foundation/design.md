## Context

Orcas's architecture is already locked in [`docs/technical-prd.md`](../../../docs/technical-prd.md) (subsystems Pod / Sonar / Atlas / Current / Hunters / Echo / Surface / Den, the certainty-first model, the safety budgets, the nine capabilities). This change does **not** re-decide any of that — it stands up the **walking skeleton** that those decisions imply: a project that builds, type-checks, lints, and tests, with every subsystem present as a contract and the pipeline wired end-to-end, but with **no detection logic**. A run is intentionally empty (zero findings) yet exercises config loading, orchestration, budgets, the Hunter registry, diagnostics, and reporting.

This document records only the decisions specific to *scaffolding*; for engine rationale, defer to the PRD.

## Goals / Non-Goals

**Goals:**
- A buildable, testable repo: `build`, `typecheck`, `lint`, `test` all green on the skeleton.
- The `src/` tree from PRD §3 created, with heavy subsystems pre-chunked and all strings/limits under `constants/`.
- Locked **type contracts** (`Finding`, `Skip`/`SkipReason`, `Severity`, `Certainty`, `RuleId`, `AnalyzeOptions`/`AnalyzeResult`/`Stats`) and the **Hunter contract + registry**.
- A real, working pipeline (`Pod`) that loads config, discovers files, runs the registry, and returns a result — plus the `analyze()` API and `orcas` CLI on top of it.
- Real implementations of the *safety* and *honesty* primitives even in the skeleton: budgets (depth/time/visited-set) and the Echo skip-collector, because they are the "never runs away" and "silent-but-honest" guarantees.
- A Vitest harness with a **hermetic fixture-runner** and the `test/` tree mirroring `src/`.

**Non-Goals:**
- Any detection algorithm (the nine Hunters' logic) — later changes.
- Real value-graph construction, escape/alias analysis, module resolution, manifest reading, cache internals, workspace traversal, framework plugins.
- Performance tuning, benchmarks, real-world corpus (beyond a trivial smoke).

## Decisions

**1. Walking skeleton first (end-to-end, zero detection) — not a vertical slice.**
Build the whole pipeline + contracts with no detection, rather than implementing one Hunter top-to-bottom first.
*Why:* the PRD's value is that all nine Hunters share one graph and one contract; proving the seams before any logic prevents the interfaces from being accidentally shaped around a single Hunter. *Alternative considered:* vertical slice (e.g. `dead-import` fully) — rejected; it would harden the contracts around one easy case and invite churn when the hard Hunters arrive.

**2. Interface-first, in `src/types/`.** The cross-cutting shapes are defined once and imported everywhere.
*Why:* the PRD declares these locked; centralizing them makes the lock real and keeps Hunters/Surface/Echo decoupled. *Alternative:* let shapes emerge per-module — rejected (causes drift, contradicts the locked PRD).

**3. Implement-for-real vs. no-op stub — a deliberate split.**
- *Real now:* `Pod` orchestration, **budgets** (`pod/budget.ts`), the **Hunter registry**, **Echo** skip-collector, **Surface** pretty + JSON reporters, **config** load/defaults, the `analyze()` API, and the CLI.
- *Interface + minimal no-op now:* `Sonar` (parser/resolver/module-graph/symbols/entry-points/manifest), `Atlas` (+ `Current`), `Den` cache, and all `hunters/*` detection bodies.
*Why:* budgets and diagnostics are safety/trust guarantees that must be true from day one and are cheap to build; detection and the heavy graph machinery are the expensive, later work. A no-op Sonar that simply lists files is enough to prove the pipeline.

**4. Build = `tsup`, ESM-only, two entries.** `src/index.ts` (library) and `src/cli/index.ts` (CLI), with `bin/orcas.mjs` as a thin shim. Target `node >=20`.
*Why:* matches the locked stack and `package.json`; ESM-only is the modern norm for new 2026 tooling. *Alternative:* dual ESM+CJS — deferred (added complexity, no consumer needs it yet; tracked as an open question).

**5. Config loading = `c12`.** Provides ESLint-like discovery across `.ts/.js/.json/.yaml`, `extends`, and TS configs via jiti. Pinned to the stable `3.x` line (the `latest` tag is currently a beta).
*Why:* gives the zero-config + typed `defineConfig` experience cheaply. *Alternative:* hand-rolled loader — rejected (reinvents a solved, fiddly problem).

**6. Tests = `vitest` + a hermetic fixture-runner.** The runner loads a fixture's `input` and co-located `expected` (findings **and** skips) and asserts exact equality. `test/` mirrors `src/` 1:1; fixtures reference nothing outside themselves. One trivial scaffolding fixture proves the harness now.
*Why:* locks in the testing philosophy from PRD §12 before any Hunter exists, so the first real Hunter inherits the harness rather than inventing it.

**7. `selfcheck` wired but inert.** The dogfood script (PRD §13) is added now; it will report nothing until Hunters land. CI runs it so the gate exists from the start.

## Risks / Trade-offs

- **Locking interfaces too early** → *Mitigation:* the PRD is already locked; keep `types/` minimal and additive, and treat shape changes as deliberate, reviewed edits rather than incidental ones.
- **"Empty pipeline" reads as "done"** → *Mitigation:* the proposal and tasks state detection is explicitly out of scope; green CI here means *the skeleton works*, not *the tool detects anything*.
- **`tsup` dual-entry + `bin` shim resolution mistakes** (CLI can't find built output) → *Mitigation:* a smoke test executes the built CLI; `publint` runs in `prepublishOnly`.
- **`c12` TS/ESM config edge cases** → *Mitigation:* pinned to stable `3.x`; JSON config is always supported as a fallback path.
- **No-op Sonar hides integration gaps** → *Mitigation:* the no-op still performs real file discovery so the pipeline handles real paths; the first Hunter change will replace it behind the same interface.

## Migration Plan

Greenfield — no existing consumers. "Deploy" = merge; "rollback" = revert the change. No data or API migration. Subsequent changes implement detection behind the contracts established here.

## Open Questions

- **Dual ESM+CJS publish?** Currently ESM-only. Revisit if library consumers on CJS appear. (Does not block this change.)
- **Exact `Stats` fields** (e.g. cache-hit counts, per-stage timings) will be finalized as Sonar/Atlas/Den gain real implementations; the skeleton ships a minimal, additive `Stats`.
- **LICENSE / repo URLs**: `package.json` declares MIT and `github:hadetan/orcas`; the `LICENSE` file and repo owner should be confirmed during this change.
