import { MESSAGES } from '../constants';
import type { ReporterName, Severity, UserConfig } from '../types';

/** Thrown when configuration is malformed or invalid. The CLI maps this to exit code 2. */
export class ConfigError extends Error {
  constructor(detail: string) {
    super(MESSAGES.configError(detail));
    this.name = 'ConfigError';
  }
}

/** Identity helper that gives users full type-checking and autocomplete on their config. */
export function defineConfig(config: UserConfig): UserConfig {
  return config;
}

const SEVERITIES = new Set<Severity>(['off', 'warn', 'error']);
const REPORTERS = new Set<ReporterName>(['pretty', 'json']);

/** Validate a raw, untrusted config object. Throws {@link ConfigError} on any problem. */
export function validateUserConfig(input: unknown): UserConfig {
  if (input === null || typeof input !== 'object') {
    throw new ConfigError('config must export an object');
  }
  const cfg = input as Record<string, unknown>;

  if (cfg.reporter !== undefined && !REPORTERS.has(cfg.reporter as ReporterName)) {
    throw new ConfigError(`unknown reporter "${String(cfg.reporter)}"`);
  }

  if (cfg.rules !== undefined) {
    if (typeof cfg.rules !== 'object' || cfg.rules === null) {
      throw new ConfigError('"rules" must be an object');
    }
    for (const [id, severity] of Object.entries(cfg.rules)) {
      if (!SEVERITIES.has(severity as Severity)) {
        throw new ConfigError(`rule "${id}" has invalid severity "${String(severity)}"`);
      }
    }
  }

  return cfg as UserConfig;
}
