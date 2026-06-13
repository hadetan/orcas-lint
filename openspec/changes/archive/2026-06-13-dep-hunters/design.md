## Context

The infrastructure for dep detection is almost entirely pre-built:

- `rule-ids.ts` already registers `unused-dependency` and `unlisted-dependency`
- `defaults.ts` already sets both to `'error'`
- `types/config.ts` already has `ignoreDependencies`, `ignoreBinaries`, `production`
- `sonar/manifest.ts` already reads all four dep sections from `package.json`
- `pod/pipeline.ts` already calls `readManifest(cwd)` — the manifest just isn't forwarded to hunters

Two structural gaps remain before the hunters can be implemented:

1. **`HunterContext` has no `manifest`** — dep hunters need to query what packages are declared; the manifest isn't currently reachable from hunter code.
2. **`ModuleInfo` has no `requires`** — CJS `require('pkg')` calls are invisible to the whole analysis. A pure CJS project today has an empty module graph, causing dead-files to false-positive on everything and making dep hunters see zero package usage.

## Goals / Non-Goals

**Goals:**
- Report unused declared packages and unlisted imported packages with 100% precision on statically-analyzable import and require patterns.
- Support both ESM `import … from` and CJS `require('literal')` for dep detection.
- Add CJS edges to the module graph so dead-files produces correct results on CJS projects (beneficial side-effect of this change).
- Preserve full backward compatibility for all existing hunters and the public API.

**Non-Goals:**
- Dead-import detection for `const x = require('…')` bindings — different semantics, planned for the follow-up CJS dead-import/dead-export change.
- Dead-export detection for `module.exports = {…}` — same follow-up.
- `require.resolve('pkg')` counting as package usage — resolution is not an import.
- Dynamic `require(variable)` tracking — no literal specifier to extract; accepted false positive (see Decision 6).
- Scanning `scripts` fields for binary usage — `ignoreBinaries` is the user escape hatch.

## Decisions

### Decision 1: `manifest` in `HunterContext`, not `SemanticModel`

`SemanticModel` models the code graph (imports, exports, reachability). `package.json` metadata is project-level context, not code structure. `HunterContext` already carries `config` and `cwd` for the same reason — `manifest` belongs alongside them.

**Alternatives considered:**
- Expose dep queries directly on `SemanticModel`. Rejected: conflates the code graph with project metadata, bloats the interface, and forces unrelated hunters to care about dep semantics.

### Decision 2: `RequireBinding` as a new minimal type; `ModuleInfo.requires` as a peer of `imports`

Reusing `ImportBinding` for `require()` would require fabricating `kind`, `localName`, `importedName`, `references` — semantically wrong since `require()` is a call expression, not a declaration. A minimal `{ specifier, resolvedFile, loc }` type correctly represents everything knowable from a `require('string')` call.

### Decision 3: `buildEdges` includes `require` edges

Both the dead-files hunter and the new dep hunters benefit from correct CJS reachability. Adding require edges to `buildEdges` is three lines (iterate `mod.requires`, add `resolvedFile` to targets) and makes the entire semantic model correct for CJS projects. Not doing it would leave dead-files producing false positives on every CJS-connected file.

### Decision 4: One finding per package for both hunters

`unused-dependency` — one finding per undeclared package, at `package.json:1:1`. There is no more specific location; the fix is always in `package.json`.

`unlisted-dependency` — one finding per unlisted package, at the first import/require site in stable file order. A missing package needs to be added to `package.json` exactly once; emitting per-import-site would flood the output for a commonly-imported but undeclared package.

### Decision 5: All four dep sections count as "declared"

`dependencies`, `devDependencies`, `peerDependencies`, and `optionalDependencies` are all intentional declarations. Distinguishing sections (e.g., flagging a `peerDependency` that's never directly imported) is a valid refinement but left for a follow-up. Users can suppress edge cases with `ignoreDependencies`.

### Decision 6: Dynamic `require(variable)` — accept the false positive

A dep consumed only via `require(someVariable)` will appear unused — a false positive. This is accepted for v1 because:
1. The pattern is vanishingly rare for third-party packages; it's almost always used for local modules.
2. The planned CJS dead-import/dead-export change will introduce proper CJS reference counting, which will resolve this naturally without requiring a special bail-out here.

Adding a global bail-out (like dead-files does for dynamic `import()`) would suppress all unused-dep findings on any project that uses code-splitting, which is a far worse tradeoff.

### Decision 7: `extractPackageName` in a shared `dep-utils.ts`

Both hunters need to extract the npm package name from an import/require specifier. The logic is non-trivial (scoped packages, sub-paths, Node built-ins). A single shared utility avoids duplication and keeps both hunters thin.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| `ModuleInfo.requires` is a structural change to a public type | `ModuleInfo` is internal-facing; v0.0.1 has no external consumers. Adding a new required field is source-compatible for readers. |
| `manifest` in `HunterContext` breaks 3 tests that construct the context directly | Mechanical fix: add a stub manifest (`{}` deps) to those test files. Tracked in tasks. |
| `buildEdges` adding CJS edges changes existing dead-files results on CJS projects | Only adds reachability edges, never removes them. Previously false-positive dead-files findings on CJS-connected files will disappear — a correction, not a regression. |
| `peerDependencies` flagged as unused even when that's intentional (e.g., React for a library) | Users add those packages to `ignoreDependencies`. This is the correct escape hatch. |
| Dynamic `require(variable)` → false positive in `unused-dependency` | Accepted. Documented as a known limitation. Resolved by the follow-up CJS change. |

## Open Questions

None. All decisions above are sufficient to begin implementation.
