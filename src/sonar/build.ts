import { realpathSync } from 'node:fs';
import { relative, resolve as resolvePath } from 'node:path';
import type { Budget } from '../pod/budget';
import type { OrcasConfig } from '../types';
import { deriveEntryPoints } from './entry-points';
import type { Manifest } from './manifest';
import { buildEdges, computeReachability } from './module-graph';
import type { ExportRecord, ImportBinding, ModuleInfo, SemanticModel } from './model';
import {
  createProject,
  detectDynamicImport,
  extractCjsBindings,
  extractCjsExports,
  extractExports,
  extractImports,
  extractRequires,
  jsxFactoryRoots,
} from './parser';
import { createResolver } from './resolver';
import { findImporters } from './symbols';

function computeExportLiveness(
  modules: readonly ModuleInfo[],
  entryPoints: ReadonlySet<string>,
  moduleByFile: Map<string, ModuleInfo>,
): Set<string> {
  const live = new Set<string>();
  const queue: [string, string][] = [];

  const exportByKey = new Map<string, ExportRecord>();
  const starReexportsByFile = new Map<string, string[]>();
  for (const mod of modules) {
    for (const exp of mod.exports) {
      const key = `${mod.file}::${exp.exportedName}`;
      if (!exportByKey.has(key)) exportByKey.set(key, exp);
      if (exp.kind === 'star-reexport' && exp.resolvedReexport) {
        const arr = starReexportsByFile.get(mod.file) ?? [];
        arr.push(exp.resolvedReexport);
        starReexportsByFile.set(mod.file, arr);
      }
    }
  }

  const add = (file: string, name: string): void => {
    const key = `${file}::${name}`;
    if (!live.has(key)) {
      live.add(key);
      queue.push([file, name]);
    }
  };

  for (const file of entryPoints) {
    const mod = moduleByFile.get(file);
    if (!mod) continue;
    for (const exp of mod.exports) add(file, exp.exportedName);
  }

  for (const mod of modules) {
    for (const imp of mod.imports) {
      if (!imp.resolvedFile) continue;
      if (imp.kind === 'named' || imp.kind === 'cjs-named') {
        if (imp.importedName) add(imp.resolvedFile, imp.importedName);
      } else if (imp.kind === 'default') {
        add(imp.resolvedFile, 'default');
      } else if (imp.kind === 'namespace' || imp.kind === 'cjs-namespace') {
        const target = moduleByFile.get(imp.resolvedFile);
        if (target) {
          for (const exp of target.exports) add(imp.resolvedFile, exp.exportedName);
        }
      }
    }
  }

  let i = 0;
  while (i < queue.length) {
    const item = queue[i++];
    if (!item) continue;
    const [file, name] = item;
    const exp = exportByKey.get(`${file}::${name}`);
    if (!exp) {
      const stars = starReexportsByFile.get(file);
      if (stars) {
        for (const target of stars) add(target, name);
      }
      continue;
    }
    if (exp.kind === 'named-reexport' && exp.resolvedReexport && exp.localName) {
      add(exp.resolvedReexport, exp.localName);
    } else if (exp.kind === 'star-reexport' && exp.resolvedReexport) {
      const target = moduleByFile.get(exp.resolvedReexport);
      if (target) {
        for (const targetExp of target.exports) add(exp.resolvedReexport, targetExp.exportedName);
      }
    }
  }

  return live;
}

export interface SemanticModelInput {
  cwd: string;
  config: OrcasConfig;
  /** Discovered files, relative to `cwd`, in stable order. */
  files: readonly string[];
  /** The subset of `files` that are test files, read as consumers, never reported on. */
  testFiles: ReadonlySet<string>;
  manifest: Manifest;
  /** Run budget. When the wall-clock is exceeded, model construction stops early. */
  budget?: Budget;
}

/**
 * Assemble the read-only {@link SemanticModel}: parse every file, resolve its
 * specifiers, build the module graph, derive entry points, and compute
 * reachability. The result is frozen data + pure query closures.
 */
export async function createSemanticModel(input: SemanticModelInput): Promise<SemanticModel> {
  const { cwd, config, files, testFiles, manifest, budget } = input;
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
    if (budget?.timeExceeded()) break;
    try {
      project.addSourceFileAtPath(resolvePath(cwd, rel));
    } catch {
      // an unreadable file contributes no module
    }
  }

  const modules: ModuleInfo[] = [];
  const moduleByFile = new Map<string, ModuleInfo>();
  const dynamicImportFiles = new Set<string>();

  for (const rel of files) {
    if (budget?.timeExceeded()) break;
    const abs = resolvePath(cwd, rel);
    const sf = project.getSourceFile(abs);
    if (!sf) continue;

    const imports: ImportBinding[] = [
      ...extractImports(sf, rel, jsxFactories).map((imp) => {
        const resolved = resolver.resolve(imp.specifier, abs);
        return { ...imp, resolvedFile: resolved ? toRel(resolved) : null };
      }),
      ...extractCjsBindings(sf, rel).map((imp) => {
        const resolved = resolver.resolve(imp.specifier, abs);
        return { ...imp, resolvedFile: resolved ? toRel(resolved) : null };
      }),
    ];

    const exports: ExportRecord[] = [
      ...extractExports(sf, rel).map((exp) => {
        if (exp.reexportFrom === undefined) return { ...exp, resolvedReexport: undefined };
        const resolved = resolver.resolve(exp.reexportFrom, abs);
        return { ...exp, resolvedReexport: resolved ? toRel(resolved) : null };
      }),
      ...extractCjsExports(sf, rel).map((exp) => ({ ...exp, resolvedReexport: undefined as undefined })),
    ];

    if (detectDynamicImport(sf)) dynamicImportFiles.add(rel);

    const requires = extractRequires(sf, rel).map((req) => {
      const resolved = resolver.resolve(req.specifier, abs);
      return { ...req, resolvedFile: resolved ? toRel(resolved) : null };
    });

    const info: ModuleInfo = { file: rel, imports, exports, requires };
    modules.push(info);
    moduleByFile.set(rel, info);
  }

  const entryPoints = await deriveEntryPoints({ config, manifest, resolver, cwd, fileSet, toRel });
  const edges = buildEdges(modules);
  const reachable = computeReachability(entryPoints, (file) => edges.get(file) ?? []);
  const exportLiveness = computeExportLiveness(modules, entryPoints, moduleByFile);

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
    hasDynamicImport: () => dynamicImportFiles.size > 0,
    hasDynamicImportIn: (file) => dynamicImportFiles.has(file),
    isExportLive: (file, name) => exportLiveness.has(`${file}::${name}`),
  };
}
