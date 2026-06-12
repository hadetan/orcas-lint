import type { Finding, Skip } from './finding';
import type { ReporterName, RuleId, Severity } from './severity';

export interface Stats {
  /** Number of source files analyzed. */
  files: number;
  durationMs: number;
  /** Number of Hunters that ran. */
  huntersRun: number;
  /** True when a budget was exceeded and the run stopped early. */
  partial: boolean;
  cacheHits: number;
}

export interface AnalyzeResult {
  findings: Finding[];
  skips: Skip[];
  stats: Stats;
}

export interface AnalyzeOptions {
  cwd?: string;
  /** Path to a config file; if omitted, config is discovered from `cwd`. */
  config?: string;
  debug?: boolean;
  reporter?: ReporterName;
  cache?: boolean;
  production?: boolean;
  traceDepth?: number;
  maxTimeMs?: number;
  ruleOverrides?: Partial<Record<RuleId, Severity>>;
  /** Testing/advanced hook: inject a clock for deterministic budget behavior. */
  clock?: () => number;
}
