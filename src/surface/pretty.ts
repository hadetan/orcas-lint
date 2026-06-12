import pc from 'picocolors';
import { MESSAGES } from '../constants';
import type { AnalyzeResult, Finding } from '../types';

export interface RenderOptions {
  debug: boolean;
}

/** Human-readable terminal rendering, grouped by file. Skips show only under debug. */
export function renderPretty(result: AnalyzeResult, options: RenderOptions): string {
  const { findings, skips, stats } = result;
  const lines: string[] = [];

  if (findings.length === 0) {
    lines.push(pc.green(MESSAGES.noIssues));
  } else {
    const byFile = new Map<string, Finding[]>();
    for (const finding of findings) {
      const group = byFile.get(finding.location.file) ?? [];
      group.push(finding);
      byFile.set(finding.location.file, group);
    }
    for (const [file, group] of byFile) {
      lines.push(pc.underline(file));
      for (const finding of group) {
        const severity = finding.severity === 'error' ? pc.red('error') : pc.yellow('warn');
        const loc = `${finding.location.line}:${finding.location.column}`;
        lines.push(`  ${loc}  ${severity}  ${finding.message}  ${pc.dim(finding.rule)}`);
      }
    }
  }

  if (options.debug && skips.length > 0) {
    lines.push('');
    lines.push(pc.dim(`Skipped (${skips.length}):`));
    for (const skip of skips) {
      const loc = `${skip.location.file}:${skip.location.line}:${skip.location.column}`;
      lines.push(pc.dim(`  ${skip.path ?? skip.rule}  reason: ${skip.reason}  at ${loc}`));
    }
  }

  lines.push('');
  const summary = `${findings.length} finding(s), ${stats.files} file(s), ${stats.durationMs}ms`;
  lines.push(pc.dim(stats.partial ? `${summary} — ${MESSAGES.partialRun}` : summary));

  return lines.join('\n');
}
