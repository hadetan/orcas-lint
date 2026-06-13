import { MESSAGES } from '../constants';
import type { Finding, Skip } from '../types';
import type { Hunter, HunterContext, HunterResult } from './base';

/**
 * Hunter 1, dead imports. Reports an imported binding with zero references in
 * its declaring module. Side-effect imports are never flagged; type-only and JSX
 * usages already count as references. When references could not be resolved
 * within budget, records a skip instead of a finding.
 */
export const deadImports: Hunter = {
  id: 'dead-import',
  rule: 'dead-import',
  run(ctx: HunterContext): HunterResult {
    const findings: Finding[] = [];
    const skips: Skip[] = [];
    const severity = ctx.config.rules['dead-import'];

    for (const file of ctx.sonar.files()) {
      if (ctx.sonar.isTest(file)) continue;
      const mod = ctx.sonar.module(file);
      if (!mod) continue;
      for (const imp of mod.imports) {
        if (imp.kind === 'side-effect') continue;
        if (imp.references > 0) {
          if (imp.kind === 'cjs-namespace') {
            skips.push({
              rule: 'dead-import',
              reason: 'cjs-whole-require',
              message: MESSAGES.skipCjsWholeRequire(imp.localName),
              path: imp.localName,
              location: imp.loc,
            });
          }
          continue;
        }

        if (ctx.budget.timeExceeded()) {
          skips.push({
            rule: 'dead-import',
            reason: 'budget-exceeded',
            message: MESSAGES.skipReferencesBudget(imp.localName),
            path: imp.localName,
            location: imp.loc,
          });
          continue;
        }

        findings.push({
          rule: 'dead-import',
          severity,
          message: MESSAGES.deadImport(imp.localName),
          path: imp.localName,
          location: imp.loc,
          certainty: 'certain',
        });
      }
    }

    return { findings, skips };
  },
};
