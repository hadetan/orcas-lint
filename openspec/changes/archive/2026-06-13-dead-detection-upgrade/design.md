## Context

Two hunters ship from the `detect-dead-imports-exports` change: `dead-import` and `dead-export`. Both are correct within a narrower scope than intended. `dead-export` uses a file-level reachability gate (`isReachable(file)`) that was meant as a quick "this whole file is live, skip it" optimisation for library entry-point files. In practice it silences every export inside any reachable file, regardless of whether the individual export is ever consumed. `dead-import` is correct for ESM but knows nothing of CJS destructured `require()` bindings.

The constraint that drives every decision here is identical to the original: **silent unless 100% certain** (PRD §0, §6). Every new code path must either emit a finding it cannot be wrong about, or emit an Echo skip. The second design constraint: **reuse existing model types** — no parallel type hierarchies, no second model seam.

---

## Goals / Non-Goals

**Goals:**
- Correct per-symbol dead-export detection across all non-entry-point files, including type exports.
- Named CJS binding detection: destructured require → `ImportBinding`; `module.exports`/`exports.X` → `ExportRecord`.
- Conservative CJS: dynamic or whole-object patterns → Echo skip, never a finding.

**Non-Goals:**
- Atlas / value-flow analysis (unchanged).
- Dynamic CJS patterns: `require(variable)`, `module.exports = someVar`, `module[key]` → always silent.
- CJS star re-exports or `require.resolve` patterns.
- Framework/config plugin support for CJS (later roadmap item).

---

## Decisions

### D1 — Export-level liveness replaces file-level reachability in `dead-export`

The current check `isReachable(file)` is a file-level predicate. The correct predicate for dead-export is whether the specific export `(file, name)` is transitively consumed starting from any entry point. These two are not equivalent: a file can be reachable because one of its ten exports is imported, while the other nine are dead.

The fix has two parts:

**Part 1 — skip only genuine entry-point files:**
```typescript
// Old (wrong proxy):
if (ctx.sonar.isReachable(file)) continue;

// New (correct):
if (ctx.sonar.entryPoints().has(file)) continue;
```
Entry-point files' exports are by definition public API — never reported dead. Reachable-but-not-entry-point files must be checked export by export.

**Part 2 — per-export liveness via `isExportLive(file, name)` on `SemanticModel`:**

```typescript
// In the hunter, after the entry-point skip:
for (const exp of mod.exports) {
  if (exp.kind === 'star-reexport' || exp.kind === 'named-reexport') continue;
  if (ctx.sonar.isExportLive(file, exp.exportedName)) continue;
  // ... record skip or finding
}
```

`isExportLive` is computed in `build.ts` via a BFS seeded at entry-point exports:

```
Algorithm (build time, precomputed):

liveExports = Set<`${file}::${name}`>

1. Seed: for every file in entryPoints(), add all its export names to liveExports.

2. BFS queue: all (file, name) pairs in liveExports.

3. For each (f, name) dequeued:
   a. For each ImportSite site in importersOf(f, name):
      - If site.viaReexport === false (direct import):
        → The consumer file imported it; the consumer uses it. (f, name) already in set ✓
      - If site.viaReexport === true (re-export):
        → site.file re-exports (f, name) under some exported name.
        → Find the ExportRecord in site.file where resolvedReexport === f
             and (localName === name OR kind === 'star-reexport')
        → Add (site.file, that ExportRecord.exportedName) to liveExports, enqueue.

4. isExportLive(f, name) ≡ liveExports.has(`${f}::${name}`)
```

The visited-set is implicit in `liveExports` — once a pair is in the set it's never processed again.

**Why not keep `isReachable` and extend it?** `isReachable` is still used by `dead-files` (Hunter 8) — it is file-level by design for that hunter. Keeping them separate avoids semantic coupling. `isExportLive` is a sibling predicate on `SemanticModel`, not a replacement.

### D2 — CJS bindings reuse `ImportBinding` and `ExportRecord` via new kind variants

New kinds added to existing union types:

```typescript
// src/sonar/model.ts

export type ImportKind =
  | 'named' | 'default' | 'namespace' | 'side-effect'
  | 'cjs-named'     // const { foo } = require('./x')  — one binding per destructured name
  | 'cjs-namespace' // const utils = require('./x')    — whole-object, ref-counted

export type ExportKind =
  | 'named' | 'default' | 'star-reexport' | 'named-reexport'
  | 'cjs-named'     // module.exports = { foo } or exports.foo = ...
```

Reusing existing types avoids a parallel model hierarchy and means every system that already iterates `mod.imports` or `mod.exports` (hunters, `findImporters`) automatically handles CJS bindings with minimal per-site changes.

`isTypeOnly` is always `false` for CJS kinds — CJS has no type-only syntax.

### D3 — `extractCjsBindings` and `extractCjsExports` in `parser.ts`

**`extractCjsBindings(sf, relFile)`** walks call expressions for `require('literal')`:

```
For each require('literal') call:
  If the call result is destructured: const { foo, bar } = require(...)
    → emit one ImportBinding per destructured name, kind: 'cjs-named',
       importedName = the property key, localName = alias or key,
       references = countReferences(localId, ...) (same ref-counting as ESM named)
  If the call result is bound to a whole identifier: const utils = require(...)
    → emit one ImportBinding, kind: 'cjs-namespace', localName = 'utils',
       references = countReferences(utils, ...) (≥1 if utils.anything is used)
  If non-literal specifier or call result is discarded/inline:
    → skip (cannot prove dead, no binding to check)
```

**`extractCjsExports(sf, relFile)`** scans for CJS export patterns:

```
Pattern 1 — module.exports = { ... } object literal:
  For each property in the object literal:
    If key is a literal identifier/string:
      → emit ExportRecord, exportedName = key, kind: 'cjs-named'
    If computed/dynamic:
      → skip (cannot prove named exports)

Pattern 2 — exports.foo = value (direct property assignment):
  Where LHS is MemberExpression{ object: 'exports', property: literal }:
    → emit ExportRecord, exportedName = property name, kind: 'cjs-named'

Pattern 3 — module.exports = nonLiteral:
  → skip entirely (emit Echo skip 'cjs-dynamic-export')
```

`ModuleInfo` gains the CJS bindings by merging into `imports` and `exports` arrays — there is no new array. The existing `requires` array is kept for file-level reachability (unchanged).

### D4 — `findImporters` recognizes CJS consumers

```typescript
const consumes =
  imp.kind === 'namespace' ||
  imp.kind === 'cjs-namespace' ||                                   // NEW
  (imp.kind === 'default' && exportName === 'default') ||
  (imp.kind === 'named' && imp.importedName === exportName) ||
  (imp.kind === 'cjs-named' && imp.importedName === exportName);   // NEW
```

A `cjs-namespace` binding (whole-object require) is treated the same as an ESM namespace import: it counts as a consumer of every named export in the target module. This is conservative: if a module is required as a whole, none of its exports are dead, even if only some properties are read. The dynamic-property risk is the same as namespace imports.

### D5 — Echo skip reason `cjs-whole-require`

When `extractCjsBindings` encounters a non-destructured, non-literal-specifier require pattern it cannot track, a skip is emitted:

```
reason: 'cjs-whole-require'
message: "require result assigned to '{name}' without destructuring — \
          named bindings unprovable, skipping dead-import check"
```

This follows the same transparency promise: `--debug` shows exactly what was skipped and why.

### D6 — Certainty boundaries (what is never reported)

| CJS pattern | Treatment |
|-------------|-----------|
| `const { foo } = require('./x')` with unused `foo` | `dead-import` finding |
| `const utils = require('./x')` with unused `utils` | `dead-import` finding (ref-counted same as namespace import) |
| `require(variable)` | Silent skip — dynamic specifier |
| `module.exports = { foo }` with `foo` consumed nowhere | `dead-export` finding |
| `exports.foo = value` with `foo` consumed nowhere | `dead-export` finding |
| `module.exports = someVar` | Silent skip — not a literal object |
| `module.exports.foo = require(dynPath)` | Silent skip — dynamic specifier |
| CJS export from a file where `require(variable)` appears elsewhere | Echo skip for those exports — dynamic access taints the file's exports |
