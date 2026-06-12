import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfigError, loadConfig, validateUserConfig } from '../../src/config';

const dirs: string[] = [];

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'orcas-cfg-'));
  dirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe('configuration', () => {
  it('applies zero-config defaults when no config file exists', async () => {
    const config = await loadConfig({ cwd: await tempDir() });
    expect(config.reporter).toBe('pretty');
    expect(config.rules['dead-import']).toBe('error');
    expect(config.rules['dead-property']).toBe('warn');
  });

  it('lets a config file override defaults', async () => {
    const dir = await tempDir();
    await writeFile(join(dir, 'orcas.config.json'), JSON.stringify({ reporter: 'json' }));
    const config = await loadConfig({ cwd: dir });
    expect(config.reporter).toBe('json');
  });

  it('applies rule overrides from options', async () => {
    const config = await loadConfig({
      cwd: await tempDir(),
      ruleOverrides: { 'dead-import': 'off' },
    });
    expect(config.rules['dead-import']).toBe('off');
  });

  it('rejects malformed configuration with a ConfigError', () => {
    expect(() => validateUserConfig({ rules: { 'dead-import': 'bogus' } })).toThrow(ConfigError);
    expect(() => validateUserConfig({ reporter: 'nope' })).toThrow(ConfigError);
    expect(() => validateUserConfig(42)).toThrow(ConfigError);
  });
});
