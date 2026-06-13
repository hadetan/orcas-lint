# unlisted-dependency Specification

## Purpose
TBD - created by archiving change dep-hunters. Update Purpose after archive.
## Requirements
### Requirement: Report imported packages absent from `package.json`
The `unlisted-dependency` Hunter SHALL report every npm package that a source file statically imports or requires but that does not appear in any of `package.json`'s dependency sections (`dependencies`, `devDependencies`, `peerDependencies`, `optionalDependencies`). One finding is emitted per unlisted package, at the first import or require site encountered in stable file order. Node.js built-in modules (those with a `node:` prefix, or bare names in the set of known built-in module names) are never reported. Relative and absolute specifiers are never reported.

#### Scenario: An import from an undeclared package is reported
- **WHEN** a source file contains `import { pick } from 'lodash'` and `lodash` is absent from all `package.json` dep sections
- **THEN** an `unlisted-dependency` finding is emitted with `path: 'lodash'` at the import's location

#### Scenario: A `require()` from an undeclared package is reported
- **WHEN** a source file contains `const express = require('express')` and `express` is absent from all `package.json` dep sections
- **THEN** an `unlisted-dependency` finding is emitted with `path: 'express'`

#### Scenario: Only one finding per package regardless of import count
- **WHEN** `lodash` is imported in 5 different source files and is not declared in `package.json`
- **THEN** exactly one `unlisted-dependency` finding is emitted for `lodash`, at the first import site in stable file order

#### Scenario: A scoped sub-path import is attributed to the root package name
- **WHEN** a file contains `import { parse } from '@babel/core/transform'` and `@babel/core` is not in `package.json`
- **THEN** a finding is emitted with `path: '@babel/core'` (not `@babel/core/transform`)

#### Scenario: A package declared in any dep section is not reported
- **WHEN** `lodash` is listed in `devDependencies` and a source file imports `lodash`
- **THEN** no `unlisted-dependency` finding is emitted — any declaration is sufficient

#### Scenario: A Node built-in with `node:` prefix is never reported
- **WHEN** a file contains `import { join } from 'node:path'`
- **THEN** no finding is emitted — `node:*` specifiers are always built-ins

#### Scenario: A bare Node built-in name is never reported
- **WHEN** a file contains `import { join } from 'path'` (legacy specifier without `node:`)
- **THEN** no finding is emitted — `path` is a known Node.js built-in

#### Scenario: A relative import is never reported
- **WHEN** a file contains `import { x } from './utils'`
- **THEN** no finding is emitted — relative specifiers are in-project, not package imports

### Requirement: `ignoreDependencies` suppresses findings
The `unlisted-dependency` Hunter SHALL NOT emit a finding for any package whose name appears in `config.ignoreDependencies`.

#### Scenario: A package in `ignoreDependencies` is not reported even if unlisted
- **WHEN** `config.ignoreDependencies` contains `'some-internal-tool'` and a file imports it but it is absent from `package.json`
- **THEN** no `unlisted-dependency` finding is emitted

### Requirement: `production` mode limits the scan to non-test files
When `config.production` is `true`, the `unlisted-dependency` Hunter SHALL only inspect imports and requires from non-test files. Imports in test files are ignored entirely.

#### Scenario: An unlisted package imported only in test files is not reported in production mode
- **WHEN** `config.production` is `true` and an unlisted package is imported only in `*.test.ts` files
- **THEN** no `unlisted-dependency` finding is emitted

#### Scenario: An unlisted package imported only in test files is reported in default mode
- **WHEN** `config.production` is `false` (default) and an unlisted package is imported only in `*.test.ts` files
- **THEN** an `unlisted-dependency` finding is emitted

### Requirement: Rule can be disabled
When `rules['unlisted-dependency']` is `'off'`, the Hunter SHALL emit zero findings and zero skips.

#### Scenario: Rule off produces no output
- **WHEN** `rules['unlisted-dependency']` is `'off'`
- **THEN** the hunter emits zero findings and zero skips, regardless of what packages are imported

