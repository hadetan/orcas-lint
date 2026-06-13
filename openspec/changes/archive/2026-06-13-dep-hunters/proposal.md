## Why

Orcas detects dead imports, dead exports, and dead files — but has no visibility into the npm dependency layer. Projects accumulate unused `dependencies` and `devDependencies` over time (packages never imported anywhere) and silently rely on transitive packages (imported in code but never declared in `package.json`). Both conditions are maintenance liabilities: unused deps bloat `node_modules` and slow installs; unlisted deps make a project fragile to dependency tree changes in upstream packages.

The rule IDs `unused-dependency` and `unlisted-dependency` are already registered, their default severities are already `'error'`, and the `ignoreDependencies`, `ignoreBinaries`, and `production` config fields are already in place. The hunters themselves are what's missing.

Additionally, Orcas's `.cjs` files are in the default project glob and resolver extensions, but `require()` calls are currently invisible to the analysis. A pure CJS project has an empty module graph, causing dead-files to false-positive on everything and dep hunters to see zero package usage. CJS `require()` support needs to be added at the Sonar layer.

## What Changes

- Introduce `unused-dependency` hunter (Hunter 9): reports every package declared in `package.json` (any dep section) that no source file statically imports or requires.
- Introduce `unlisted-dependency` hunter (Hunter 10): reports every package statically imported or required in source code but absent from all `package.json` dependency sections.
- Add CJS `require()` tracking to Sonar: extend `ModuleInfo` with a `requires` field and update `buildEdges` to include `require()` edges, so CJS projects get correct module-graph reachability and dep hunters can see CJS-style package usage.
- Thread `manifest` through `HunterContext` so dep hunters can query declared packages.

## Capabilities

### New Capabilities

- `unused-dependency`: detects packages declared in `package.json` (across `dependencies`, `devDependencies`, `peerDependencies`, `optionalDependencies`) that no source file statically imports or requires. Reports one finding per package at `package.json:1:1`. Respects `ignoreDependencies` and `ignoreBinaries` suppress lists. When `production: true`, only imports from non-test files count as "used."

- `unlisted-dependency`: detects packages statically imported or required in source code that are absent from all `package.json` dependency sections. Reports one finding per package (at the first import/require site in stable file order). Respects `ignoreDependencies`. When `production: true`, only imports in non-test files are checked.

### Modified Capabilities

- `semantic-model`: extends `ModuleInfo` with `requires: readonly RequireBinding[]`, capturing CJS `require('literal-string')` calls with their resolved file paths. `buildEdges` uses require edges alongside ESM import edges, giving CJS projects correct reachability.

## Impact

- **New**: `src/hunters/dep-utils.ts` — `NODE_BUILTINS` set and `extractPackageName()` utility
- **New**: `src/hunters/unused-dependency.ts` — Hunter 9
- **New**: `src/hunters/unlisted-dependency.ts` — Hunter 10
- **Modified**: `src/sonar/model.ts` — `RequireBinding` type + `requires` field on `ModuleInfo`
- **Modified**: `src/sonar/parser.ts` — `extractRequires()` function
- **Modified**: `src/sonar/build.ts` — call `extractRequires`, resolve specifiers, populate `ModuleInfo.requires`
- **Modified**: `src/sonar/module-graph.ts` — `buildEdges` adds edges from `mod.requires`
- **Modified**: `src/hunters/base.ts` — `manifest: Manifest` added to `HunterContext`
- **Modified**: `src/pod/pipeline.ts` — pass `manifest` to `registry.run()`
- **Modified**: `src/hunters/index.ts` — export new hunters + add to `defaultHunters()`
- **Modified**: `src/constants/messages.ts` — two new message strings
- **Test updates**: `test/hunters/dead-imports.test.ts`, `test/hunters/registry.test.ts`, `test/hunters/dead-files.test.ts` — add `manifest` stub to direct `HunterContext` construction
- **New tests**: unit + fixture tests for both hunters
- No breaking changes to the public `analyze()` API
