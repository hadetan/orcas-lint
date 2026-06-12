## 1. Semantic model contract & context seam (locked seam first)

- [x] 1.1 Add semantic-model types to `src/types/` (or `src/sonar/`): `ImportBinding`, `ExportRecord`, `ImportSite`, `ModuleInfo`, `SemanticModel` — matching design D1
- [x] 1.2 Extend `HunterContext` in `src/hunters/base.ts` with `readonly sonar: SemanticModel` and a reserved, optional `readonly atlas?: <ValueGraph>` slot (absent this change)
- [x] 1.3 Add a new `SkipReason` value `unresolved-specifier` to `src/types/finding.ts` and `src/echo/skip-reasons.ts`
- [x] 1.4 `tsc --noEmit` passes with the extended contract; update any test Hunter/`HunterContext` constructions to satisfy the new field

## 2. Sonar — parsing & symbol extraction (`src/sonar/parser.ts`)

- [x] 2.1 Replace the stub `Parser` with a real `ts-morph` `Project` (read `tsconfig`; in-memory or lazy source files) and parse a file into `ModuleInfo`
- [x] 2.2 Extract import bindings: named / default / namespace / side-effect, with `importedName`, `isTypeOnly`, and `loc`
- [x] 2.3 Extract export records: named / default / `star-reexport` / `named-reexport`, with `reexportFrom`, `isTypeOnly`, and `loc`
- [x] 2.4 Unit tests: each import kind and each export kind is extracted correctly; side-effect import has no binding (per `semantic-model` spec)

## 3. Sonar — module resolution (`src/sonar/resolver.ts`)

- [x] 3.1 Wire `oxc-resolver`: resolve a specifier from a file to an absolute path, honoring extensions and `tsconfig` `paths`
- [x] 3.2 Return `null` (never throw) on unresolved specifiers; surface resolution failures as skip-eligible, not errors
- [x] 3.3 Unit tests: relative + implicit-extension resolves; `tsconfig` path alias resolves; unresolved specifier yields `null`

## 4. Sonar — module graph, symbol identity & re-export following (`src/sonar/module-graph.ts`, `src/sonar/symbols.ts`)

- [x] 4.1 Build file→file edges from resolved imports; populate the graph from parsed modules
- [x] 4.2 Implement cross-module symbol identity: link an imported binding to the exported symbol in its resolved target module
- [x] 4.3 Follow re-export edges (`export *`, `export { x } from`) so a re-exported symbol links to its origin; expand `export *` to the target's export union; unresolved star target degrades to skip
- [x] 4.4 Implement `importersOf(file, exportName)` including direct importers and re-export sites
- [x] 4.5 Guard all traversal with a visited-set so import cycles / circular barrels terminate
- [x] 4.6 Unit tests: re-export links barrel→origin; import cycle terminates; `importersOf` includes a re-export site (per `semantic-model` spec)

## 5. Sonar — entry points & reachability (`src/sonar/entry-points.ts`)

- [x] 5.1 Derive entry points from `package.json` (`main`, `module`, `exports`, `bin`, `types`) via the manifest, plus config `entry` globs; resolve each to a file
- [x] 5.2 Compute the reachability set: files transitively reachable from entry points through resolved import + followed re-export edges
- [x] 5.3 Expose `entryPoints()` and `isReachable(file)`
- [x] 5.4 Unit tests: `bin`/`exports` become entry points; transitively imported file is reachable; orphan file is not (per `semantic-model` spec)

## 6. Sonar — reference resolution (`src/sonar/parser.ts` or a `references.ts` sub-file)

- [x] 6.1 Implement checker-backed `references` per import binding (ts-morph symbol/reference resolution — design D2), counting value, type, and JSX usages and excluding the import declaration itself
- [x] 6.2 Honor the per-file budget: when reference resolution is cut off, mark the binding's references as undeterminable (→ skip), never zero
- [x] 6.3 Unit tests: used / type-only-used / JSX-used → references ≥ 1; unused → 0 (per `semantic-model` spec)

## 7. Assemble the SemanticModel & wire into Pod (`src/pod/pipeline.ts`)

- [x] 7.1 Implement a `createSemanticModel(...)` assembler that composes parser + resolver + graph + symbols + entry-points into the `SemanticModel` interface
- [x] 7.2 Update `runPipeline`: after discover, run parse → resolve → build graph → derive+resolve entry points → compute reachability → freeze the model, then run the registry with the model on the context (design D5: model complete before any Hunter)
- [x] 7.3 Keep `atlas` absent (do not build a value graph); confirm a reachability-only run never constructs Atlas (design D4)
- [x] 7.4 Register the built-in Hunters (`dead-import`, `dead-export`) as the default set used by `analyze()`/CLI; honor `off` rule severities
- [x] 7.5 Integration test: `analyze()` exposes a complete model to a probe Hunter; whole-program `importersOf` resolves; value-graph slot is absent (per `engine-foundation` delta)

## 8. Hunter 1 — dead-import (`src/hunters/dead-imports.ts`)

- [x] 8.1 Implement the Hunter: report bindings where `kind !== 'side-effect'` and `references === 0`; record `budget-exceeded` skips for undeterminable bindings
- [x] 8.2 Register it in `src/hunters/index.ts` / registry under rule `dead-import`
- [x] 8.3 Must-find fixtures: unused named, default, and namespace imports → exactly the expected findings, 0 skips
- [x] 8.4 Must-skip / must-not-flag fixtures: side-effect import; type-only import used in a type position; import used only in JSX → 0 findings
- [x] 8.5 Unit + golden tests asserting exact findings and skips (per `dead-imports` spec)

## 9. Hunter 2 — dead-export (`src/hunters/dead-exports.ts`)

- [x] 9.1 Implement the Hunter: report an export where `!isReachable(file)` and `importersOf(file, name).length === 0`, recursing re-export chains for liveness
- [x] 9.2 Record skips: re-export target outside the project → `escapes-boundary`; non-literal dynamic `import()` that could hit the module → `dynamic-access`; unresolved specifier → `unresolved-specifier`
- [x] 9.3 Register it in `src/hunters/index.ts` / registry under rule `dead-export`
- [x] 9.4 Must-find fixtures: an export imported by nobody and not an entry point; a symbol re-exported only by an unreachable barrel → expected findings
- [x] 9.5 Must-not-flag fixtures: entry-point/public-API export; symbol imported by a sibling; symbol consumed via a reachable barrel re-export → 0 findings
- [x] 9.6 Multi-file / workspace-style fixtures are complete tiny projects (own `package.json` + entry points); unit + golden tests assert exact findings and skips (per `dead-exports` spec, PRD §12)

## 10. Soundness corpus & integration

- [x] 10.1 Add soundness fixtures (must-skip, never-flag) covering: dynamic `import()`, unresolved specifier, `export *` to an unresolved target, type-only re-export — each asserting a skip with the correct reason
- [x] 10.2 Integration tests over multi-file fixtures: full `analyze()` produces exact `findings` + `skips`; CLI result equals API result; `--debug` surfaces the skips with reasons
- [x] 10.3 Determinism test: two runs over the same fixture produce deeply-equal, stably-ordered results (per `engine-foundation`)

## 11. Self-analysis gate (dogfooding, PRD §13)

- [x] 11.1 Set `dead-import` and `dead-export` to `error` for the `selfcheck` run (committed `orcas.config.*` at repo root, with zero suppressions as the standing goal)
- [x] 11.2 Run `npm run selfcheck` against Orcas's own `src/`; fix any real dead import/export it finds in our code until it exits clean
- [x] 11.3 Confirm CI runs `build → typecheck → lint → test → selfcheck` and that an introduced dead import/export fails the build

## 12. Validation gate

- [x] 12.1 `npm run build`, `typecheck`, `lint`, `test` all green
- [x] 12.2 Run `orcas` against a sample project and confirm real dead imports/exports are reported, exit code `1` on `error` findings, `--debug` shows skips
- [x] 12.3 `openspec validate detect-dead-imports-exports --strict` passes

## 13. Open-question resolutions (Q1–Q3)

- [x] 13.1 Q1: add a `tests` config glob set (types/defaults/load); discovery classifies test files and excludes them in `production` mode
- [x] 13.2 Q1: `SemanticModel.isTest(file)`; both Hunters skip test-file subjects while tests remain consumers via `importersOf`
- [x] 13.3 Q1: fixtures `consumed-by-test` (default → not flagged), `test-file-not-reported`, `production-excludes-tests` (production → flagged)
- [x] 13.4 Q2: runtime-aware `jsxFactoryRoots`; `createProject` no longer overrides the project's `jsx`; classic spares `React`, automatic flags it
- [x] 13.5 Q2: fixtures `jsx-classic-runtime` (0 findings) and `jsx-automatic-runtime` (1 finding)
- [x] 13.6 Q3: rename capability `module-graph` → `semantic-model` (matches the `SemanticModel` type); source file `src/sonar/module-graph.ts` retained
- [x] 13.7 Record resolutions in `design.md` (D7 tests, D8 JSX) and add spec requirements to `semantic-model`, `dead-imports`, `dead-exports`
