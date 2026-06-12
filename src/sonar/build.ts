import { realpathSync } from 'node:fs';
import { relative, resolve as resolvePath } from 'node:path';
import type { OrcasConfig } from '../types';
import { deriveEntryPoints } from './entry-points';
import type { Manifest } from './manifest';
import { buildEdges, computeReachability } from './module-graph';
import type { ExportRecord, ImportBinding, ModuleInfo, SemanticModel } from './model';
import {
  createProject,
  detectDynamicImport,
  extractExports,
  extractImports,
  jsxFactoryRoots,
} from './parser';
import { createResolver } from './resolver';
import { findImporters } from './symbols';

export interface SemanticModelInput {
  cwd: string;
  config: OrcasConfig;
  /** Discovered files, relative to `cwd`, in stable order. */
  files: readonly string[];
  /** The subset of `files` that are test files, read as consumers, never reported on. */
  testFiles: ReadonlySet<string>;
  manifest: Manifest;
}

/**
 * Assemble the read-only {@link SemanticModel}: parse every file, resolve its
 * specifiers, build the module graph, derive entry points, and compute
 * reachability. The result is frozen data + pure query closures.
 */
export async function createSemanticModel(input: SemanticModelInput): Promise<SemanticModel> {
  const { cwd, config, files, testFiles, manifest } = input;
  const fileSet = new Set(files);

  const absToRel = new Map<string, string>();
  for (const rel of files) {
    const abs = resolvePath(cwd, rel);
    absToRel.set(abs, rel);
    try {
      absToRel.set(realpathSync(abs), rel);
    } catch {
      // the path may not exist on disk
    }
  }
  const toRel = (abs: string): string | null => {
    const direct = absToRel.get(abs);
    if (direct !== undefined) return direct;
    try {
      const viaReal = absToRel.get(realpathSync(abs));
      if (viaReal !== undefined) return viaReal;
    } catch {
      // realpathSync may throw; fall through to the relative path
    }
    const rel = relative(cwd, abs).replaceAll('\\', '/');
    return fileSet.has(rel) ? rel : null;
  };

  const resolver = createResolver(cwd);
  const project = createProject(cwd);
  const jsxFactories = jsxFactoryRoots(project.getCompilerOptions());

  for (const rel of files) {
    try {
      project.addSourceFileAtPath(resolvePath(cwd, rel));
    } catch {
      // an unreadable file contributes no module
    }
  }

  const modules: ModuleInfo[] = [];
  const moduleByFile = new Map<string, ModuleInfo>();
  let dynamicImport = false;

  for (const rel of files) {
    const abs = resolvePath(cwd, rel);
    const sf = project.getSourceFile(abs);
    if (!sf) continue;

    const imports: ImportBinding[] = extractImports(sf, rel, jsxFactories).map((imp) => {
      const resolved = resolver.resolve(imp.specifier, abs);
      return { ...imp, resolvedFile: resolved ? toRel(resolved) : null };
    });

    const exports: ExportRecord[] = extractExports(sf, rel).map((exp) => {
      if (exp.reexportFrom === undefined) return { ...exp, resolvedReexport: undefined };
      const resolved = resolver.resolve(exp.reexportFrom, abs);
      return { ...exp, resolvedReexport: resolved ? toRel(resolved) : null };
    });

    if (detectDynamicImport(sf)) dynamicImport = true;

    const info: ModuleInfo = { file: rel, imports, exports };
    modules.push(info);
    moduleByFile.set(rel, info);
  }

  const entryPoints = await deriveEntryPoints({ config, manifest, resolver, cwd, fileSet, toRel });
  const edges = buildEdges(modules);
  const reachable = computeReachability(entryPoints, (file) => edges.get(file) ?? []);

  return {
    files: () => files,
    module: (file) => moduleByFile.get(file),
    resolve: (specifier, from) => {
      const resolved = resolver.resolve(specifier, resolvePath(cwd, from));
      return resolved ? toRel(resolved) : null;
    },
    entryPoints: () => entryPoints,
    isReachable: (file) => reachable.has(file),
    isTest: (file) => testFiles.has(file),
    importersOf: (file, name) => findImporters(modules, file, name),
    hasDynamicImport: () => dynamicImport,
  };
}
