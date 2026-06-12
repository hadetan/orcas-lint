import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../../src/config';
import { createEcho } from '../../src/echo';
import { createRegistry } from '../../src/hunters';
import type { Hunter, HunterContext } from '../../src/hunters';
import { createBudget } from '../../src/pod/budget';
import type { SemanticModel } from '../../src/sonar';
import type { Finding, Skip } from '../../src/types';

const stubSonar: SemanticModel = {
  files: () => [],
  module: () => undefined,
  resolve: () => null,
  entryPoints: () => new Set(),
  isReachable: () => false,
  isTest: () => false,
  importersOf: () => [],
  hasDynamicImport: () => false,
};

function context(): HunterContext {
  return {
    cwd: '/tmp',
    files: [],
    config: defaultConfig(),
    budget: createBudget(),
    echo: createEcho(),
    sonar: stubSonar,
  };
}

const sampleFinding: Finding = {
  rule: 'dead-import',
  severity: 'error',
  message: 'unused import',
  location: { file: 'a.ts', line: 1, column: 1 },
  certainty: 'certain',
};

const sampleSkip: Skip = {
  rule: 'dead-import',
  reason: 'dynamic-access',
  message: 'skipped',
  location: { file: 'a.ts', line: 2, column: 1 },
};

describe('hunter registry', () => {
  it('yields nothing when empty', async () => {
    const run = await createRegistry().run(context());
    expect(run.findings).toEqual([]);
    expect(run.skips).toEqual([]);
    expect(run.huntersRun).toBe(0);
  });

  it("aggregates a registered hunter's findings and skips", async () => {
    const noop: Hunter = {
      id: 'noop',
      rule: 'dead-import',
      run: () => ({ findings: [sampleFinding], skips: [sampleSkip] }),
    };
    const run = await createRegistry([noop]).run(context());
    expect(run.findings).toEqual([sampleFinding]);
    expect(run.skips).toEqual([sampleSkip]);
    expect(run.huntersRun).toBe(1);
  });

  it('does not run a hunter whose rule is off', async () => {
    const ctx = context();
    ctx.config.rules['dead-import'] = 'off';
    const noop: Hunter = {
      id: 'noop',
      rule: 'dead-import',
      run: () => ({ findings: [sampleFinding], skips: [] }),
    };
    const run = await createRegistry([noop]).run(ctx);
    expect(run.huntersRun).toBe(0);
    expect(run.findings).toEqual([]);
  });
});
