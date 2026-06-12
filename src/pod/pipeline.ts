import { loadConfig } from '../config';
import { createCache } from '../den';
import { createEcho } from '../echo';
import { createRegistry } from '../hunters';
import type { Hunter } from '../hunters';
import { deriveEntryPoints, discoverFiles, readManifest } from '../sonar';
import { createBudget } from './budget';
import type { AnalyzeOptions, AnalyzeResult, Finding } from '../types';

export interface PipelineDeps {
  /** The Hunters to run during the pipeline. */
  hunters?: Hunter[];
}

/**
 * Runs the analysis pipeline end to end: load configuration, discover the
 * project's files, parse and resolve them, run the registered Hunters, and
 * collect the results. Respects the run budget and marks the result partial
 * when a budget is exceeded.
 *
 * @param options - Analysis options; missing values fall back to discovered configuration.
 * @param deps - Injected dependencies, such as the Hunters to run.
 * @returns The findings, skips, and run statistics.
 */
export async function runPipeline(
  options: AnalyzeOptions = {},
  deps: PipelineDeps = {},
): Promise<AnalyzeResult> {
  const cwd = options.cwd ?? process.cwd();
  const clock = options.clock ?? Date.now;
  const startedAt = clock();

  const config = await loadConfig(options);

  // Construct the run-scoped budget, diagnostics sink, and cache.
  const budget = createBudget({
    depthLimit: config.trace.depth,
    maxTimeMs: config.maxTimeMs,
    clock,
  });
  const echo = createEcho();
  const cache = createCache(config.cache);
  void cache;

  const files = await discoverFiles(config, cwd);

  const manifest = await readManifest(cwd);
  void manifest;
  void deriveEntryPoints(config);

  const registry = createRegistry(deps.hunters ?? []);
  const run = await registry.run({ cwd, files, config, budget, echo });

  for (const skip of run.skips) echo.record(skip);

  const findings: Finding[] = [];
  for (const finding of run.findings) {
    const severity = config.rules[finding.rule];
    if (severity === 'off') continue;
    findings.push({ ...finding, severity });
  }

  return {
    findings,
    skips: echo.all(),
    stats: {
      files: files.length,
      durationMs: clock() - startedAt,
      huntersRun: run.huntersRun,
      partial: budget.timeExceeded(),
      cacheHits: 0,
    },
  };
}
