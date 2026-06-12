import { glob } from 'tinyglobby';
import type { OrcasConfig } from '../types';

export interface Discovery {
  /** Files to analyze, relative to `cwd`, in stable order. */
  files: string[];
  /** The subset of `files` that are test files. */
  testFiles: Set<string>;
}

/**
 * Discover the files to analyze. Resolves the `project` globs minus `ignore`,
 * then classifies which of them are test files via the `tests` globs. In
 * `production` mode test files are excluded from analysis entirely; otherwise
 * they are kept and flagged for the Hunters to skip.
 */
export async function discoverFiles(config: OrcasConfig, cwd: string): Promise<Discovery> {
  const projectFiles = await glob(config.project, {
    cwd,
    ignore: config.ignore,
    absolute: false,
    dot: false,
  });

  const testMatches = config.tests.length
    ? await glob(config.tests, { cwd, ignore: config.ignore, absolute: false, dot: false })
    : [];
  const testSet = new Set(testMatches);

  const kept = config.production ? projectFiles.filter((f) => !testSet.has(f)) : projectFiles;
  const testFiles = new Set(kept.filter((f) => testSet.has(f)));

  return { files: kept.toSorted(), testFiles };
}
