import { MESSAGES } from '../constants';
import type { Finding, Skip } from '../types';
import type { Hunter, HunterContext, HunterResult } from './base';

/**
 * Hunter 8, dead files. Reports every project file unreachable from any entry
 * point through the static import graph. Reachability accounts for dead chains:
 * a file imported only by another unreachable file is itself unreachable and
 * reported. Test files are skipped silently; the test runner is their implicit
 * entry point and lives outside the static import graph. When reachable code
 * performs a non-literal dynamic import, each otherwise-orphaned file is
 * recorded as a `dynamic-access` skip instead of a finding.
 */
export const deadFiles: Hunter = {
  id: 'dead-file',
  rule: 'dead-file',
  run(ctx: HunterContext): HunterResult {
    const findings: Finding[] = [];
    const skips: Skip[] = [];
    const severity = ctx.config.rules['dead-file'];
    if (severity === 'off') return { findings, skips };

    /**
     * A non-literal dynamic import in reachable code can load any module at runtime,
     * so an otherwise-orphaned file cannot be proven dead.
     * Dynamic imports in unreachable code never execute and do not affect this check.
     */
    const reachableHasDynamic = ctx.sonar
      .files()
      .some((file) => ctx.sonar.isReachable(file) && ctx.sonar.hasDynamicImportIn(file));

    for (const file of ctx.sonar.files()) {
      if (ctx.sonar.isTest(file)) continue;
      if (ctx.sonar.isReachable(file)) continue;
      /* No module record means the file was not parsed; reporting it would be a false positive. */
      if (!ctx.sonar.module(file)) continue;

      if (reachableHasDynamic) {
        skips.push({
          rule: 'dead-file',
          reason: 'dynamic-access',
          message: MESSAGES.skipDynamicFile(file),
          path: file,
          location: { file, line: 1, column: 1 },
        });
        continue;
      }

      findings.push({
        rule: 'dead-file',
        severity,
        message: MESSAGES.deadFile(file),
        path: file,
        location: { file, line: 1, column: 1 },
        certainty: 'certain',
      });
    }

    return { findings, skips };
  },
};
