import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runPipeline } from '../../src/pod';
import type { Hunter } from '../../src/hunters';
import type { Finding } from '../../src/types';

const dirs: string[] = [];
async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'orcas-pl-'));
  dirs.push(dir);
  return dir;
}
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

const finding: Finding = {
  rule: 'dead-import',
  severity: 'error',
  message: 'x',
  location: { file: 'a.ts', line: 1, column: 1 },
  certainty: 'certain',
};
const hunter: Hunter = {
  id: 'noop',
  rule: 'dead-import',
  run: () => ({ findings: [finding], skips: [] }),
};

describe('pipeline', () => {
  it('returns an empty, well-formed result when no hunters are registered', async () => {
    const result = await runPipeline({ cwd: await tempDir() });
    expect(result.findings).toEqual([]);
    expect(result.skips).toEqual([]);
    expect(result.stats.files).toBeGreaterThanOrEqual(0);
  });

  it('aggregates injected hunter findings and drops disabled rules', async () => {
    const dir = await tempDir();
    const on = await runPipeline({ cwd: dir }, { hunters: [hunter] });
    expect(on.findings).toHaveLength(1);

    const off = await runPipeline(
      { cwd: dir, ruleOverrides: { 'dead-import': 'off' } },
      { hunters: [hunter] },
    );
    expect(off.findings).toHaveLength(0);
  });

  it('marks the result partial when the time budget is exceeded', async () => {
    let now = 0;
    const clock = (): number => (now += 1_000_000);
    const result = await runPipeline({ cwd: await tempDir(), maxTimeMs: 1, clock });
    expect(result.stats.partial).toBe(true);
  });

  it('is deterministic across runs (findings + skips)', async () => {
    const dir = await tempDir();
    const a = await runPipeline({ cwd: dir });
    const b = await runPipeline({ cwd: dir });
    expect(a.findings).toEqual(b.findings);
    expect(a.skips).toEqual(b.skips);
  });
});
