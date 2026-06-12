import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createResolver } from '../../src/sonar/resolver';

const dirs: string[] = [];
async function tempDir(): Promise<string> {
  // realpath so resolved paths (which oxc-resolver realpaths) compare equal on macOS.
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'orcas-res-')));
  dirs.push(dir);
  return dir;
}
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe('sonar resolver', () => {
  it('resolves a relative specifier with an implicit extension', async () => {
    const dir = await tempDir();
    await writeFile(join(dir, 'util.ts'), 'export const x = 1\n');
    await writeFile(join(dir, 'index.ts'), '');
    const resolver = createResolver(dir);
    expect(resolver.resolve('./util', join(dir, 'index.ts'))).toBe(join(dir, 'util.ts'));
  });

  it('returns null for an unresolved specifier without throwing', async () => {
    const dir = await tempDir();
    await writeFile(join(dir, 'index.ts'), '');
    const resolver = createResolver(dir);
    expect(resolver.resolve('./missing', join(dir, 'index.ts'))).toBeNull();
  });

  it('resolves a tsconfig path alias', async () => {
    const dir = await tempDir();
    await mkdir(join(dir, 'src'));
    await writeFile(join(dir, 'src', 'util.ts'), 'export const x = 1\n');
    await writeFile(join(dir, 'index.ts'), '');
    await writeFile(
      join(dir, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@app/*': ['src/*'] } } }),
    );
    const resolver = createResolver(dir);
    expect(resolver.resolve('@app/util', join(dir, 'index.ts'))).toBe(join(dir, 'src', 'util.ts'));
  });
});
