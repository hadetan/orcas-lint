import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';
import { runFixture } from '../helpers/fixture-runner';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'dead-exports');

describe('dead-export hunter', () => {
  it('reports an export imported by nobody and not reachable from an entry point', async () => {
    await runFixture(join(fixtures, 'unused-export'));
  });

  it('reports a symbol re-exported only by an unreachable barrel', async () => {
    await runFixture(join(fixtures, 'unreachable-barrel'));
  });

  it('never flags a symbol imported by a sibling module', async () => {
    await runFixture(join(fixtures, 'sibling-import'));
  });

  it('never flags an export that is part of the package entry surface', async () => {
    await runFixture(join(fixtures, 'entry-public-api'));
  });

  it('never flags a symbol consumed through a reachable barrel re-export', async () => {
    await runFixture(join(fixtures, 'reachable-barrel'));
  });

  it('treats a test file as a consumer: an export used only by a test is not flagged', async () => {
    await runFixture(join(fixtures, 'consumed-by-test'));
  });

  it('in production mode excludes tests, so a test-only export becomes dead', async () => {
    await runFixture(join(fixtures, 'production-excludes-tests'));
  });
});
