import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** The slice of `package.json` the files/dependency Hunters compare against. */
export interface Manifest {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  optionalDependencies: Record<string, string>;
  bin: string | Record<string, string> | undefined;
  scripts: Record<string, string>;
}

const EMPTY: Manifest = {
  dependencies: {},
  devDependencies: {},
  peerDependencies: {},
  optionalDependencies: {},
  bin: undefined,
  scripts: {},
};

/** Read `package.json` from `cwd`. Returns an empty manifest if none exists. */
export async function readManifest(cwd: string): Promise<Manifest> {
  try {
    const raw = await readFile(join(cwd, 'package.json'), 'utf8');
    const pkg = JSON.parse(raw) as Partial<Manifest>;
    return {
      dependencies: pkg.dependencies ?? {},
      devDependencies: pkg.devDependencies ?? {},
      peerDependencies: pkg.peerDependencies ?? {},
      optionalDependencies: pkg.optionalDependencies ?? {},
      bin: pkg.bin,
      scripts: pkg.scripts ?? {},
    };
  } catch {
    return { ...EMPTY };
  }
}
