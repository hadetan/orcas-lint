# Orcas

> Find dead code and unused values in JavaScript & TypeScript — and trust every finding.

Orcas detects things a program produces but never reads: dead imports/exports, unused files,
unused dependencies, untouched nested object/array keys, discarded return values, and dead
mutations. It is **report-only** and stays **silent unless 100% certain** (run with `--debug`
to see what it skipped and why).

> **Status:** early development. This repository currently contains the engine **foundation**
> (architecture skeleton + tooling); detection capabilities land in subsequent changes.

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
