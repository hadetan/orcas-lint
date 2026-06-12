import type { SkipReason } from '../types';

/** Every reason the engine may record for backing off rather than reporting. */
export const SKIP_REASONS = [
  'container-spread',
  'container-serialized',
  'dynamic-access',
  'escapes-boundary',
  'beyond-depth-budget',
  'unanalyzable-construct',
  'unrecognized-config',
  'unresolved-specifier',
  'budget-exceeded',
] as const satisfies readonly SkipReason[];
