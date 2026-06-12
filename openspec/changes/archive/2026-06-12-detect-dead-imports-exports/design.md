## Context

`scaffold-engine-foundation` locked the architecture and a runnable pipeline, but Sonar is hollow: `parser.parse()` returns `{ file }`, `resolver.resolve()` returns `null`, the module graph is never populated, `symbols`/`entry-points` are stubs, and `HunterContext` carries only `{ cwd, files, config, budget, echo }` — no way for a Hunter to ask "what does this file import?" This change makes Sonar *see* and exposes that knowledge to two Hunters.

The constraint that shapes every decision is the product promise: **silent unless 100% certain** (Product PRD §6, Technical PRD §0). A false positive in a dead-code tool gets live code deleted. So wherever analysis is ambiguous, the engine emits an Echo *skip*, never a finding. Two further locked constraints apply: the engine is **TypeScript-first with a future Rust/oxc core that must drop in "without API change"** (§0), and **trackers receive read-only views and never mutate the graph** (§3).

## Goals / Non-Goals

**Goals:**
- Real Sonar: parse imports/exports/references (`ts-morph`), resolve specifiers (`oxc-resolver`), build the module graph with re-export following, cross-module symbol identity, and entry-point derivation.
- A single read-only `SemanticModel` seam on `HunterContext` that all nine Hunters will query — designed so reachability Hunters (this change) and value-flow Hunters (later) both fit.
- Two Hunters — `dead-import`, `dead-export` — at HIGH certainty with explicit skip cases.
- The self-analysis gate live: Orcas's own `src/` clean of dead imports/exports at `error`.

**Non-Goals:**
- Atlas / value graph / escape-alias of any kind — the `atlas?` slot stays absent this change (built only when a value-flow rule is enabled, Milestone 3).
- Dead-files / dead-deps (Hunters 8–9), Den cache internals, cross-package monorepo traversal, framework/config plugins.
- Member-level deadness of namespace imports (`import * as ns`) — that is value-flow territory; here a namespace binding referenced at all counts as used.

## Decisions

### D1 — `SemanticModel`: a hybrid seam (materialized structure + on-demand resolution)

The contract handed to Hunters materializes the *cheap, always-needed* structural data (per-file imports/exports, the graph, entry points, reachability) and keeps the *expensive* part — reference resolution — behind a method so it can be computed lazily and cached.

```ts
interface HunterContext {
  readonly cwd: string; readonly config: OrcasConfig
  readonly budget: Budget; readonly echo: Echo
  readonly sonar: SemanticModel       // NEW — always present
  readonly atlas?: ValueGraph         // reserved; absent until a value-flow rule is enabled
}
interface SemanticModel {
  files(): readonly string[]
  module(file: string): ModuleInfo | undefined
  resolve(specifier: string, from: string): string | null
  entryPoints(): ReadonlySet<string>
  isReachable(file: string): boolean                                   // from any entry point
  isTest(file: string): boolean                                        // consumer, never a subject
  importersOf(file: string, exportName: string): readonly ImportSite[] // incl. re-export sites
}
interface ModuleInfo { file: string; imports: readonly ImportBinding[]; exports: readonly ExportRecord[] }
interface ImportBinding {
  localName: string; specifier: string; resolvedFile: string | null
  kind: 'named' | 'default' | 'namespace' | 'side-effect'
  importedName?: string; isTypeOnly: boolean; references: number; loc: SourceLocation
}
interface ExportRecord {
  exportedName: string; localName?: string
  kind: 'named' | 'default' | 'star-reexport' | 'named-reexport'
  reexportFrom?: string; isTypeOnly: boolean; loc: SourceLocation
}
```

Both Hunters then collapse to small queries — the "20%":
```
dead-import:  imp.kind !== 'side-effect' && imp.references === 0
dead-export:  !model.isReachable(file) && model.importersOf(file, exp.exportedName).length === 0
```

**Why over alternatives.** A pure data-bag (everything materialized) is trivial to cache but forces eager, expensive reference resolution for files no Hunter inspects. A pure query-façade is maximally lazy but awkward to snapshot for Den later. The hybrid matches Technical PRD §4 almost verbatim — "the AST for structure and the type checker on demand for the hard cases" — and the abstraction boundary is exactly what lets a Rust/oxc core replace the implementation without touching a Hunter (§0). It also keeps the read-only-view guarantee (§3): Hunters get interfaces, never the live `ts-morph` `Project`.

### D2 — `references` resolved via the TypeScript type-checker, not syntactic scanning

Whether an imported binding is "read" is computed inside Sonar using `ts-morph`'s symbol/reference resolution (`findReferencesAsNodes` / symbol identity), not by counting identifier text. This correctly handles shadowing, type-only positions, and JSX usage. It is the slower path, but it is *invisible to Hunters* (D1), so we can ship correct and swap in a faster syntactic/Rust path later under the perf budget without changing the contract or any Hunter.

**Alternative considered:** syntactic identifier-walking with hand-rolled scope/JSX handling — faster, but every edge case is a potential false positive, which violates certainty-first. Rejected for v1; revisited only behind the same `references` accessor.

### D3 — Reachability and dead-export are a graph recursion over re-exports

Dead-export is whole-program: a symbol is live if **any** reachable module imports it, where re-exports propagate use. A barrel (`export { x } from './y'`) is simultaneously an *import-site* of `./y`'s `x` and an *export* of the barrel. So:
- `importersOf(file, name)` returns direct importers **and** re-export sites; resolving liveness recurses through re-export chains.
- An export reachable *only* through a barrel that is itself unreachable-and-unimported is **dead** (the whole chain is dead).
- `export *` star re-exports expand to the union of the target's exported names; an `export *` from an unresolved target makes those names unprovable → skip.
- Recursion uses Pod's visited-set primitive so import cycles / circular barrels terminate (PRD §7).

Entry-point reachability seeds this: `entryPoints()` are derived from `package.json` `main`/`module`/`exports`/`bin`/`types` plus config `entry` globs, each resolved to a file. Anything transitively reachable from an entry point is live — which is precisely the **library public-API guarantee** (§4) and what keeps `selfcheck` honest about Orcas's own `bin`/`exports`.

### D4 — Lazy Atlas (the `atlas?` slot stays absent this change)

`HunterContext.atlas` is optional and Pod builds the value graph **only when a value-flow rule is enabled**. A reachability-only run pays nothing for Atlas. This change never constructs it; the slot exists purely to lock the seam shape now so Milestone 3 adds a field-population step, not a contract change.

### D5 — Pipeline ordering: whole-program before any Hunter

Because dead-export needs the complete graph, Pod runs: parse all files → resolve all specifiers → build module + symbol graph (follow re-exports) → derive & resolve entry points → compute reachability set → assemble `SemanticModel` → run the Hunter registry. No Hunter runs until the model is complete and frozen.

### D6 — Skip taxonomy (bias to "consumed")

New/used `SkipReason`s for the reachability boundary: an `unresolved-specifier` (resolver returned `null`) means we cannot prove the importer/target relationship → skip both ends rather than flag; a dynamic `import()` with a non-literal specifier → the target is treated as possibly-used (skip), literal `import()` is followed as a use; a re-export whose target resolves outside the analyzed project → skip. Side-effect imports (`import './x.css'`) are never findings by definition.

### D7 — Tests are consumers, not subjects *(resolves Q1)*

Test files are **read** (so an export used only by a test stays alive via the import edge) but Orcas **never reports findings located in a test file**. A `tests` config glob set classifies them; `SemanticModel.isTest(file)` exposes the verdict and both Hunters skip test-file subjects. Because a test still appears in `importersOf`, a production export consumed only by a test is correctly kept alive — you are never told to delete code your tests use.

The `production` flag is the deliberate inverse: it **excludes** test files from analysis entirely (the "what a shipped build consumes" view), so a test-only export *does* surface as dead. Two fixtures pin both halves: `consumed-by-test` (default → not flagged) and `production-excludes-tests` (production → flagged).

**Why over alternatives.** Simply *ignoring* tests (the easy path) would lose the consumption signal and wrongly flag test-only helpers. Reporting *on* tests would nag about a surface that never ships. "Consumer, not subject" keeps Orcas focused on production code while honoring real usage. Detection is by `project ∩ tests` globs (not unioned into discovery), so narrowing `project` — e.g. `selfcheck`'s `src/**` — neither scans nor reports tests, which keeps the gate fast and fixtures hermetic.

### D8 — Runtime-aware JSX factory *(resolves Q2)*

JSX desugars differently per runtime, so a `React` import's "usedness" is runtime-dependent:
- **Classic** (`jsx: react`/`preserve`, or unset): `<div/>` → `React.createElement(...)`, so `import React` is used *implicitly*. Sonar treats an import whose local name is a JSX factory root (`React`, or the configured `jsxFactory`/`jsxFragmentFactory` root) as referenced **when the module contains JSX** — preventing a false positive.
- **Automatic** (`jsx: react-jsx`): the factory is auto-imported from `react/jsx-runtime`; an explicit `import React` is genuinely unnecessary, so the factory set is **empty** and the stray import is correctly **flagged**.

The runtime is read from the project's resolved `compilerOptions.jsx`, so `createProject` must **not** override a project's own `jsx` setting (it only supplies `jsx: preserve` as a no-tsconfig fallback). Fixtures `jsx-classic-runtime` (0 findings) and `jsx-automatic-runtime` (1 finding) pin both directions. Per-file `@jsxRuntime`/`@jsx` pragmas are out of scope for v1 (rare); tsconfig-level resolution covers the common cases.

## Risks / Trade-offs

- **Reference-resolution correctness (type-only, JSX, shadowing, namespace member use)** → checker-backed `references` (D2) + a soundness corpus of must-skip twins; any doubt resolves to skip, never flag.
- **ts-morph performance on large repos** → bounded by the existing per-file timeout and global wall-clock budget; reference resolution is lazy (D1) and Den caching lands later. Acceptable for v1's mid-to-large target.
- **Re-export recursion could loop on circular barrels** → visited-set guard (Pod §7); cycles terminate and resolve to "live if any node in the cycle is reached, else dead."
- **Default and `export *` edge cases** → `'default'` is a first-class `exportedName`; `star-reexport` expands to the target's export union, and an unresolved star target degrades to skip.
- **`production` mode narrows importers** → excluding test files flips a test-only export from live to dead. This is intended (matches "what a shipped build consumes") and is now the resolved behavior (D7), pinned by fixtures.
- **JSX factory false positive** → a classic-runtime `React` import used only via JSX could be flagged; resolved by the runtime-aware factory rule (D8).

## Resolved Questions

- **Q1 — test files → D7.** Tests are *consumers, not subjects*: read for usage edges, never reported on; `production` mode excludes them entirely. Resolved per the user's direction.
- **Q2 — JSX runtime → D8.** Runtime-aware factory handling: classic spares the implicit `React` import, automatic flags the unnecessary one. Both directions fixture-pinned.
- **Q3 — capability name → `semantic-model`.** Renamed from `module-graph` to match the `SemanticModel` type it defines (the source file `src/sonar/module-graph.ts` keeps its name — it holds the graph/reachability internals).
