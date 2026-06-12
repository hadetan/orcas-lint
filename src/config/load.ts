import { loadConfig as loadC12 } from 'c12';
import { defaultConfig } from './defaults';
import { ConfigError, validateUserConfig } from './schema';
import type { AnalyzeOptions, OrcasConfig, RuleId, Severity, UserConfig } from '../types';

/** Discover + load `orcas.config.*`, merge over defaults and CLI options. */
export async function loadConfig(options: AnalyzeOptions = {}): Promise<OrcasConfig> {
  const cwd = options.cwd ?? process.cwd();
  let user: UserConfig = {};

  try {
    const result = await loadC12<UserConfig>({
      name: 'orcas',
      cwd,
      configFile: options.config,
    });
    user = validateUserConfig(result.config ?? {});
  } catch (err) {
    if (err instanceof ConfigError) throw err;
    throw new ConfigError(err instanceof Error ? err.message : String(err));
  }

  return mergeConfig(defaultConfig(), user, options);
}

function mergeConfig(base: OrcasConfig, user: UserConfig, options: AnalyzeOptions): OrcasConfig {
  const rules: Record<RuleId, Severity> = { ...base.rules, ...user.rules };
  if (options.ruleOverrides) Object.assign(rules, options.ruleOverrides);

  return {
    project: user.project ?? base.project,
    entry: user.entry ?? base.entry,
    ignore: user.ignore ?? base.ignore,
    tests: user.tests ?? base.tests,
    rules,
    trace: { depth: options.traceDepth ?? user.trace?.depth ?? base.trace.depth },
    production: options.production ?? user.production ?? base.production,
    ignoreDependencies: user.ignoreDependencies ?? base.ignoreDependencies,
    ignoreBinaries: user.ignoreBinaries ?? base.ignoreBinaries,
    debug: options.debug ?? user.debug ?? base.debug,
    cache: options.cache ?? user.cache ?? base.cache,
    reporter: options.reporter ?? user.reporter ?? base.reporter,
    maxTimeMs: options.maxTimeMs ?? user.maxTimeMs ?? base.maxTimeMs,
  };
}
