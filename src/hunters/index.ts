import type { Hunter } from './base';
import { deadExports } from './dead-exports';
import { deadImports } from './dead-imports';

export type { Hunter, HunterContext, HunterResult } from './base';
export { createRegistry } from './registry';
export type { Registry, RegistryRun } from './registry';
export { deadImports, deadExports };

/** The built-in Hunters, in stable run order. */
export function defaultHunters(): Hunter[] {
  return [deadImports, deadExports];
}
