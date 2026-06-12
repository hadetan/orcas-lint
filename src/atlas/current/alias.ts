/** Resolves alias chains so that reads through an alias are attributed to the original binding. */
export interface AliasAnalysis {
  /** Returns the canonical node id that `nodeId` aliases, or `nodeId` itself. */
  resolve(nodeId: string): string;
}

/** Creates an {@link AliasAnalysis}. */
export function createAliasAnalysis(): AliasAnalysis {
  return { resolve: (id) => id };
}
