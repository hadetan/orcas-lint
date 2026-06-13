import type { SourceLocation } from '../types';

/** How an imported binding is introduced into a module. */
export type ImportKind = 'named' | 'default' | 'namespace' | 'side-effect';

/** How an exported name leaves a module. */
export type ExportKind = 'named' | 'default' | 'star-reexport' | 'named-reexport';

/** A single binding introduced by an import declaration. */
export interface ImportBinding {
  /** The name the binding is known by in this module. Empty for side-effect imports. */
  readonly localName: string;
  /** The raw module specifier, such as `./utils`. */
  readonly specifier: string;
  /** The resolved target as a path relative to `cwd`, or `null` when unresolved/external. */
  readonly resolvedFile: string | null;
  readonly kind: ImportKind;
  /** The original exported name; `default` for default imports. Absent for namespace/side-effect. */
  readonly importedName?: string;
  readonly isTypeOnly: boolean;
  /** In-module usages of the binding, excluding the import declaration itself. */
  readonly references: number;
  readonly loc: SourceLocation;
}

/** A single name a module exports. */
export interface ExportRecord {
  /** The name consumers import; `default` for the default export. */
  readonly exportedName: string;
  /** The local declaration name. For re-exports, the name in the target module. */
  readonly localName?: string;
  readonly kind: ExportKind;
  /** The re-export source specifier, for `*-reexport` kinds. */
  readonly reexportFrom?: string;
  /** The resolved re-export target relative to `cwd`, or `null` when unresolved/external. */
  readonly resolvedReexport?: string | null;
  readonly isTypeOnly: boolean;
  readonly loc: SourceLocation;
}

/** Everything Sonar knows about one module. */
export interface ModuleInfo {
  /** Path relative to `cwd`. */
  readonly file: string;
  readonly imports: readonly ImportBinding[];
  readonly exports: readonly ExportRecord[];
}

/** A location that imports, or re-exports, some other module's export. */
export interface ImportSite {
  readonly file: string;
  readonly loc: SourceLocation;
  /** True when the consumption is a re-export rather than a direct import. */
  readonly viaReexport: boolean;
}

/**
 * The read-only semantic model Sonar hands to every Hunter. Structural data is
 * materialized eagerly; reference resolution is precomputed per binding. A Hunter
 * must treat everything here as immutable.
 */
export interface SemanticModel {
  /** All analyzed files, as paths relative to `cwd`, in stable order. */
  files(): readonly string[];
  /** The module record for a file, or `undefined` when the file was not analyzed. */
  module(file: string): ModuleInfo | undefined;
  /** Resolve a specifier imported from `from` to a relative path, or `null`. */
  resolve(specifier: string, from: string): string | null;
  /** Files that are always live. */
  entryPoints(): ReadonlySet<string>;
  /** Whether a file is reachable from any entry point through imports and re-exports. */
  isReachable(file: string): boolean;
  /** Whether a file is a test file. */
  isTest(file: string): boolean;
  /** Sites that import or re-export `exportName` from `file`. */
  importersOf(file: string, exportName: string): readonly ImportSite[];
  /** True when the project performs a non-literal dynamic import, defeating whole-program proof. */
  hasDynamicImport(): boolean;
  /** True when the given file performs a non-literal dynamic import. */
  hasDynamicImportIn(file: string): boolean;
}
