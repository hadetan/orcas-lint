## 1. Refine Sonar dynamic-import tracking

- [x] 1.1 In `src/sonar/build.ts`, replace the `dynamicImport: boolean` flag with `const dynamicImportFiles = new Set<string>()` and populate it per-file inside the file-parsing loop when `detectDynamicImport(sf)` returns true
- [x] 1.2 Update the `SemanticModel` closure in `build.ts` to expose `hasDynamicImportIn: (file) => dynamicImportFiles.has(file)` and keep `hasDynamicImport: () => dynamicImportFiles.size > 0` for backward compatibility
- [x] 1.3 Add `hasDynamicImportIn(file: string): boolean` to the `SemanticModel` interface in `src/sonar/model.ts`

## 2. Extend entry-point derivation for config files

- [x] 2.1 In `src/sonar/entry-points.ts`, after resolving `package.json` candidates, glob for `*.config.{ts,js,mjs,cjs}` at root level (non-recursive, `cwd` as base, depth 1) and add any matched files that are in `fileSet` to the entry set

## 3. Implement the dead-files hunter

- [x] 3.1 Add `deadFile(file: string): string` and `skipDynamicFile(file: string): string` message strings to `src/constants/messages.ts`
- [x] 3.2 Create `src/hunters/dead-files.ts` implementing the `Hunter` interface with id/rule `dead-file`; in the `run` method: skip test files silently, skip reachable files, compute `reachableHasDynamic` by checking `hasDynamicImportIn` over all reachable files, then either emit a `dynamic-access` skip or a finding with `location: { file, line: 1, column: 1 }`
- [x] 3.3 Export `deadFiles` from `src/hunters/index.ts` and add it to `defaultHunters()`

## 4. Unit tests for the hunter

- [x] 4.1 Create `test/hunters/dead-files.test.ts` with a test for each spec scenario: orphan reported, dead chain (both files flagged), entry not flagged, reachable file not flagged, test file silently skipped, rule `off` produces no output

## 5. Fixtures — must-find

- [x] 5.1 Create `test/fixtures/dead-files/orphan-file/`: two files (`entry.ts` and `orphan.ts`), `orcas.config.json` with `entry: ['entry.ts']`, `expected.json` with one `dead-file` finding for `orphan.ts`
- [x] 5.2 Create `test/fixtures/dead-files/dead-chain/`: `entry.ts`, `a.ts` (unreachable, imports `b.ts`), `b.ts` (unreachable), `expected.json` with two `dead-file` findings
- [x] 5.3 Create `test/fixtures/dead-files/all-reachable/`: entry imports a chain of files; `expected.json` with zero findings
- [x] 5.4 Create `test/fixtures/dead-files/entry-not-flagged/`: single entry point file; `expected.json` with zero findings
- [x] 5.5 Create `test/fixtures/dead-files/test-not-flagged/`: a test file that nothing imports, `orcas.config.json` with `tests` glob; `expected.json` with zero findings and zero skips

## 6. Fixtures — soundness (must-skip)

- [x] 6.1 Create `test/fixtures/soundness/dead-file-dynamic-reachable/`: a reachable file with `import(someVar)` and a separate unreachable file; `expected.json` with zero findings and one `dynamic-access` skip for the unreachable file
- [x] 6.2 Create `test/fixtures/soundness/dead-file-dynamic-in-unreachable/`: an unreachable file A with `import(someVar)` and a separate unreachable file B with no dynamic imports; `expected.json` with two `dead-file` findings (A and B both flagged — dynamic import is in unreachable code, so bail-out does not trigger)

## 7. Integration and self-check

- [x] 7.1 Run the full test suite (`npm test`) and confirm all existing tests still pass alongside the new ones
- [x] 7.2 Run `npm run selfcheck` (or equivalent) against Orcas's own `src/` to confirm no false-positive dead-file findings are produced on the tool itself
