import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const built = existsSync(join(root, 'dist', 'cli', 'index.js'));

// Run against a clean, empty project so the binary exits 0 and prints a result.
let clean: string;
beforeAll(async () => {
  clean = await mkdtemp(join(tmpdir(), 'orcas-smoke-'));
});
afterAll(async () => {
  await rm(clean, { recursive: true, force: true });
});

describe('built CLI smoke', () => {
  it.skipIf(!built)('runs the built binary and prints JSON', async () => {
    const { stdout } = await execFileAsync('node', [join(root, 'bin', 'orcas.mjs'), clean, '--json'], {
      cwd: root,
    });
    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty('findings');
  });
});
