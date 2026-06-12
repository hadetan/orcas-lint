import { DEFAULT_MAX_TIME_MS, DEFAULT_TRACE_DEPTH } from '../constants';
import type { OrcasConfig, RuleId, Severity } from '../types';

const DEFAULT_SEVERITIES: Record<RuleId, Severity> = {
  'dead-import': 'error',
  'dead-export': 'error',
  'dead-file': 'error',
  'unused-dependency': 'error',
  'unlisted-dependency': 'error',
  'dead-property': 'warn',
  'dead-return': 'warn',
  'dead-mutation': 'warn',
};

/** The fully-resolved default configuration used when nothing is configured. */
export function defaultConfig(): OrcasConfig {
  return {
    project: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    entry: [],
    ignore: ['**/node_modules/**', '**/dist/**', '**/*.d.ts'],
    tests: [
      '**/*.{test,spec}.{ts,tsx,js,jsx,mjs,cjs}',
      '**/__tests__/**',
      '**/__mocks__/**',
      '**/test/**',
      '**/tests/**',
    ],
    rules: { ...DEFAULT_SEVERITIES },
    trace: { depth: DEFAULT_TRACE_DEPTH },
    production: false,
    ignoreDependencies: [],
    ignoreBinaries: [],
    debug: false,
    cache: true,
    reporter: 'pretty',
    maxTimeMs: DEFAULT_MAX_TIME_MS,
  };
}
