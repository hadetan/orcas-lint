import type { ImportSite, ModuleInfo } from './model';

/**
 * Find every site that consumes `exportName` from `file`, direct imports and
 * re-exports, across all modules. A namespace import or a `* from` re-export of
 * the file consumes all of its names, so it counts as a consumer of every export.
 */
export function findImporters(
  modules: readonly ModuleInfo[],
  file: string,
  exportName: string,
): ImportSite[] {
  const sites: ImportSite[] = [];
  for (const mod of modules) {
    if (mod.file === file) continue;

    for (const imp of mod.imports) {
      if (imp.resolvedFile !== file) continue;
      const consumes =
        imp.kind === 'namespace' ||
        imp.kind === 'cjs-namespace' ||
        (imp.kind === 'default' && exportName === 'default') ||
        (imp.kind === 'named' && imp.importedName === exportName) ||
        (imp.kind === 'cjs-named' && imp.importedName === exportName);
      if (consumes) sites.push({ file: mod.file, loc: imp.loc, viaReexport: false });
    }

    for (const exp of mod.exports) {
      if (exp.resolvedReexport !== file) continue;
      const consumes =
        exp.kind === 'star-reexport' ||
        (exp.kind === 'named-reexport' && (exp.localName ?? exp.exportedName) === exportName);
      if (consumes) sites.push({ file: mod.file, loc: exp.loc, viaReexport: true });
    }
  }
  return sites;
}
