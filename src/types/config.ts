import type { ReporterName, RuleId, Severity } from './severity';

export interface TraceConfig {
  /** Interprocedural depth budget: calls followed before bailing to "consumed". */
  depth: number;
}

/** Fully-resolved configuration: defaults merged with user config. */
export interface OrcasConfig {
  project: string[];
  entry: string[];
  ignore: string[];
  tests: string[];
  rules: Record<RuleId, Severity>;
  trace: TraceConfig;
  production: boolean;
  ignoreDependencies: string[];
  ignoreBinaries: string[];
  debug: boolean;
  cache: boolean;
  reporter: ReporterName;
  maxTimeMs: number;
}

/** User-authored config: every field optional; defaults fill the rest. */
export type UserConfig = Partial<Omit<OrcasConfig, 'rules' | 'trace'>> & {
  rules?: Partial<Record<RuleId, Severity>>;
  trace?: Partial<TraceConfig>;
};
