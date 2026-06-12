import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { analyze } from '../../src/index';
import type { Hunter, HunterContext } from '../../src/hunters';
import { runPipeline } from '../../src/pod';

const dirs: string[] = [];
async function tempDir(): Promise<string> {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'orcas-ctx-')));
  dirs.push(dir);
  return dir;
}
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe('semantic model on the hunter context', () => {
  it('exposes a complete, whole-program model and omits the value graph', async () => {
    const dir = await tempDir();
    await writeFile(join(dir, 'a.ts'), 'export const foo = 1\n');
    await writeFile(join(dir, 'b.ts'), `import { foo } from './a'\nconsole.log(foo)\n`);

    let captured: HunterContext | undefined;
    const probe: Hunter = {
      id: 'probe',
      rule: 'dead-import',
      run: (ctx) => {
        captured = ctx;
        return { findings: [], skips: [] };
      },
    };
    await runPipeline({ cwd: dir }, { hunters: [probe] });

    expect(captured).toBeDefined();
    const sonar = captured?.sonar;
    expect(sonar?.module('a.ts')?.exports.some((e) => e.exportedName === 'foo')).toBe(true);
    expect(sonar?.importersOf('a.ts', 'foo').some((s) => s.file === 'b.ts')).toBe(true);
    // Value graph is built only when a value-flow rule is enabled — absent here.
    expect(captured?.atlas).toBeUndefined();
  });
});

describe('determinism', () => {
  const fixture = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'fixtures',
    'dead-exports',
    'unreachable-barrel',
  );

  it('produces identical, stably-ordered results across runs', async () => {
    const first = await analyze({ cwd: fixture });
    const second = await analyze({ cwd: fixture });
    expect(first.findings).toEqual(second.findings);
    expect(first.skips).toEqual(second.skips);
  });
});
