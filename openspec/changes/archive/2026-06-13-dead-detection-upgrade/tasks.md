## 1. Semantic model — export-level liveness

- [x] 1.1 Add `isExportLive(file: string, exportName: string): boolean` to `SemanticModel` interface in `src/sonar/model.ts`
- [x] 1.2 Implement `computeExportLiveness(modules, entryPoints, importersOf)` in `src/sonar/build.ts`: BFS from entry-point exports; follow re-export chains (D1); guarded by visited-set; returns a `Set<string>` of `"file::name"` pairs
- [x] 1.3 Expose `isExportLive` on the `SemanticModel` returned by `createSemanticModel`, backed by the liveness set
- [x] 1.4 Unit tests: entry-point export is live; export in reachable file with no direct importer is dead; export re-exported through a live barrel is live; cycle in re-export chain terminates

## 2. Semantic model — CJS kind extensions

- [x] 2.1 Extend `ImportKind` in `src/sonar/model.ts` with `'cjs-named'` and `'cjs-namespace'` (D2)
- [x] 2.2 Extend `ExportKind` in `src/sonar/model.ts` with `'cjs-named'` (D2)
- [x] 2.3 Update `findImporters` in `src/sonar/symbols.ts` to recognize `cjs-named` and `cjs-namespace` consumers (D4)
- [x] 2.4 Unit tests: `findImporters` returns CJS consumers for a named export; `cjs-namespace` counts as consumer of every named export in target (covered by cjs-export-consumed integration fixture)

## 3. Parser — CJS binding extraction

- [x] 3.1 Implement `extractCjsBindings(sf, relFile)` in `src/sonar/parser.ts`: destructured require → `ImportBinding[]` with kind `'cjs-named'`, ref-counted same as ESM named (D3)
- [x] 3.2 Implement whole-object require detection in the same function: bound identifier require → `ImportBinding` with kind `'cjs-namespace'`, ref-counted (D3)
- [x] 3.3 Implement `extractCjsExports(sf, relFile)` in `src/sonar/parser.ts`: `module.exports = { ... }` literal keys → `ExportRecord[]` with kind `'cjs-named'`; `exports.foo = ...` → `ExportRecord` with kind `'cjs-named'` (D3)
- [x] 3.4 Unit tests: destructured require extracts named bindings; non-destructured require extracts namespace binding; `module.exports` object literal extracts each key; `exports.foo` assignment extracts a named export; dynamic require / non-literal `module.exports` yields no bindings

## 4. Build — wire CJS extractors into `createSemanticModel`

- [x] 4.1 Call `extractCjsBindings` and merge resulting bindings into `imports` array per file in `src/sonar/build.ts`
- [x] 4.2 Call `extractCjsExports` and merge resulting records into `exports` array per file
- [x] 4.3 Add skip reason `'cjs-whole-require'` to `src/echo/skip-reasons.ts` and message to `src/constants/messages.ts` (D5)
- [x] 4.4 Emit Echo skips for non-destructured, non-literal require patterns that could not be bound (D5) — emitted from dead-imports hunter when cjs-namespace binding has references > 0
- [x] 4.5 Integration test: a CJS file parsed via `createSemanticModel` has its named CJS bindings in `imports` and named CJS exports in `exports` (covered by fixture tests)

## 5. `dead-exports` hunter — export-level check

- [x] 5.1 Replace `if (ctx.sonar.isReachable(file)) continue` with `if (ctx.sonar.entryPoints().has(file)) continue` (D1)
- [x] 5.2 Replace the per-export importer check with `if (ctx.sonar.isExportLive(file, exp.exportedName)) continue`
- [x] 5.3 Remove the dynamic-import skip that guarded per-export reporting — verified: removing it entirely breaks the soundness corpus. Retained per-export dynamic-access skip (moved inside per-export loop, was previously guarded by file-level isReachable skip)
- [x] 5.4 Must-find fixtures: type export (`export type Foo`) in reachable file with no importers → `dead-export` finding; value export in reachable file with no importers → `dead-export` finding; CJS named export with no consumers → `dead-export` finding
- [x] 5.5 Must-not-flag fixtures: export in entry-point file → no finding; export re-exported by a live barrel → no finding; type export imported only via `import type` → no finding; CJS export consumed via destructured require elsewhere → no finding
- [x] 5.6 Soundness: re-export chain cycle → terminates cleanly (no infinite loop, no crash)

## 6. `dead-imports` hunter — CJS bindings (no logic change needed)

- [x] 6.1 Verify the hunter naturally handles `cjs-named` and `cjs-namespace` imports through the existing `imp.kind !== 'side-effect' && imp.references === 0` path — also added cjs-namespace skip (references > 0 case)
- [x] 6.2 Must-find fixture: destructured require binding with zero references → `dead-import` finding
- [x] 6.3 Must-not-flag fixture: whole-object require (`cjs-namespace`) with references → no finding (skip instead); destructured name that IS used → no finding
- [x] 6.4 Soundness fixture: dynamic `require(variable)` → no output at all (silent skip — no binding created). Note: `cjs-whole-require` skip is for USED whole-object requires, not dynamic specifiers

## 7. Spec updates

- [x] 7.1 Update `openspec/specs/dead-exports/spec.md`: add requirements for export-level checking, type exports, CJS exports, and updated certainty boundaries (see spec file)
- [x] 7.2 Update `openspec/specs/dead-imports/spec.md`: add requirements for CJS destructured require bindings and the whole-object require skip case

## 8. Self-analysis gate

- [x] 8.1 Run `selfcheck` after implementation; fix any newly-surfaced dead exports in Orcas's own `src/` until the gate is clean (selfcheck exits 0 with no findings)

## 9. Validation gate

- [x] 9.1 `npm run build`, `typecheck`, `lint`, `test` all green
- [x] 9.2 `selfcheck` exits clean (exit code 0)
