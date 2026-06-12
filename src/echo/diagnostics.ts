import type { Skip } from '../types';

/**
 * The diagnostics sink. Hunters and Current record every bail-out here; the
 * reporter prints them only under `--debug`. Recording is always on so the data
 * exists — default runs simply do not display it.
 */
export interface Echo {
  record(skip: Skip): void;
  all(): Skip[];
}

export function createEcho(): Echo {
  const skips: Skip[] = [];
  return {
    record(skip) {
      skips.push(skip);
    },
    all() {
      return skips.slice();
    },
  };
}
