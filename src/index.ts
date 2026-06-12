import { runPipeline } from './pod';
import type { AnalyzeOptions, AnalyzeResult } from './types';

/** Run Orcas over a project and return findings, skips, and stats. */
export async function analyze(options: AnalyzeOptions = {}): Promise<AnalyzeResult> {
  return runPipeline(options);
}

export { defineConfig } from './config';
export { render } from './surface';
export type { RenderOptions } from './surface';
export type { Hunter, HunterContext, HunterResult } from './hunters';
export type * from './types';
