import { MESSAGES } from '../constants';
import type { Finding } from '../types';
import type { Hunter, HunterContext, HunterResult } from './base';
import { extractPackageName } from './dep-utils';

/**
 * Hunter 10, unlisted dependency. Reports every npm package statically imported
 * or required in source code that is absent from all package.json dep sections.
 * One finding per package at the first import/require site in stable file order.
 * Respects ignoreDependencies. When production mode is on, test-file imports are skipped.
 */
export const unlistedDependency: Hunter = {
  id: 'unlisted-dependency',
  rule: 'unlisted-dependency',
  run(ctx: HunterContext): HunterResult {
    const { config, sonar, manifest } = ctx;
    const severity = config.rules['unlisted-dependency'];
    if (severity === 'off') return { findings: [], skips: [] };

    const allDeclared = new Set([
      ...Object.keys(manifest.dependencies),
      ...Object.keys(manifest.devDependencies),
      ...Object.keys(manifest.peerDependencies),
      ...Object.keys(manifest.optionalDependencies),
    ]);

    const findings: Finding[] = [];
    const reported = new Set<string>();

    for (const file of sonar.files()) {
      if (config.production && sonar.isTest(file)) continue;
      const mod = sonar.module(file);
      if (!mod) continue;

      const check = (specifier: string, loc: { file: string; line: number; column: number }): void => {
        const pkg = extractPackageName(specifier);
        if (!pkg) return;
        if (allDeclared.has(pkg)) return;
        if (config.ignoreDependencies.includes(pkg)) return;
        if (reported.has(pkg)) return;
        reported.add(pkg);
        findings.push({
          rule: 'unlisted-dependency',
          severity,
          message: MESSAGES.unlistedDependency(pkg),
          path: pkg,
          location: loc,
          certainty: 'certain',
        });
      };

      for (const imp of mod.imports) check(imp.specifier, imp.loc);
      for (const req of mod.requires) check(req.specifier, req.loc);
    }

    return { findings, skips: [] };
  },
};
