import { DEFAULT_MAX_TIME_MS, DEFAULT_TRACE_DEPTH } from '../constants';

export interface BudgetOptions {
  depthLimit?: number;
  /** Global wall-clock budget in ms. `<= 0` means unlimited. */
  maxTimeMs?: number;
  /** Injectable clock for deterministic tests. Defaults to `Date.now`. */
  clock?: () => number;
}

/**
 * Bounds a single analysis run so it cannot exhaust resources: an
 * interprocedural depth limit, a global time budget, and a visited-set guard
 * that makes traversal of cyclic structures terminate.
 */
export interface Budget {
  readonly depthLimit: number;
  readonly maxTimeMs: number;
  /** Enter one interprocedural level. Returns `false` if that would exceed the limit. */
  enter(): boolean;
  /** Leave one interprocedural level. */
  exit(): void;
  /** Visited-set guard: returns `true` if `key` was already seen, else records it. */
  seen(key: string): boolean;
  /** Whether the global time budget has been exceeded. */
  timeExceeded(): boolean;
  elapsedMs(): number;
}

export function createBudget(options: BudgetOptions = {}): Budget {
  const depthLimit = options.depthLimit ?? DEFAULT_TRACE_DEPTH;
  const maxTimeMs = options.maxTimeMs ?? DEFAULT_MAX_TIME_MS;
  const clock = options.clock ?? Date.now;
  const start = clock();
  const visited = new Set<string>();
  let depth = 0;

  return {
    depthLimit,
    maxTimeMs,
    enter() {
      if (depth >= depthLimit) return false;
      depth += 1;
      return true;
    },
    exit() {
      if (depth > 0) depth -= 1;
    },
    seen(key) {
      if (visited.has(key)) return true;
      visited.add(key);
      return false;
    },
    elapsedMs() {
      return clock() - start;
    },
    timeExceeded() {
      if (maxTimeMs <= 0) return false;
      return clock() - start > maxTimeMs;
    },
  };
}
