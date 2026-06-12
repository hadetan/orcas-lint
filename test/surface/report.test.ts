import { describe, expect, it } from 'vitest';
import { renderJson, renderPretty } from '../../src/surface';
import type { AnalyzeResult } from '../../src/types';

const result: AnalyzeResult = {
  findings: [],
  skips: [
    {
      rule: 'dead-import',
      reason: 'dynamic-access',
      message: 'm',
      path: 'config.x',
      location: { file: 'a.ts', line: 1, column: 1 },
    },
  ],
  stats: { files: 1, durationMs: 0, huntersRun: 0, partial: false, cacheHits: 0 },
};

describe('reporting', () => {
  it('renders a clean summary when there are no findings', () => {
    expect(renderPretty(result, { debug: false })).toContain('No issues found');
  });

  it('hides skips by default and shows them under debug', () => {
    expect(renderPretty(result, { debug: false })).not.toContain('reason: dynamic-access');
    expect(renderPretty(result, { debug: true })).toContain('reason: dynamic-access');
  });

  it('emits parseable JSON with findings, skips, and stats', () => {
    const parsed = JSON.parse(renderJson(result));
    expect(parsed).toHaveProperty('findings');
    expect(parsed).toHaveProperty('skips');
    expect(parsed).toHaveProperty('stats');
  });
});
