# unused-dependency Specification

## Purpose
TBD - created by archiving change dep-hunters. Update Purpose after archive.
## Requirements
### Requirement: Report declared packages never imported or required
The `unused-dependency` Hunter SHALL report every package declared in `package.json` (across `dependencies`, `devDependencies`, `peerDependencies`, and `optionalDependencies`) that no source file statically imports or requires. Detection is based on the package name extracted from import/require specifiers — a package is "used" when any specifier in any analyzed source file resolves to that package name. One finding is emitted per unused package, with `location: { file: 'package.json', line: 1, column: 1 }` and `path` set to the package name.

#### Scenario: A declared package with no imports is reported
- **WHEN** `package.json` lists `"express": "^4"` in `dependencies` and no source file imports or requires `express` (or any sub-path like `express/router`)
- **THEN** a `unused-dependency` finding is emitted with `path: 'express'`

#### Scenario: A declared package used in at least one file is not reported
- **WHEN** `package.json` lists `"lodash": "^4"` and one source file contains `import { pick } from 'lodash'`
- **THEN** no `unused-dependency` finding is emitted for `lodash`

#### Scenario: A sub-path import counts as usage of the root package
- **WHEN** `package.json` lists `"lodash": "^4"` and a source file contains `import { flow } from 'lodash/fp'`
- **THEN** no finding is emitted — `lodash/fp` is recognized as usage of `lodash`

#### Scenario: A scoped package is correctly matched
- **WHEN** `package.json` lists `"@babel/core": "^7"` and a source file contains `import { transform } from '@babel/core'`
- **THEN** no finding is emitted for `@babel/core`

#### Scenario: A package only required via CJS is not reported
- **WHEN** `package.json` lists `"express": "^4"` and a source file contains `const express = require('express')`
- **THEN** no finding is emitted — CJS require counts as usage

#### Scenario: `devDependencies` packages are checked
- **WHEN** `package.json` lists `"rimraf": "^5"` in `devDependencies` and no source file imports or requires `rimraf`
- **THEN** a `unused-dependency` finding is emitted for `rimraf`

#### Scenario: No declared packages → no findings
- **WHEN** `package.json` has empty or absent dependency sections
- **THEN** no `unused-dependency` findings are emitted

### Requirement: `ignoreDependencies` and `ignoreBinaries` suppress findings
The `unused-dependency` Hunter SHALL NOT emit a finding for any package whose name appears in `config.ignoreDependencies` or `config.ignoreBinaries`. Both lists suppress unconditionally — `ignoreDependencies` for packages the user explicitly exempts, `ignoreBinaries` for packages used as CLI tools in scripts rather than as code imports.

#### Scenario: A package in `ignoreDependencies` is not reported even if unused
- **WHEN** `config.ignoreDependencies` contains `'rimraf'` and `rimraf` is not imported anywhere
- **THEN** no `unused-dependency` finding is emitted for `rimraf`

#### Scenario: A package in `ignoreBinaries` is not reported even if unused
- **WHEN** `config.ignoreBinaries` contains `'eslint'` and `eslint` is not imported anywhere
- **THEN** no `unused-dependency` finding is emitted for `eslint`

### Requirement: `production` mode limits usage scan to non-test files
When `config.production` is `true`, the `unused-dependency` Hunter SHALL only consider imports and requires from non-test files when determining whether a package is "used." Test files are identified by `sonar.isTest(file)`.

#### Scenario: A package used only in test files appears unused in production mode
- **WHEN** `config.production` is `true` and `vitest` is imported only in `*.test.ts` files
- **THEN** a `unused-dependency` finding is emitted for `vitest`

#### Scenario: A package used only in test files is not reported in default mode
- **WHEN** `config.production` is `false` (default) and `vitest` is imported only in `*.test.ts` files
- **THEN** no finding is emitted — test file imports count as usage

### Requirement: Rule can be disabled
When `rules['unused-dependency']` is `'off'`, the Hunter SHALL emit zero findings and zero skips.

#### Scenario: Rule off produces no output
- **WHEN** `rules['unused-dependency']` is `'off'`
- **THEN** the hunter emits zero findings and zero skips, regardless of declared or used packages

