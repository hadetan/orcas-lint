schema: spec-driven
created: 2026-06-13
---
## 1. Add CJS `require()` tracking to Sonar

- [x] 1.1 In `src/sonar/model.ts`, add the `RequireBinding` interface (`specifier: string`, `resolvedFile: string | null`, `loc: SourceLocation`) and add `requires: readonly RequireBinding[]` to the `ModuleInfo` interface alongside the existing `imports` and `exports` fields
- [x] 1.2 In `src/sonar/parser.ts`, add an `extractRequires(sf: SourceFile, relFile: string): Array<{ specifier: string; loc: SourceLocation }>` function that walks all `CallExpression` nodes, keeps only those where the callee is the bare `Identifier` `require` (not `require.resolve` or other property access), and the first argument is a `StringLiteral` or `NoSubstitutionTemplateLiteral`; returns the literal value and the call's start location
- [x] 1.3 In `src/sonar/build.ts`, after calling `extractImports`, call `extractRequires(sf, rel)`; for each raw require, resolve the specifier via the resolver and map to a relative path with `toRel`; assemble `RequireBinding[]` and include it in the `ModuleInfo` constructed for each file
- [x] 1.4 In `src/sonar/module-graph.ts`, update `buildEdges` to iterate `mod.requires` in addition to `mod.imports` and `mod.exports`, adding `req.resolvedFile` as an edge target when it is non-null

## 2. Thread `manifest` through `HunterContext`

- [x] 2.1 In `src/hunters/base.ts`, add `readonly manifest: Manifest` to the `HunterContext` interface; import `Manifest` from `'../sonar'`
- [x] 2.2 In `src/pod/pipeline.ts`, extend the `registry.run(...)` call to include `manifest` (the value already read by `readManifest(cwd)` earlier in the pipeline)
- [x] 2.3 In `test/hunters/dead-imports.test.ts`, add a stub manifest (`{ dependencies: {}, devDependencies: {}, peerDependencies: {}, optionalDependencies: {}, ... }`) to the `HunterContext` object constructed at line 68
- [x] 2.4 In `test/hunters/registry.test.ts`, add the same stub manifest to the `context()` helper function
- [x] 2.5 In `test/hunters/dead-files.test.ts`, add the same stub manifest to the `HunterContext` object constructed in the `'rule off'` test

## 3. Add shared dep utilities

- [x] 3.1 Create `src/hunters/dep-utils.ts` with: (a) a `NODE_BUILTINS` `Set<string>` containing all stable bare Node.js built-in module names (`assert`, `buffer`, `child_process`, `cluster`, `console`, `constants`, `crypto`, `dgram`, `diagnostics_channel`, `dns`, `domain`, `events`, `fs`, `http`, `http2`, `https`, `inspector`, `module`, `net`, `os`, `path`, `perf_hooks`, `process`, `punycode`, `querystring`, `readline`, `repl`, `stream`, `string_decoder`, `sys`, `timers`, `tls`, `trace_events`, `tty`, `url`, `util`, `v8`, `vm`, `wasi`, `worker_threads`, `zlib`); (b) an `extractPackageName(specifier: string): string | null` function that returns `null` for relative (`.`/`/`-prefixed), `node:`-prefixed, and bare built-in specifiers, returns `@scope/name` for scoped packages, and returns the first path segment for everything else

## 4. Add message strings

- [x] 4.1 In `src/constants/messages.ts`, add `unusedDependency: (pkg: string): string => \`'\${pkg}' is declared in package.json but never imported\`` and `unlistedDependency: (pkg: string): string => \`'\${pkg}' is imported but not listed in package.json\``

## 5. Implement the `unused-dependency` hunter

- [x] 5.1 Create `src/hunters/unused-dependency.ts` implementing the `Hunter` interface with `id: 'unused-dependency'` and `rule: 'unused-dependency'`; in `run`: (a) return early if severity is `'off'`; (b) build `ignored` set from `config.ignoreDependencies` + `config.ignoreBinaries`; (c) build `allDeclared` set from all four dep sections of `ctx.manifest`; (d) build `usedPkgs` set by iterating `sonar.files()`, skipping test files when `config.production` is true, and calling `extractPackageName` on each import specifier and require specifier; (e) for each package in `allDeclared` not in `ignored` and not in `usedPkgs`, push a finding with `location: { file: 'package.json', line: 1, column: 1 }`; sort packages alphabetically before generating findings for deterministic output

## 6. Implement the `unlisted-dependency` hunter

- [x] 6.1 Create `src/hunters/unlisted-dependency.ts` implementing the `Hunter` interface with `id: 'unlisted-dependency'` and `rule: 'unlisted-dependency'`; in `run`: (a) return early if severity is `'off'`; (b) build `allDeclared` set from all four dep sections of `ctx.manifest`; (c) iterate `sonar.files()`, skipping test files when `config.production` is true; for each import binding and each require binding in the module, call `extractPackageName`; if the result is non-null, not in `allDeclared`, not in `config.ignoreDependencies`, and not already in a local `reported` set, add it to `reported` and push a finding at the import/require's `loc`

## 7. Wire up the new hunters

- [x] 7.1 In `src/hunters/index.ts`, import `unusedDependency` from `'./unused-dependency'` and `unlistedDependency` from `'./unlisted-dependency'`; add both to the named exports; add both to the array returned by `defaultHunters()` (after `deadFiles`)

## 8. Fixtures and unit tests — `unused-dependency`

- [x] 8.1 Create `test/fixtures/unused-dependency/basic-unused/`: `package.json` with two deps (`lodash` and `express`), `src/index.ts` that imports only `lodash`, `orcas.config.json` with `entry: ['src/index.ts']` and all non-dep rules set to `'off'`, and `expected.json` with one `unused-dependency` finding for `express` at `package.json:1:1`
- [x] 8.2 Create `test/fixtures/unused-dependency/all-used/`: `package.json` with one dep (`lodash`), `src/index.ts` that imports `lodash`, same `orcas.config.json` pattern, and `expected.json` with empty findings and skips
- [x] 8.3 Create `test/hunters/unused-dependency.test.ts` with: fixture-based tests for 8.1 and 8.2; a unit test using a mock `SemanticModel` that verifies `ignoreDependencies` suppresses a finding; a unit test that verifies `ignoreBinaries` suppresses a finding; a unit test that verifies `production: true` makes a dep used only in a test file appear unused; a unit test that verifies `rules['unused-dependency'] = 'off'` returns empty results

## 9. Fixtures and unit tests — `unlisted-dependency`

- [x] 9.1 Create `test/fixtures/unlisted-dependency/basic-unlisted/`: `package.json` with empty deps, `src/index.ts` that imports `lodash`, `orcas.config.json` with `entry: ['src/index.ts']` and all non-dep rules set to `'off'`, and `expected.json` with one `unlisted-dependency` finding for `lodash` pointing to the import location in `src/index.ts`
- [x] 9.2 Create `test/fixtures/unlisted-dependency/all-listed/`: `package.json` with `lodash` declared, `src/index.ts` that imports `lodash`, same config, and `expected.json` with empty findings and skips
- [x] 9.3 Create `test/fixtures/unlisted-dependency/node-builtin-not-flagged/`: `package.json` with empty deps, `src/index.ts` that imports from `node:path` and `path` (legacy), `orcas.config.json` turning off other rules, and `expected.json` with empty findings and skips
- [x] 9.4 Create `test/hunters/unlisted-dependency.test.ts` with: fixture-based tests for 9.1, 9.2, and 9.3; a unit test using a mock `SemanticModel` that verifies `ignoreDependencies` suppresses a finding; a unit test that verifies only one finding is emitted when the same unlisted package appears in multiple files; a unit test that verifies `production: true` does not flag packages imported only in test files; a unit test that verifies `rules['unlisted-dependency'] = 'off'` returns empty results

## 10. Integration and self-check

- [x] 10.1 Run the full test suite (`npm test`) and confirm all existing tests still pass alongside the new ones
- [x] 10.2 Run Orcas against its own `src/` directory and confirm no false-positive `unused-dependency` or `unlisted-dependency` findings are emitted on the tool itself
