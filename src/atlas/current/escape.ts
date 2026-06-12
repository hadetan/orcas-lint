import type { SkipReason } from '../../types';

/** Determines whether a value leaves analyzable scope */
export interface EscapeAnalysis {
  /** Returns the reason a value escapes, or `null` when it does not. */
  classify(nodeId: string): SkipReason | null;
}

/** Creates an {@link EscapeAnalysis}. */
export function createEscapeAnalysis(): EscapeAnalysis {
  return { classify: () => null };
}
