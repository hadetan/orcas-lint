import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../../src/config';
import { createEcho } from '../../src/echo';
import { unusedDependency } from '../../src/hunters';
import type { HunterContext } from '../../src/hunters';
import { createBudget } from '../../src/pod/budget';
import type { SemanticModel } from '../../src/sonar';
import { runFixture } from '../helpers/fixture-runner';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'unused-dependency');

const stubSonar: SemanticModel = {
  files: () => [],
  module: () => undefined,
  resolve: () => null,
  entryPoints: () => new Set(),
  isReachable: () => false,
  isTest: () => false,
  importersOf: () => [],
  hasDynamicImport: () => false,
  hasDynamicImportIn: () => false,
  isExportLive: () => false,
};

function makeCtx(overrides: Partial<HunterContext> = {}): HunterContext {
  return {
    cwd: '/tmp',
    files: [],
    config: defaultConfig(),
    budget: createBudget(),
    echo: createEcho(),
    sonar: stubSonar,
    manifest: {
      main: undefined, module: undefined, types: undefined, typings: undefined,
      exports: undefined, bin: undefined,
      dependencies: {}, devDependencies: {}, peerDependencies: {},
      optionalDependencies: {}, scripts: {},
    },
    ...overrides,
  };
}

describe('unused-dependency hunter', () => {
  it('reports a declared package that is never imported', async () => {
    await runFixture(join(fixtures, 'basic-unused'));
  });

  it('emits no findings when all declared packages are imported', async () => {
    await runFixture(join(fixtures, 'all-used'));
  });

  it('does not report a package listed in ignoreDependencies', () => {
    const config = defaultConfig();
    config.ignoreDependencies = ['lodash'];
    const sonar: SemanticModel = { ...stubSonar, files: () => [] };
    const ctx = makeCtx({
      config,
      sonar,
      manifest: {
        main: undefined, module: undefined, types: undefined, typings: undefined,
        exports: undefined, bin: undefined,
        dependencies: { lodash: '^4' },
        devDependencies: {}, peerDependencies: {}, optionalDependencies: {}, scripts: {},
      },
    });
    const result = unusedDependency.run(ctx);
    if (result instanceof Promise) throw new Error('expected sync');
    expect(result.findings).toEqual([]);
  });

  it('does not report a package listed in ignoreBinaries', () => {
    const config = defaultConfig();
    config.ignoreBinaries = ['eslint'];
    const ctx = makeCtx({
      config,
      manifest: {
        main: undefined, module: undefined, types: undefined, typings: undefined,
        exports: undefined, bin: undefined,
        dependencies: { eslint: '^8' },
        devDependencies: {}, peerDependencies: {}, optionalDependencies: {}, scripts: {},
      },
    });
    const result = unusedDependency.run(ctx);
    if (result instanceof Promise) throw new Error('expected sync');
    expect(result.findings).toEqual([]);
  });

  it('reports a package used only in a test file when production is true', () => {
    const config = defaultConfig();
    config.production = true;
    const sonar: SemanticModel = {
      ...stubSonar,
      files: () => ['src/index.test.ts'],
      isTest: (f) => f.endsWith('.test.ts'),
      module: (f) =>
        f === 'src/index.test.ts'
          ? {
              file: f,
              imports: [{ localName: 'vi', specifier: 'vitest', resolvedFile: null, kind: 'named', importedName: 'vi', isTypeOnly: false, references: 1, loc: { file: f, line: 1, column: 1 } }],
              exports: [],
              requires: [],
            }
          : undefined,
    };
    const ctx = makeCtx({
      config,
      sonar,
      manifest: {
        main: undefined, module: undefined, types: undefined, typings: undefined,
        exports: undefined, bin: undefined,
        dependencies: {}, devDependencies: { vitest: '^1' }, peerDependencies: {}, optionalDependencies: {}, scripts: {},
      },
    });
    const result = unusedDependency.run(ctx);
    if (result instanceof Promise) throw new Error('expected sync');
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.path).toBe('vitest');
  });

  it('emits no findings when rule is off', () => {
    const config = defaultConfig();
    config.rules['unused-dependency'] = 'off';
    const ctx = makeCtx({
      config,
      manifest: {
        main: undefined, module: undefined, types: undefined, typings: undefined,
        exports: undefined, bin: undefined,
        dependencies: { lodash: '^4' },
        devDependencies: {}, peerDependencies: {}, optionalDependencies: {}, scripts: {},
      },
    });
    const result = unusedDependency.run(ctx);
    if (result instanceof Promise) throw new Error('expected sync');
    expect(result.findings).toEqual([]);
    expect(result.skips).toEqual([]);
  });
});
