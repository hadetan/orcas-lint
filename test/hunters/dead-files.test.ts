import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../../src/config';
import { createEcho } from '../../src/echo';
import { deadFiles } from '../../src/hunters';
import type { HunterContext } from '../../src/hunters';
import { createBudget } from '../../src/pod/budget';
import type { SemanticModel } from '../../src/sonar';
import { runFixture } from '../helpers/fixture-runner';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'dead-files');
const soundness = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'soundness');

describe('dead-file hunter', () => {
  it('reports an orphaned file that no entry point reaches', async () => {
    await runFixture(join(fixtures, 'orphan-file'));
  });

  it('reports every file in a dead import chain', async () => {
    await runFixture(join(fixtures, 'dead-chain'));
  });

  it('never flags a file reachable through an import chain', async () => {
    await runFixture(join(fixtures, 'all-reachable'));
  });

  it('never flags an entry-point file', async () => {
    await runFixture(join(fixtures, 'entry-not-flagged'));
  });

  it('silently skips a test file that nothing imports (no finding, no skip)', async () => {
    await runFixture(join(fixtures, 'test-not-flagged'));
  });

  it('still flags orphans when a dynamic import lives only in unreachable code', async () => {
    await runFixture(join(soundness, 'dead-file-dynamic-in-unreachable'));
  });

  it('emits no findings or skips when the rule is off', () => {
    const sonar: SemanticModel = {
      files: () => ['orphan.ts'],
      module: (file) => (file === 'orphan.ts' ? { file, imports: [], exports: [], requires: [] } : undefined),
      resolve: () => null,
      entryPoints: () => new Set(),
      isReachable: () => false,
      isTest: () => false,
      importersOf: () => [],
      hasDynamicImport: () => false,
      hasDynamicImportIn: () => false,
      isExportLive: () => false,
    };
    const config = defaultConfig();
    config.rules['dead-file'] = 'off';
    const ctx: HunterContext = {
      cwd: '/tmp',
      files: ['orphan.ts'],
      config,
      budget: createBudget(),
      echo: createEcho(),
      sonar,
      manifest: {
        main: undefined, module: undefined, types: undefined, typings: undefined,
        exports: undefined, bin: undefined,
        dependencies: {}, devDependencies: {}, peerDependencies: {},
        optionalDependencies: {}, scripts: {},
      },
    };

    const result = deadFiles.run(ctx);
    if (result instanceof Promise) throw new Error('expected synchronous result');
    expect(result.findings).toEqual([]);
    expect(result.skips).toEqual([]);
  });
});
