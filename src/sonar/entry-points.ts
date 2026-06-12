import type { OrcasConfig } from '../types';

/**
 * Resolves the entry points that are always treated as reachable.
 * They seed reachability analysis: anything reachable from an
 * entry point is considered used.
 *
 * @param config - The resolved configuration.
 * @returns The configured entry globs.
 */
export function deriveEntryPoints(config: OrcasConfig): string[] {
  return [...config.entry];
}
