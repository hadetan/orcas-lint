## ADDED Requirements

### Requirement: File parsing and symbol extraction
Sonar SHALL parse each discovered source file and extract its import bindings and export records. Each import binding SHALL carry its source specifier, local name, kind (`named`, `default`, `namespace`, or `side-effect`), the original imported name where applicable, and a type-only flag. Each export record SHALL carry its exported name (`default` for default exports), kind (`named`, `default`, `star-reexport`, or `named-reexport`), the re-export source specifier where applicable, and a type-only flag.

#### Scenario: Extracts named, default, and namespace imports
- **WHEN** a module imports `import a, { b, c as d } from './m'` and `import * as ns from './n'`
- **THEN** Sonar records a default binding `a`, named bindings `b` and `d` (imported name `c`), and a namespace binding `ns`, each with its resolved specifier

#### Scenario: Extracts named, default, star, and re-export exports
- **WHEN** a module declares `export const x = 1`, `export default fn`, `export * from './y'`, and `export { z } from './w'`
- **THEN** Sonar records a `named` export `x`, a `default` export, a `star-reexport` from `./y`, and a `named-reexport` `z` from `./w`

#### Scenario: Records a side-effect import as such
- **WHEN** a module contains `import './styles.css'`
- **THEN** Sonar records a `side-effect` import binding with no local name

### Requirement: Module resolution
Sonar SHALL resolve module specifiers to absolute file paths using `oxc-resolver`, honoring `tsconfig` `paths` aliases and implicit extensions. When a specifier cannot be resolved, resolution SHALL yield `null` and SHALL NOT throw or abort the run.

#### Scenario: Resolves a relative specifier with an implicit extension
- **WHEN** `./util` is imported from a file and `./util.ts` exists
- **THEN** resolution returns the absolute path to `./util.ts`

#### Scenario: Resolves a tsconfig path alias
- **WHEN** `tsconfig` maps `@app/*` to `src/*` and a file imports `@app/util`
- **THEN** resolution returns the absolute path to `src/util.ts`

#### Scenario: Unresolved specifier yields null without error
- **WHEN** a file imports a specifier that resolves to nothing in the project
- **THEN** resolution returns `null` and the run continues

### Requirement: Reference resolution within a module
Sonar SHALL report the number of references to an imported binding within its declaring module, counting usages in value positions, type positions, and JSX. The import declaration itself SHALL NOT count as a reference.

#### Scenario: A used import has at least one reference
- **WHEN** an imported binding `f` is called as `f()` in the module body
- **THEN** the binding's reference count is at least 1

#### Scenario: A type-only usage counts as a reference
- **WHEN** an imported binding `T` is used only in a type annotation
- **THEN** the binding's reference count is at least 1

#### Scenario: A JSX usage counts as a reference
- **WHEN** an imported binding `Comp` is used only as `<Comp />`
- **THEN** the binding's reference count is at least 1

#### Scenario: An unused import has zero references
- **WHEN** an imported binding is never used anywhere in the module
- **THEN** the binding's reference count is 0

### Requirement: Module graph with re-export following
Sonar SHALL build a directed graph of files connected by import and export edges, and SHALL follow re-export edges (`export *`, `export { x } from`) so that a symbol re-exported through one or more barrels links to its origin. Graph traversal SHALL use a visited-set so that import cycles and circular re-exports terminate.

#### Scenario: A re-export edge links a barrel to the origin
- **WHEN** `index.ts` contains `export { x } from './impl'`
- **THEN** the graph links `index.ts`'s exported `x` to its origin declaration in `./impl`

#### Scenario: An import cycle terminates
- **WHEN** module A imports B and B imports A
- **THEN** graph construction and traversal terminate without infinite looping

### Requirement: Cross-module importers
Sonar SHALL answer which sites import a given file's exported name, including direct importers and re-export sites in other modules.

#### Scenario: A direct importer is reported
- **WHEN** module B contains `import { x } from './a'`
- **THEN** `importersOf('a', 'x')` includes a site in module B

#### Scenario: A re-export site counts as an importer of the origin
- **WHEN** a barrel contains `export { x } from './a'`
- **THEN** `importersOf('a', 'x')` includes the barrel's re-export site

### Requirement: Entry-point derivation and reachability
Sonar SHALL derive entry points from `package.json` (`main`, `module`, `exports`, `bin`, `types`) and the configuration's `entry` globs, resolved to files. A file SHALL be reachable when it is an entry point or is transitively reachable from an entry point through resolved import and followed re-export edges.

#### Scenario: package.json bin and exports become entry points
- **WHEN** `package.json` declares a `bin` and an `exports` map pointing at project files
- **THEN** those files are in the entry-point set

#### Scenario: A transitively imported file is reachable
- **WHEN** an entry point imports `./a` and `./a` imports `./b`
- **THEN** both `./a` and `./b` are reachable

#### Scenario: An orphan file is not reachable
- **WHEN** a project file is not on any import path from any entry point
- **THEN** the file is reported as not reachable

### Requirement: Test-file classification
Sonar SHALL classify analyzed files as test files using the configured `tests` globs and expose this via `isTest(file)`. Test files SHALL remain in the model (so their imports count as consumption) in default mode, and SHALL be excluded from the analyzed set when `production` is enabled.

#### Scenario: A test file is classified as a test
- **WHEN** a discovered file matches a `tests` glob (e.g. `*.test.ts`)
- **THEN** `isTest` returns true for that file and it still appears in the analyzed file set

#### Scenario: Production mode excludes test files
- **WHEN** analysis runs with `production` enabled
- **THEN** files matching the `tests` globs are absent from the analyzed file set
