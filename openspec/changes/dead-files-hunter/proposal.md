## Why

Dead imports and dead exports are live, but a file that nothing in the project imports — not reachable from any entry point — is invisible to the current hunters. Detecting unused files is the next natural step in Orcas's reachability coverage: it surfaces entire dead modules that the import/export hunters can't see because they only look inside files, not at files as units.

## What Changes

- Introduce `dead-files` hunter (Hunter 8 from the roadmap): reports every project file not reachable from any entry point through the static import graph.
- Refine dynamic-import tracking in Sonar from a single project-wide boolean to a per-file set, so the hunter can ask "does any *reachable* file have a non-literal dynamic import?" rather than bailing globally.
- Extend entry-point derivation to treat recognized config files (`*.config.{ts,js,mjs,cjs}` at project root) as implicit roots, preventing build-tool config files from generating false positives.
- Wire the new hunter into `defaultHunters()` and the `dead-file` rule (already present in rule-ids and config schema).

## Capabilities

### New Capabilities

- `dead-files`: Detects project files unreachable from any entry point. Reports with rule `dead-file`. Skips test files silently. Skips unreachable files with `dynamic-access` when any reachable file contains a non-literal dynamic import (cannot prove the file isn't loaded at runtime).

### Modified Capabilities

- `semantic-model`: Per-file dynamic-import tracking replaces the global boolean. Adds `hasDynamicImportIn(file)` query. Existing `hasDynamicImport()` preserved (used by dead-exports).

## Impact

- **New file**: `src/hunters/dead-files.ts`
- **Modified**: `src/sonar/build.ts` — per-file dynamic-import tracking
- **Modified**: `src/sonar/model.ts` — new `hasDynamicImportIn` on `SemanticModel` interface
- **Modified**: `src/sonar/entry-points.ts` — config-file root detection
- **Modified**: `src/constants/messages.ts` — two new message strings
- **Modified**: `src/hunters/index.ts` — export and wire into `defaultHunters()`
- **New tests**: `test/hunters/dead-files.test.ts` + fixtures under `test/fixtures/dead-files/` and `test/fixtures/soundness/`
- No breaking changes to existing public API or existing hunter behavior
