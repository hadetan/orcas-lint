import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../../src/config';
import { createEcho } from '../../src/echo';
import { deadImports } from '../../src/hunters';
import type { HunterContext } from '../../src/hunters';
import { createBudget } from '../../src/pod/budget';
import type { SemanticModel } from '../../src/sonar';
import { runFixture } from '../helpers/fixture-runner';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'dead-imports');

describe('dead-import hunter', () => {
  it('reports unused named, default, and namespace imports', async () => {
    await runFixture(join(fixtures, 'unused-bindings'));
  });

  it('never flags side-effect imports, and treats type-only and JSX usage as reads', async () => {
    await runFixture(join(fixtures, 'safe-usages'));
  });

  it('never reports findings located in a test file', async () => {
    await runFixture(join(fixtures, 'test-file-not-reported'));
  });

  it('does not flag the React import used implicitly by the classic JSX runtime', async () => {
    await runFixture(join(fixtures, 'jsx-classic-runtime'));
  });

  it('flags an unnecessary React import under the automatic JSX runtime', async () => {
    await runFixture(join(fixtures, 'jsx-automatic-runtime'));
  });

  it('skips (never flags) an import when references cannot be resolved within budget', () => {
    let now = 0;
    const clock = (): number => (now += 1_000_000);
    const budget = createBudget({ maxTimeMs: 1, clock });
    const sonar: SemanticModel = {
      files: () => ['a.ts'],
      module: (file) =>
        file === 'a.ts'
          ? {
              file: 'a.ts',
              imports: [
                {
                  localName: 'x',
                  specifier: './m',
                  resolvedFile: null,
                  kind: 'named',
                  importedName: 'x',
                  isTypeOnly: false,
                  references: 0,
                  loc: { file: 'a.ts', line: 1, column: 10 },
                },
              ],
              exports: [],
            }
          : undefined,
      resolve: () => null,
      entryPoints: () => new Set(),
      isReachable: () => false,
      isTest: () => false,
      importersOf: () => [],
      hasDynamicImport: () => false,
      hasDynamicImportIn: () => false,
    };
    const ctx: HunterContext = {
      cwd: '/tmp',
      files: ['a.ts'],
      config: defaultConfig(),
      budget,
      echo: createEcho(),
      sonar,
      manifest: {
        main: undefined, module: undefined, types: undefined, typings: undefined,
        exports: undefined, bin: undefined,
        dependencies: {}, devDependencies: {}, peerDependencies: {},
        optionalDependencies: {}, scripts: {},
      },
    };

    const result = deadImports.run(ctx);
    if (result instanceof Promise) throw new Error('expected synchronous result');
    expect(result.findings).toEqual([]);
    expect(result.skips).toHaveLength(1);
    expect(result.skips[0]?.reason).toBe('budget-exceeded');
  });
});
