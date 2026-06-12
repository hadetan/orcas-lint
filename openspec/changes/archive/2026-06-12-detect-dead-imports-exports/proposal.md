## Why

The walking skeleton (`scaffold-engine-foundation`) runs end-to-end but detects **nothing** — every Sonar seam is hollow: the parser returns `{ file }`, the resolver returns `null`, the module graph is never populated, and `HunterContext` exposes no semantic model for a Hunter to query. This change delivers Orcas's **first real detection** — dead imports and dead exports — which per Technical PRD §15 (Milestone 2) is the slice that "validates the graph end-to-end." It is ~80% Sonar (make the engine *see*) and ~20% Hunters (two thin queries on top). Doing it as one vertical slice means the module graph is validated by its first real consumers instead of being built blind.

## What Changes

- **Sonar becomes real.** `parser` extracts each file's imports (specifier, bindings, kind, type-only, side-effect), exports (named/default/star- & named-re-export), and identifier references via `ts-morph`; `resolver` resolves specifiers (incl. `tsconfig` paths) via `oxc-resolver`; `module-graph` builds file→file and symbol-level edges and follows re-export chains; `symbols` gives cross-module identity ("imported `foo` ≡ exported `foo`"); `entry-points` derives roots from `package.json` (`main`/`module`/`exports`/`bin`/`types`) plus config globs, resolved to files.
- **A read-only `SemanticModel`** (the locked seam every future Hunter rides) is assembled by Pod and exposed on `HunterContext`. Structural data is materialized eagerly; expensive reference resolution is computed on demand and hidden behind the model — so the type-checker-vs-syntactic choice never leaks to a Hunter, and a Rust/oxc core can swap in later without changing the contract.
- **Hunter 1 — dead-import**: flags an imported binding with zero references in its module. Never flags side-effect imports; counts type-only and JSX usage as reads.
- **Hunter 2 — dead-export**: flags an exported symbol imported by no module in the workspace **and** not reachable from an entry point. Follows re-export/barrel chains; a library's public API (entry points) is never flagged.
- **Echo skips** are recorded where certainty fails (unresolved specifier, dynamic `import()` target, re-export to outside the project) so `--debug` stays honest.
- **Self-analysis gate goes live**: `selfcheck` enables `dead-import`/`dead-export` at `error`, so Orcas's own `src/` must come back clean (PRD §13) — wired into CI.
- **Hermetic fixture twins** (must-find + must-skip) are authored alongside both Hunters, plus the soundness cases for the certainty boundary (PRD §12).
- **NOT in scope** (explicit non-goals, each a later change): Atlas / value-flow analysis of any kind (the `atlas` field on the context stays absent — built only when a value-flow rule is enabled, Milestone 3); dead-files / dead-deps (Hunters 8–9, Milestone 7); Den cache internals; workspace/monorepo cross-package traversal beyond single-package resolution; framework/config plugins.

## Capabilities

### New Capabilities
- `semantic-model`: Sonar's semantic model of the project — file parsing & import/export extraction, module resolution, the directed module graph with re-export following, cross-module symbol identity, reference resolution, entry-point derivation, and test-file classification. Exposed to Hunters as a read-only `SemanticModel`.
- `dead-imports`: detection of imported bindings that are never referenced in their module, with the certainty boundary (side-effect imports, type-only/JSX usage) and its skip cases.
- `dead-exports`: detection of exported symbols not imported anywhere in the workspace and not reachable from an entry point, including re-export/barrel chain following and the library-public-API guarantee.

### Modified Capabilities
- `engine-foundation`: `HunterContext` gains a read-only `sonar: SemanticModel` (and a reserved, currently-absent `atlas?` slot); the orchestrated pipeline's "parse/resolve → build graph seams" stage is upgraded from no-op to building and exposing the real semantic model before the Hunter registry runs.

## Impact

- **Code**: real implementations in `src/sonar/{parser,resolver,module-graph,symbols,entry-points}.ts`; new `src/hunters/dead-imports.ts` and `src/hunters/dead-exports.ts` registered in the registry; extended `src/hunters/base.ts` (`HunterContext`); upgraded `src/pod/pipeline.ts` (assemble + pass the model); new `SkipReason` values in `src/types/finding.ts` and `src/echo/skip-reasons.ts` if needed (e.g. `unresolved-specifier`).
- **Dependencies**: no new ones — `ts-morph` and `oxc-resolver` are already declared and now exercised for the first time.
- **End-user behavior**: `orcas` now reports real dead imports/exports and exits `1` on `error`-severity findings; `--debug` shows skips with reasons.
- **CI / dogfooding**: `selfcheck` becomes a meaningful gate; a PR introducing a dead import/export in Orcas's own code fails the build.
- **Tests**: new golden + soundness fixtures under `test/fixtures/{dead-imports,dead-exports,soundness}/`; unit specs for each Sonar module; integration coverage for re-export chains and entry-point reachability.
- **Risk**: medium. The hard part is reference-resolution correctness (type-only, JSX, shadowing) and re-export recursion. Mitigated by certainty-first (ambiguous → skip, never flag), the soundness corpus, and self-analysis on a real codebase (ours).
