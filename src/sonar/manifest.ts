import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** The slice of `package.json` the files/dependency Hunters compare against. */
export interface Manifest {
  /** Entry-surface fields, used to seed entry points. */
  main: string | undefined;
  module: string | undefined;
  types: string | undefined;
  typings: string | undefined;
  exports: unknown;
  bin: string | Record<string, string> | undefined;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  optionalDependencies: Record<string, string>;
  scripts: Record<string, string>;
}

const EMPTY: Manifest = {
  main: undefined,
  module: undefined,
  types: undefined,
  typings: undefined,
  exports: undefined,
  bin: undefined,
  dependencies: {},
  devDependencies: {},
  peerDependencies: {},
  optionalDependencies: {},
  scripts: {},
};

/** Read `package.json` from `cwd`. Returns an empty manifest if none exists. */
export async function readManifest(cwd: string): Promise<Manifest> {
  try {
    const raw = await readFile(join(cwd, 'package.json'), 'utf8');
    const pkg = JSON.parse(raw) as Partial<Manifest>;
    return {
      main: pkg.main,
      module: pkg.module,
      types: pkg.types,
      typings: pkg.typings,
      exports: pkg.exports,
      bin: pkg.bin,
      dependencies: pkg.dependencies ?? {},
      devDependencies: pkg.devDependencies ?? {},
      peerDependencies: pkg.peerDependencies ?? {},
      optionalDependencies: pkg.optionalDependencies ?? {},
      scripts: pkg.scripts ?? {},
    };
  } catch {
    return { ...EMPTY };
  }
}
