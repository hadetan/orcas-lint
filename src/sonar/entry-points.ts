import { join } from 'node:path';
import { glob } from 'tinyglobby';
import type { OrcasConfig } from '../types';
import type { Manifest } from './manifest';
import type { Resolver } from './resolver';

export interface EntryPointInput {
  config: OrcasConfig;
  manifest: Manifest;
  resolver: Resolver;
  cwd: string;
  /** Analyzed files, relative to `cwd`. */
  fileSet: ReadonlySet<string>;
  /** Map an absolute path back to an in-project relative path, or `null`. */
  toRel: (abs: string) => string | null;
}

/** Recursively collect every string value. */
function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const v of value) collectStrings(v, out);
  else if (value && typeof value === 'object')
    for (const v of Object.values(value)) collectStrings(v, out);
}

/**
 * Derive the entry-point files that are always treated as reachable: the
 * configured `entry` globs plus the package's public surface each resolved
 * to an in-project file.
 */
export async function deriveEntryPoints(input: EntryPointInput): Promise<Set<string>> {
  const { config, manifest, resolver, cwd, fileSet, toRel } = input;
  const entries = new Set<string>();

  if (config.entry.length > 0) {
    const matched = await glob(config.entry, {
      cwd,
      ignore: config.ignore,
      absolute: false,
      dot: false,
    });
    for (const file of matched) {
      const rel = file.replaceAll('\\', '/');
      if (fileSet.has(rel)) entries.add(rel);
    }
  }

  const candidates: string[] = [];
  collectStrings(manifest.main, candidates);
  collectStrings(manifest.module, candidates);
  collectStrings(manifest.types, candidates);
  collectStrings(manifest.typings, candidates);
  collectStrings(manifest.exports, candidates);
  collectStrings(manifest.bin, candidates);

  const fromPkg = join(cwd, 'package.json');
  for (const candidate of candidates) {
    const specifier =
      candidate.startsWith('.') || candidate.startsWith('/') ? candidate : `./${candidate}`;
    const abs = resolver.resolve(specifier, fromPkg);
    if (!abs) continue;
    const rel = toRel(abs);
    if (rel && fileSet.has(rel)) entries.add(rel);
  }

  /**
   * Build-tool config files at the project root are treated as implicit roots
   * to prevent their transitive imports from being flagged as dead code.
   * Root-level glob only avoids capturing nested configs.
   */
  const configFiles = await glob('*.config.{ts,js,mjs,cjs}', {
    cwd,
    ignore: config.ignore,
    absolute: false,
    dot: false,
  });
  for (const file of configFiles) {
    const rel = file.replaceAll('\\', '/');
    if (fileSet.has(rel)) entries.add(rel);
  }

  return entries;
}
