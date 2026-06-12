import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { run } from '../../src/cli/index';
import { analyze } from '../../src/index';
import { exitCodeForFindings } from '../../src/cli/args';
import type { Finding } from '../../src/types';

// A clean, empty project so CLI runs are deterministic and report nothing,
// independent of the contents of the Orcas repo the suite runs inside.
let clean: string;
beforeAll(async () => {
  clean = await mkdtemp(join(tmpdir(), 'orcas-cli-'));
});
afterAll(async () => {
  await rm(clean, { recursive: true, force: true });
});

function argv(...args: string[]): string[] {
  return ['node', 'orcas', ...args];
}

function captureStdout(): { text: () => string } {
  const chunks: string[] = [];
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown): boolean => {
    chunks.push(String(chunk));
    return true;
  });
  return { text: () => chunks.join('') };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('cli', () => {
  it('exits 0 on a clean run and its result matches the API', async () => {
    const out = captureStdout();
    const code = await run(argv(clean, '--json'));
    expect(code).toBe(0);
    const printed = JSON.parse(out.text());
    const api = await analyze({ cwd: clean });
    expect(printed.findings).toEqual(api.findings);
    expect(printed.skips).toEqual(api.skips);
  });

  it('switches output format: pretty by default, JSON with --json', async () => {
    const pretty = captureStdout();
    await run(argv(clean));
    expect(pretty.text()).toContain('No issues found');

    vi.restoreAllMocks();
    const json = captureStdout();
    await run(argv(clean, '--json'));
    expect(() => JSON.parse(json.text())).not.toThrow();
  });

  it('accepts --debug and --rule id=off without error', async () => {
    captureStdout();
    expect(await run(argv(clean, '--debug'))).toBe(0);
    expect(await run(argv(clean, '--rule', 'dead-import=off'))).toBe(0);
  });

  it('exits 2 on an invalid reporter (usage error)', async () => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    expect(await run(argv('--reporter', 'nope'))).toBe(2);
  });

  it('computes exit codes from findings', () => {
    const error: Finding = {
      rule: 'dead-import',
      severity: 'error',
      message: 'x',
      location: { file: 'a', line: 1, column: 1 },
      certainty: 'certain',
    };
    expect(exitCodeForFindings([])).toBe(0);
    expect(exitCodeForFindings([error])).toBe(1);
  });
});
