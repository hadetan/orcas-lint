import { MESSAGES } from '../constants';
import type { ExportRecord } from '../sonar';
import type { Finding, Skip, SkipReason } from '../types';
import type { Hunter, HunterContext, HunterResult } from './base';

/** A `* from` re-export to a target Sonar could not place in the project. */
function unresolvedStar(mod: { exports: readonly ExportRecord[] }): ExportRecord | undefined {
  return mod.exports.find(
    (exp) => exp.kind === 'star-reexport' && (exp.resolvedReexport ?? null) === null,
  );
}

/**
 * Hunter 2, dead exports. Reports an exported symbol that is not reachable from
 * an entry point and that no module imports directly. Re-export liveness is
 * handled by reachability, so a symbol re-exported only by an unreachable barrel
 * is still reported, while one behind a reachable barrel is not. Backs off to a
 * skip where consumers cannot be seen.
 */
export const deadExports: Hunter = {
  id: 'dead-export',
  rule: 'dead-export',
  run(ctx: HunterContext): HunterResult {
    const findings: Finding[] = [];
    const skips: Skip[] = [];
    const severity = ctx.config.rules['dead-export'];
    const dynamic = ctx.sonar.hasDynamicImport();

    for (const file of ctx.sonar.files()) {
      if (ctx.sonar.isTest(file)) continue;
      const mod = ctx.sonar.module(file);
      if (!mod) continue;
      if (ctx.sonar.isReachable(file)) continue;

      const star = unresolvedStar(mod);
      if (star) {
        const reason: SkipReason = (star.reexportFrom ?? '').startsWith('.')
          ? 'unresolved-specifier'
          : 'escapes-boundary';
        skips.push({
          rule: 'dead-export',
          reason,
          message: MESSAGES.skipReexportBoundary(star.reexportFrom ?? '*'),
          location: star.loc,
        });
        continue;
      }

      for (const exp of mod.exports) {
        if (exp.kind === 'star-reexport' || exp.kind === 'named-reexport') continue;
        const importers = ctx.sonar.importersOf(file, exp.exportedName);
        if (importers.some((site) => !site.viaReexport)) continue;

        if (dynamic) {
          skips.push({
            rule: 'dead-export',
            reason: 'dynamic-access',
            message: MESSAGES.skipDynamicImport(exp.exportedName),
            path: exp.exportedName,
            location: exp.loc,
          });
          continue;
        }

        findings.push({
          rule: 'dead-export',
          severity,
          message: MESSAGES.deadExport(exp.exportedName),
          path: exp.exportedName,
          location: exp.loc,
          certainty: 'certain',
        });
      }
    }

    return { findings, skips };
  },
};
