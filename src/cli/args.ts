import type { AnalyzeOptions, Finding, ReporterName, RuleId, Severity } from '../types';

export interface RawFlags {
  debug?: boolean;
  json?: boolean;
  reporter?: string;
  config?: string;
  cache?: boolean;
  traceDepth?: string | number;
  rule?: string | string[];
  production?: boolean;
  maxTime?: string | number;
  paths?: string[];
}

function toNumber(value: string | number | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Map parsed CLI flags into engine {@link AnalyzeOptions}. */
export function flagsToOptions(flags: RawFlags): AnalyzeOptions {
  const options: AnalyzeOptions = {};

  if (flags.paths && flags.paths.length > 0) options.cwd = String(flags.paths[0]);
  if (flags.debug) options.debug = true;

  const reporter = flags.json ? 'json' : (flags.reporter as ReporterName | undefined);
  if (reporter) options.reporter = reporter;

  if (flags.config) options.config = flags.config;
  if (flags.cache === false) options.cache = false;
  if (flags.production) options.production = true;

  const depth = toNumber(flags.traceDepth);
  if (depth !== undefined) options.traceDepth = depth;

  const maxTime = toNumber(flags.maxTime);
  if (maxTime !== undefined) options.maxTimeMs = maxTime;

  const overrides = parseRuleOverrides(flags.rule);
  if (overrides) options.ruleOverrides = overrides;

  return options;
}

/** Parse `--rule id=severity` (repeatable) into a rule-override map. */
export function parseRuleOverrides(
  rule: string | string[] | undefined,
): Partial<Record<RuleId, Severity>> | undefined {
  if (!rule) return undefined;
  const entries = Array.isArray(rule) ? rule : [rule];
  const overrides: Partial<Record<RuleId, Severity>> = {};
  for (const entry of entries) {
    const [id, severity] = entry.split('=');
    if (id && severity) overrides[id as RuleId] = severity as Severity;
  }
  return Object.keys(overrides).length > 0 ? overrides : undefined;
}

/** Exit code policy: 1 if any error-severity finding, else 0. */
export function exitCodeForFindings(findings: Finding[]): number {
  return findings.some((finding) => finding.severity === 'error') ? 1 : 0;
}
