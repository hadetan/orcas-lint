import { loadConfig } from '../config';
import { createCache } from '../den';
import { createEcho } from '../echo';
import { createRegistry } from '../hunters';
import type { Hunter } from '../hunters';
import { createSemanticModel, discoverFiles, readManifest } from '../sonar';
import { createBudget } from './budget';
import type { AnalyzeOptions, AnalyzeResult, Finding, SourceLocation } from '../types';

export interface PipelineDeps {
  /** The Hunters to run during the pipeline. */
  hunters?: Hunter[];
}

interface Located {
  location: SourceLocation;
  rule: string;
}

/** Stable ordering: by file, line, column, then rule. */
function byLocation(a: Located, b: Located): number {
  if (a.location.file !== b.location.file) return a.location.file < b.location.file ? -1 : 1;
  if (a.location.line !== b.location.line) return a.location.line - b.location.line;
  if (a.location.column !== b.location.column) return a.location.column - b.location.column;
  if (a.rule !== b.rule) return a.rule < b.rule ? -1 : 1;
  return 0;
}

/**
 * Runs the analysis pipeline end to end: load configuration, discover the
 * project's files, build Sonar's semantic model, run the registered Hunters
 * against it, and collect deterministically-ordered results. Respects the
 * run budget and marks the result partial when a budget is exceeded.
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

  /** Construct the run-scoped budget, diagnostics sink, and cache. */
  const budget = createBudget({
    depthLimit: config.trace.depth,
    maxTimeMs: config.maxTimeMs,
    clock,
  });
  const echo = createEcho();
  const cache = createCache(config.cache);
  void cache;

  const { files, testFiles } = await discoverFiles(config, cwd);
  const manifest = await readManifest(cwd);

  const sonar = await createSemanticModel({ cwd, config, files, testFiles, manifest, budget });

  const registry = createRegistry(deps.hunters ?? []);
  const run = await registry.run({ cwd, files, config, budget, echo, sonar, manifest });

  for (const skip of run.skips) echo.record(skip);

  const collected: Finding[] = [];
  for (const finding of run.findings) {
    const severity = config.rules[finding.rule];
    if (severity === 'off') continue;
    collected.push({ ...finding, severity });
  }
  const findings = collected.toSorted(byLocation);
  const skips = echo.all().toSorted(byLocation);

  return {
    findings,
    skips,
    stats: {
      files: files.length,
      durationMs: clock() - startedAt,
      huntersRun: run.huntersRun,
      partial: budget.timeExceeded(),
      cacheHits: 0,
    },
  };
}
