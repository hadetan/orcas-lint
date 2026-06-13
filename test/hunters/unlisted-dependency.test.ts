import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../../src/config';
import { createEcho } from '../../src/echo';
import { unlistedDependency } from '../../src/hunters';
import type { HunterContext } from '../../src/hunters';
import { createBudget } from '../../src/pod/budget';
import type { SemanticModel } from '../../src/sonar';
import { runFixture } from '../helpers/fixture-runner';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'unlisted-dependency');

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

const importLoc = { file: 'src/a.ts', line: 1, column: 1 };

function sonarWithImport(file: string, specifier: string, isTest = false): SemanticModel {
  return {
    ...stubSonar,
    files: () => [file],
    isTest: (f) => isTest && f === file,
    module: (f) =>
      f === file
        ? {
            file: f,
            imports: [{ localName: 'x', specifier, resolvedFile: null, kind: 'named', importedName: 'x', isTypeOnly: false, references: 1, loc: importLoc }],
            exports: [],
            requires: [],
          }
        : undefined,
  };
}

describe('unlisted-dependency hunter', () => {
  it('reports a package imported but absent from package.json', async () => {
    await runFixture(join(fixtures, 'basic-unlisted'));
  });

  it('emits no findings when all imports are listed in package.json', async () => {
    await runFixture(join(fixtures, 'all-listed'));
  });

  it('never flags Node.js built-in specifiers', async () => {
    await runFixture(join(fixtures, 'node-builtin-not-flagged'));
  });

  it('does not report a package listed in ignoreDependencies', () => {
    const config = defaultConfig();
    config.ignoreDependencies = ['lodash'];
    const ctx = makeCtx({ config, sonar: sonarWithImport('src/a.ts', 'lodash') });
    const result = unlistedDependency.run(ctx);
    if (result instanceof Promise) throw new Error('expected sync');
    expect(result.findings).toEqual([]);
  });

  it('emits exactly one finding when the same unlisted package appears in multiple files', () => {
    const sonar: SemanticModel = {
      ...stubSonar,
      files: () => ['src/a.ts', 'src/b.ts'],
      module: (f) => ({
        file: f,
        imports: [{ localName: 'x', specifier: 'lodash', resolvedFile: null, kind: 'named', importedName: 'x', isTypeOnly: false, references: 1, loc: { file: f, line: 1, column: 1 } }],
        exports: [],
        requires: [],
      }),
    };
    const ctx = makeCtx({ sonar });
    const result = unlistedDependency.run(ctx);
    if (result instanceof Promise) throw new Error('expected sync');
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.path).toBe('lodash');
  });

  it('does not flag packages imported only in test files when production is true', () => {
    const config = defaultConfig();
    config.production = true;
    const ctx = makeCtx({ config, sonar: sonarWithImport('src/a.test.ts', 'lodash', true) });
    const result = unlistedDependency.run(ctx);
    if (result instanceof Promise) throw new Error('expected sync');
    expect(result.findings).toEqual([]);
  });

  it('emits no findings when rule is off', () => {
    const config = defaultConfig();
    config.rules['unlisted-dependency'] = 'off';
    const ctx = makeCtx({ config, sonar: sonarWithImport('src/a.ts', 'lodash') });
    const result = unlistedDependency.run(ctx);
    if (result instanceof Promise) throw new Error('expected sync');
    expect(result.findings).toEqual([]);
    expect(result.skips).toEqual([]);
  });
});
