import { renderJson } from './json';
import { renderPretty } from './pretty';
import type { RenderOptions } from './pretty';
import type { AnalyzeResult, ReporterName } from '../types';

export { renderPretty, renderJson };
export type { RenderOptions };

/** Render a result with the chosen reporter. */
export function render(
  result: AnalyzeResult,
  reporter: ReporterName,
  options: RenderOptions,
): string {
  return reporter === 'json' ? renderJson(result) : renderPretty(result, options);
}
