## Context

Orcas already computes full import-graph reachability during Sonar's model-build phase (`computeReachability` in `module-graph.ts`). The result is exposed on `SemanticModel` as `isReachable(file)`. Dead-imports and dead-exports both rely on this. The infrastructure for Hunter 8 (dead-files) is therefore largely already built — the new hunter is a consumer of existing data, not a builder of new data structures.

Two gaps exist before the hunter can be implemented correctly:

1. **Dynamic-import tracking is too coarse.** `hasDynamicImport()` is a single project-wide boolean. If any file (including a dead, never-running file) has `import(variable)`, the flag fires. For dead-files, the only relevant dynamic imports are those in *reachable* code that could actually execute. Using the global flag would silently skip all findings on any project with code-splitting.

2. **Config files are not entry points.** `deriveEntryPoints` reads `package.json` fields and user-specified `entry` globs. Build-tool config files (`vite.config.ts`, `vitest.config.ts`, `webpack.config.js`, etc.) are commonly in the analyzed file set but not in the entry set. Without treating them as roots, these files and their transitive imports would be false-positive dead files.

## Goals / Non-Goals

**Goals:**

- Report every project file that is not reachable from any entry point with 100% precision (no false positives at default certainty).
- Improve dynamic-import tracking from global boolean to per-file, so the hunter applies the bail-out only when reachable code has a non-literal dynamic import.
- Auto-detect recognized config files as entry-point roots.
- Preserve full backward compatibility: dead-imports, dead-exports, and the existing `hasDynamicImport()` interface are unchanged.

**Non-Goals:**

- Detecting whether a test file is orphaned from the test runner's glob (out of scope; test files are unconditionally skipped).
- CommonJS `require()` with dynamic string — already outside Sonar's tracked edges; flagging nothing is correct (conservative).
- Framework-specific virtual module handling (Vue, Svelte, Next.js routing) — covered by the framework-plugin roadmap item, not this change.
- Unused-dependency detection (Hunter 9) — separate hunter, separate change.

## Decisions

### Decision 1: Per-file dynamic-import tracking instead of global flag

**What:** Change `build.ts` from `let dynamicImport = false` to `const dynamicImportFiles = new Set<string>()`, tracking which specific files contain a non-literal dynamic import. Expose a new `hasDynamicImportIn(file: string): boolean` method on `SemanticModel`. Keep `hasDynamicImport()` returning `dynamicImportFiles.size > 0` for backward compatibility with dead-exports.

**Why:** The correctness argument is clear — an unreachable file that contains `import(x)` can never execute, so its dynamic import is irrelevant to whether other unreachable files are safely dead. Using the refined check means the hunter fires on all projects except those where *running* code performs non-literal dynamic imports.

**Alternatives considered:**
- Keep the global flag + accept reduced recall. Rejected: would produce zero findings on most real-world projects (Next.js, Vite apps with lazy routes all have dynamic imports in entry-level code).
- Add a separate `SemanticModel` method `hasReachableDynamicImport()` that encapsulates the composition. Rejected in favor of the primitive `hasDynamicImportIn(file)` — the hunter should compose `isReachable` + `hasDynamicImportIn` itself; keeping the model methods primitive avoids baking the hunter's logic into the shared model.

### Decision 2: Config-file root detection in `deriveEntryPoints`

**What:** After resolving `package.json` entry-point candidates, additionally scan for `*.config.{ts,js,mjs,cjs}` files at project root level (not nested) and add any that are in the analyzed file set to the entry set.

**Why:** Build-tool config files are not imported by production code but are consumed by the build system. Flagging `vite.config.ts` as a dead file is a false positive. Adding them as roots is the correct model: they are "always live" from the build system's perspective, analogous to how `package.json` `main`/`exports` are always live for library consumers.

**Scope:** Root-level only (not recursive) to avoid capturing test fixture config files or nested package configs in a monorepo. User-controlled `entry` globs override or extend this.

**Alternatives considered:**
- Require users to list config files in `entry` config. Rejected: zero-config usability — users should not need to manually enumerate their build tooling.
- Parse config files to follow their file references. Rejected: too complex for v1; treating the config file itself as a root (not its imports) is sufficient and still correct for the common case.

### Decision 3: Test files are silently skipped (no Echo record)

**What:** `if (sonar.isTest(file)) continue` — no skip record emitted.

**Why:** Test files' "entry point" is the test runner, not the static import graph. Emitting a skip record for every test file would flood `--debug` output with noise on any project. The `isTest()` classification already handles this semantic distinction. Consistent with how dead-exports silently skips test files.

**Alternatives considered:**
- Emit a skip with a new `'test-file'` reason. Rejected for v1: requires adding to the `SkipReason` union (a type change), adds noise without actionable value. Can be added later if users request visibility into orphaned test files.

### Decision 4: File-level finding location is `{ file, line: 1, column: 1 }`

**What:** Dead-file findings use `line: 1, column: 1` as the source location, since the finding refers to the file as a whole rather than a specific declaration.

**Why:** `Finding.location` is non-optional, and `1,1` is the standard convention for file-level diagnostics (ESLint, TypeScript, SARIF all use `1,1` or `0,0` for this). No type changes to `Finding` or `SourceLocation` are needed.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Config-file glob (`*.config.*`) matches too broadly — e.g., test fixture config files in a monorepo sub-package | Detection scoped to project root only (non-recursive); fixture configs live under `test/fixtures/` which the project glob typically excludes |
| `hasDynamicImportIn` added to `SemanticModel` interface breaks any external code implementing that interface | `SemanticModel` is internal (not in the public `analyze()` API surface); no external implementors expected in v1 |
| Projects with `require(variable)` in reachable code will silently miss dead files | Correct behavior per v1 certainty boundary — CJS dynamic requires are untracked edges; conservative silence is preferable to false positives |
| Dead-chain scenario (orphan A imports orphan B): both flagged, which may surprise users | Both are genuinely dead; this is correct behavior. Each file gets its own finding. Users can suppress with `orcas-disable`. |

## Open Questions

None — decisions above are sufficient to begin implementation. Config-file glob list (which extensions to detect as roots) is the only parameter that might need tuning based on real-world testing; the implementation can start with `*.config.{ts,js,mjs,cjs}` and expand in a follow-up.
