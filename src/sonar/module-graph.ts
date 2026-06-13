import type { ModuleInfo } from './model';

/** A function yielding the resolved, in-project targets a file points at. */
export type EdgesFrom = (file: string) => readonly string[];

/**
 * Build the file→file adjacency from resolved imports and re-exports.
 * Only in-project targets become edges.
 */
export function buildEdges(modules: readonly ModuleInfo[]): Map<string, string[]> {
  const edges = new Map<string, string[]>();
  for (const mod of modules) {
    const targets = new Set<string>();
    for (const imp of mod.imports) {
      if (imp.resolvedFile) targets.add(imp.resolvedFile);
    }
    for (const exp of mod.exports) {
      if (exp.resolvedReexport) targets.add(exp.resolvedReexport);
    }
    for (const req of mod.requires) {
      if (req.resolvedFile) targets.add(req.resolvedFile);
    }
    edges.set(mod.file, [...targets]);
  }
  return edges;
}

/**
 * Compute the set of files reachable from `entryPoints` by following edges.
 * A visited-set makes import cycles and circular re-exports terminate.
 */
export function computeReachability(
  entryPoints: ReadonlySet<string>,
  edgesFrom: EdgesFrom,
): Set<string> {
  const reachable = new Set<string>();
  const stack = [...entryPoints];
  while (stack.length > 0) {
    const file = stack.pop();
    if (file === undefined || reachable.has(file)) continue;
    reachable.add(file);
    for (const target of edgesFrom(file)) {
      if (!reachable.has(target)) stack.push(target);
    }
  }
  return reachable;
}
