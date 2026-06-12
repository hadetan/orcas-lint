import type { AnalyzeResult } from '../types';

/** Stable, machine-readable rendering of a result. */
export function renderJson(result: AnalyzeResult): string {
  return JSON.stringify(
    { findings: result.findings, skips: result.skips, stats: result.stats },
    null,
    2,
  );
}
