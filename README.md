# Orcas

> Find dead code and unused values in JavaScript & TypeScript — and trust every finding.

Orcas detects things a program produces but never reads: dead imports/exports, unused files,
unused dependencies, untouched nested object/array keys, discarded return values, and dead
mutations. It is **report-only** and stays **silent unless 100% certain** (run with `--debug`
to see what it skipped and why).

> **Status:** early development. This repository currently contains the engine **foundation**
> (architecture skeleton + tooling); detection capabilities land in subsequent changes.

## Roadmap

**Engine**
- [x] Orchestrator, pipeline stages, and safety budgets
- [x] Hunter contract and pluggable registry
- [x] Programmatic `analyze()` API and `orcas` CLI
- [x] Configuration, pretty/JSON reporters, `--debug` diagnostics

**Semantic Model (Sonar)**
- [x] AST parsing and module resolution
- [x] Module graph, re-export chain following, symbol identity
- [x] Entry point derivation and reachability computation
- [x] Test file classification, JSX runtime awareness

**Detection — Reachability**
- [x] Dead imports
- [x] Dead exports
- [ ] Unused files
- [ ] Unused dependencies (and unlisted dependencies)

**Detection — Value Flow**
- [ ] Value graph (Atlas) and escape/alias analysis
- [ ] Dead object and array properties
- [ ] Discarded return values
- [ ] Dead mutations

**Infrastructure**
- [ ] Workspace and monorepo support
- [ ] Framework plugins (Vue, Svelte, Next.js, …)
- [ ] Inline suppressions (`// orcas-disable`)
- [ ] Incremental on-disk cache

## Install

```bash
npm install -D orcas
```

## Usage

```bash
npx orcas            # scan the current project (only certain findings)
npx orcas --debug    # also show what was skipped and why
npx orcas --json     # machine-readable output
```

## Documentation

NONE.

## License

[MIT](./LICENSE)
