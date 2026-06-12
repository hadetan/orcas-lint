/** A key-value store used to reuse analysis results across runs. */
export interface Cache {
  /** Whether the cache is active. When inactive, reads miss and writes are ignored. */
  readonly enabled: boolean;
  /** Returns the value stored under `key`, or `undefined` when absent or inactive. */
  get<T>(key: string): T | undefined;
  /** Stores `value` under `key`. Does nothing when the cache is inactive. */
  set<T>(key: string, value: T): void;
}

/** Creates an in-memory {@link Cache}. */
export function createCache(enabled = false): Cache {
  const store = new Map<string, unknown>();
  return {
    enabled,
    get<T>(key: string): T | undefined {
      return enabled ? (store.get(key) as T | undefined) : undefined;
    },
    set<T>(key: string, value: T): void {
      if (enabled) store.set(key, value);
    },
  };
}
