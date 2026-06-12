import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';
import { runFixture } from '../helpers/fixture-runner';

const soundness = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'soundness');

// The precision firewall: every case here must produce a skip, never a finding.
describe('soundness corpus (skip, never flag)', () => {
  it('skips dead-export analysis when a non-literal dynamic import is present', async () => {
    await runFixture(join(soundness, 'dynamic-import'));
  });

  it('skips when a re-export targets a module outside the analyzed project', async () => {
    await runFixture(join(soundness, 'reexport-boundary'));
  });

  it('skips when a named re-export targets a module outside the analyzed project', async () => {
    await runFixture(join(soundness, 'reexport-named-boundary'));
  });
});
