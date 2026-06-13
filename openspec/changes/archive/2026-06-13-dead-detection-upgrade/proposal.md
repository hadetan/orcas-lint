## Why

Two correctness gaps discovered during self-analysis and exploration of the current `dead-exports` and `dead-imports` hunters:

**Gap A — Dead exports silenced in reachable files.** `dead-exports.ts` currently bails at line 40 with `if (ctx.sonar.isReachable(file)) continue` — skipping *the entire file* whenever the file is reachable from any entry point. This means any individual dead export inside a reachable file (a function, constant, type alias, interface) is never examined. The intended behavior per Technical PRD §6 Hunter 2 is symbol-level checking, not file-level. Type exports (`export type Foo`, `export interface Bar`) are caught by the same bug — they *are* already tracked in `ExportRecord` with `isTypeOnly: true`, but the file-level bailout fires before they're ever inspected.

**Gap B — CJS named bindings untracked.** The model captures `require('literal')` calls as `RequireBinding` (specifier + resolved file only) — enough for file-level reachability. What it does not capture: the named bindings destructured from a require (`const { foo, bar } = require(...)`) or the named keys published through CJS exports (`module.exports = { alpha, beta }`, `exports.gamma = ...`). Without this, the dead-import and dead-export hunters are blind to named CJS patterns.

Both gaps affect any `.ts`, `.js`, `.mjs`, or `.cjs` file. They are fixed together on this branch because both touch the same model seams (`ImportBinding`, `ExportRecord`, `SemanticModel`) and the same two hunters.

## What Changes

**Export-level reachability in `SemanticModel`**
- Add `isExportLive(file, exportName)` to the `SemanticModel` interface and implement it in `build.ts`. The algorithm builds a named-export liveness set via BFS from entry points: entry point exports seed the set; direct imports from reachable files propagate it; re-export chains are followed recursively with a visited-set to prevent cycles.

**`dead-exports` hunter — per-symbol check**
- Replace the file-level `isReachable(file)` bailout with two checks: skip the whole file only when it *is* an entry point (`entryPoints().has(file)`); otherwise, check each export individually via `isExportLive(file, name)`.
- Findings include `isTypeOnly` on the export for downstream messaging (same `dead-export` rule ID — type exports are not a distinct capability, just a variant).

**CJS model extensions (reuse existing types)**
- Extend `ImportKind` with `'cjs-named'` and `'cjs-namespace'` variants.
- Extend `ExportKind` with `'cjs-named'`.
- Add `extractCjsBindings()` to `parser.ts`: extracts destructured require patterns as `ImportBinding[]` with `kind: 'cjs-named'`; non-destructured whole-object require emits `kind: 'cjs-namespace'`.
- Add `extractCjsExports()` to `parser.ts`: extracts `module.exports = { ... }` literal keys and `exports.X = ...` property assignments as `ExportRecord[]` with `kind: 'cjs-named'`.
- Update `findImporters` in `symbols.ts` to recognize `cjs-named` and `cjs-namespace` consumers.
- Add skip reason `'cjs-whole-require'` for dynamic or whole-object CJS patterns that can't be proven dead.

**Hunters pick up CJS automatically**
- `dead-imports` hunter already iterates `mod.imports` — CJS named bindings appear there with ref counts; no hunter logic changes needed.
- `dead-exports` hunter already iterates `mod.exports` — CJS named exports appear there; `isExportLive` handles them the same way as ESM exports.

## Capabilities

### New Capabilities
None — all changes modify existing capabilities.

### Modified Capabilities
- `semantic-model`: gains `isExportLive(file, exportName)` on the `SemanticModel` interface; `ImportKind` and `ExportKind` extended with CJS variants; `ModuleInfo` populated with CJS bindings and exports from new extractors; `findImporters` recognizes CJS consumers.
- `dead-exports`: now checks each export individually in every non-entry-point file; type exports (`export type`, `export interface`) and CJS named exports (`module.exports = {…}`) are detected at the same HIGH certainty; `isTypeOnly` surfaced on findings.
- `dead-imports`: CJS destructured require bindings (`const { foo } = require('./x')`) are now subject to the same ref-count check as ESM named imports; whole-object require (`const utils = require('./x')`) emits an Echo skip with reason `cjs-whole-require` rather than silently passing.

## Impact

- **Code**: `src/sonar/model.ts` (new types/kinds), `src/sonar/build.ts` (export liveness computation), `src/sonar/parser.ts` (CJS extractors), `src/sonar/symbols.ts` (`findImporters` CJS branches), `src/hunters/dead-exports.ts` (replace file-level bailout), `src/echo/skip-reasons.ts` (`cjs-whole-require`), `src/constants/messages.ts` (CJS skip message).
- **Self-analysis**: `selfcheck` may now surface previously-hidden dead exports in Orcas's own `src/`; any found must be cleaned up before the gate passes.
- **Tests**: new fixtures for per-file export checking (type export dead, value export dead in reachable file), CJS named bindings (dead destructured require, dead cjs export), soundness corpus additions (whole-object require → skip, dynamic CJS → skip).
- **Risk**: medium. Export-level reachability changes the semantics of Hunter 2 significantly — soundness fixtures must cover all re-export chain shapes. CJS extraction is conservative-by-design; the skip-by-default posture keeps false positives at zero.
