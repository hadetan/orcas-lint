import { MESSAGES } from '../constants';
import type { Finding } from '../types';
import type { Hunter, HunterContext, HunterResult } from './base';
import { extractPackageName } from './dep-utils';

/**
 * Hunter 9, unused dependency. Reports every package declared in package.json
 * (across all dep sections) that no source file statically imports or requires.
 * One finding per package, located at package.json:1:1. Respects ignoreDependencies
 * and ignoreBinaries. When production mode is on, test-file imports do not count.
 */
export const unusedDependency: Hunter = {
  id: 'unused-dependency',
  rule: 'unused-dependency',
  run(ctx: HunterContext): HunterResult {
    const { config, sonar, manifest } = ctx;
    const severity = config.rules['unused-dependency'];
    if (severity === 'off') return { findings: [], skips: [] };

    const ignored = new Set([...config.ignoreDependencies, ...config.ignoreBinaries]);

    const allDeclared = new Set([
      ...Object.keys(manifest.dependencies),
      ...Object.keys(manifest.devDependencies),
      ...Object.keys(manifest.peerDependencies),
      ...Object.keys(manifest.optionalDependencies),
    ]);

    const usedPkgs = new Set<string>();
    for (const file of sonar.files()) {
      if (config.production && sonar.isTest(file)) continue;
      const mod = sonar.module(file);
      if (!mod) continue;
      for (const imp of mod.imports) {
        const pkg = extractPackageName(imp.specifier);
        if (pkg) usedPkgs.add(pkg);
      }
      for (const req of mod.requires) {
        const pkg = extractPackageName(req.specifier);
        if (pkg) usedPkgs.add(pkg);
      }
    }

    const findings: Finding[] = [];
    for (const pkg of [...allDeclared].sort()) {
      if (ignored.has(pkg)) continue;
      if (usedPkgs.has(pkg)) continue;
      findings.push({
        rule: 'unused-dependency',
        severity,
        message: MESSAGES.unusedDependency(pkg),
        path: pkg,
        location: { file: 'package.json', line: 1, column: 1 },
        certainty: 'certain',
      });
    }

    return { findings, skips: [] };
  },
};
