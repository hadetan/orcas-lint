import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ResolverFactory } from 'oxc-resolver';

/** Resolves module specifiers to absolute file paths. */
export interface Resolver {
  /**
   * Resolve `specifier` as imported from the absolute file `fromFile`.
   *
   * @returns The resolved absolute path, or `null` when it cannot be resolved.
   */
  resolve(specifier: string, fromFile: string): string | null;
}

const EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json'];

/**
 * Create a resolver backed by `oxc-resolver`. Honors `tsconfig` `paths` when a
 * `tsconfig.json` exists at `cwd`, and never throws, unresolvable specifiers
 * return `null` so the caller can record a skip rather than abort.
 */
export function createResolver(cwd: string): Resolver {
  const tsconfigPath = join(cwd, 'tsconfig.json');
  const factory = new ResolverFactory({
    extensions: EXTENSIONS,
    conditionNames: ['node', 'import', 'require', 'default'],
    ...(existsSync(tsconfigPath) ? { tsconfig: { configFile: tsconfigPath } } : {}),
  });

  return {
    resolve(specifier, fromFile) {
      try {
        const result = factory.sync(dirname(fromFile), specifier);
        return result.path ?? null;
      } catch {
        return null;
      }
    },
  };
}
