import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { defaultConfig } from '../../src/config';
import { createSemanticModel, discoverFiles, readManifest } from '../../src/sonar';

const dirs: string[] = [];
async function tempDir(): Promise<string> {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'orcas-model-')));
  dirs.push(dir);
  return dir;
}
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

async function model(dir: string) {
  const config = defaultConfig();
  const { files, testFiles } = await discoverFiles(config, dir);
  const manifest = await readManifest(dir);
  return createSemanticModel({ cwd: dir, config, files, testFiles, manifest });
}

describe('semantic model — entry points & reachability', () => {
  it('treats package entry as an entry point and follows imports transitively', async () => {
    const dir = await tempDir();
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'x', version: '1.0.0', main: './index.ts' }));
    await writeFile(join(dir, 'index.ts'), `import { a } from './a'\nconsole.log(a)\n`);
    await writeFile(join(dir, 'a.ts'), `export const a = 1\n`);
    await writeFile(join(dir, 'orphan.ts'), `export const o = 1\n`);

    const m = await model(dir);
    expect(m.entryPoints().has('index.ts')).toBe(true);
    expect(m.isReachable('a.ts')).toBe(true);
    expect(m.isReachable('orphan.ts')).toBe(false);
  });

  it('attributes a direct import back to the exporting module', async () => {
    const dir = await tempDir();
    await writeFile(join(dir, 'a.ts'), `export const foo = 1\n`);
    await writeFile(join(dir, 'b.ts'), `import { foo } from './a'\nconsole.log(foo)\n`);

    const m = await model(dir);
    expect(m.importersOf('a.ts', 'foo').some((s) => s.file === 'b.ts' && !s.viaReexport)).toBe(true);
  });

  it('follows a re-export so the origin is reachable through a reachable barrel', async () => {
    const dir = await tempDir();
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'x', version: '1.0.0', main: './index.ts' }));
    await writeFile(join(dir, 'index.ts'), `export { x } from './impl'\n`);
    await writeFile(join(dir, 'impl.ts'), `export const x = 1\n`);

    const m = await model(dir);
    expect(m.isReachable('impl.ts')).toBe(true);
  });
});
