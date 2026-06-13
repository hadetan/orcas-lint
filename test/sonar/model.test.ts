import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
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

  it('treats a root config file as an entry point and follows its imports', async () => {
    const dir = await tempDir();
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'x', version: '1.0.0' }));
    await writeFile(join(dir, 'vite.config.ts'), `import { plugin } from './build-utils'\nexport default plugin\n`);
    await writeFile(join(dir, 'build-utils.ts'), `export const plugin = { name: 'x' }\n`);
    await writeFile(join(dir, 'orphan.ts'), `export const orphan = 1\n`);

    const m = await model(dir);
    expect(m.entryPoints().has('vite.config.ts')).toBe(true);
    expect(m.isReachable('vite.config.ts')).toBe(true);
    expect(m.isReachable('build-utils.ts')).toBe(true);
    expect(m.isReachable('orphan.ts')).toBe(false);
  });

  it('does not auto-detect nested config files as entry points', async () => {
    const dir = await tempDir();
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'x', version: '1.0.0' }));
    await mkdir(join(dir, 'packages', 'foo'), { recursive: true });
    await writeFile(join(dir, 'packages', 'foo', 'vite.config.ts'), `import { plugin } from './build-utils'\nexport default plugin\n`);
    await writeFile(join(dir, 'packages', 'foo', 'build-utils.ts'), `export const plugin = { name: 'x' }\n`);

    const m = await model(dir);
    expect(m.entryPoints().has('packages/foo/vite.config.ts')).toBe(false);
    expect(m.isReachable('packages/foo/vite.config.ts')).toBe(false);
    expect(m.isReachable('packages/foo/build-utils.ts')).toBe(false);
  });
});

describe('semantic model — export-level liveness (isExportLive)', () => {
  it('marks every export of an entry-point file as live', async () => {
    const dir = await tempDir();
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'x', version: '1.0.0', main: './index.ts' }));
    await writeFile(join(dir, 'index.ts'), `export const pub = 1\n`);

    const m = await model(dir);
    expect(m.isExportLive('index.ts', 'pub')).toBe(true);
  });

  it('marks an export directly imported by any module as live', async () => {
    const dir = await tempDir();
    await writeFile(join(dir, 'a.ts'), `export const foo = 1\n`);
    await writeFile(join(dir, 'b.ts'), `import { foo } from './a'\nconsole.log(foo)\n`);

    const m = await model(dir);
    expect(m.isExportLive('a.ts', 'foo')).toBe(true);
  });

  it('marks a dead export in a reachable file as not live', async () => {
    const dir = await tempDir();
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'x', version: '1.0.0', main: './index.ts' }));
    await writeFile(join(dir, 'index.ts'), `import { used } from './utils'\nconsole.log(used)\n`);
    await writeFile(join(dir, 'utils.ts'), `export const used = 1\nexport const dead = 2\n`);

    const m = await model(dir);
    expect(m.isExportLive('utils.ts', 'used')).toBe(true);
    expect(m.isExportLive('utils.ts', 'dead')).toBe(false);
  });

  it('marks an export re-exported through a live barrel as live', async () => {
    const dir = await tempDir();
    await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'x', version: '1.0.0', main: './index.ts' }));
    await writeFile(join(dir, 'index.ts'), `export { x } from './impl'\n`);
    await writeFile(join(dir, 'impl.ts'), `export const x = 1\n`);

    const m = await model(dir);
    expect(m.isExportLive('impl.ts', 'x')).toBe(true);
  });

  it('terminates cleanly on a circular re-export chain', async () => {
    const dir = await tempDir();
    await writeFile(join(dir, 'a.ts'), `export { b } from './b'\nexport const a = 1\n`);
    await writeFile(join(dir, 'b.ts'), `export { a } from './a'\nexport const b = 2\n`);
    await writeFile(join(dir, 'consumer.ts'), `import { a, b } from './a'\nconsole.log(a, b)\n`);

    const m = await model(dir);
    expect(m.isExportLive('a.ts', 'a')).toBe(true);
    expect(m.isExportLive('a.ts', 'b')).toBe(true);
    expect(m.isExportLive('b.ts', 'b')).toBe(true);
  });
});
