import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';
import { runFixture } from '../helpers/fixture-runner';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, '..', 'fixtures');

describe('fixture harness', () => {
  it('reports nothing on a scaffolding fixture (skeleton has no detection yet)', async () => {
    await runFixture(join(fixtures, 'scaffolding', 'empty-project'));
  });
});
