/** Tracks symbol identity across modules, so that two references resolve to the same symbol. */
export interface SymbolTable {
  /** The number of symbols currently tracked. */
  size(): number;
}

/** Creates an empty {@link SymbolTable}. */
export function createSymbolTable(): SymbolTable {
  return { size: () => 0 };
}
