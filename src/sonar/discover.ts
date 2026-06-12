import { glob } from 'tinyglobby';
import type { OrcasConfig } from '../types';

/** Real file discovery: resolve the configured `project` globs minus `ignore`. */
export async function discoverFiles(config: OrcasConfig, cwd: string): Promise<string[]> {
  const files = await glob(config.project, {
    cwd,
    ignore: config.ignore,
    absolute: false,
    dot: false,
  });
  return files.toSorted();
}
