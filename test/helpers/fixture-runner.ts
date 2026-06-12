import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from 'vitest';
import { analyze } from '../../src/index';
import type { Finding, Skip } from '../../src/types';

interface ExpectedResult {
  findings: Finding[];
  skips: Skip[];
}

/**
 * Run Orcas over a hermetic fixture directory and assert its `findings` and
 * `skips` exactly match the co-located `expected.json`.
 */
export async function runFixture(dir: string): Promise<void> {
  const expected = JSON.parse(await readFile(join(dir, 'expected.json'), 'utf8')) as ExpectedResult;
  const result = await analyze({ cwd: dir });
  expect(result.findings).toEqual(expected.findings);
  expect(result.skips).toEqual(expected.skips);
}
