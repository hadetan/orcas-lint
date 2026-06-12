import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const built = existsSync(join(root, 'dist', 'cli', 'index.js'));

describe('built CLI smoke', () => {
  it.skipIf(!built)('runs the built binary and prints JSON', async () => {
    const { stdout } = await execFileAsync('node', [join(root, 'bin', 'orcas.mjs'), '--json'], {
      cwd: root,
    });
    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty('findings');
  });
});
