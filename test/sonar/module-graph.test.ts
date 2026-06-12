import { describe, expect, it } from 'vitest';
import { computeReachability } from '../../src/sonar/module-graph';
import { findImporters } from '../../src/sonar/symbols';
import type { ModuleInfo } from '../../src/sonar';

describe('module-graph reachability', () => {
  it('terminates on an import cycle and marks only reachable nodes', () => {
    const edges = new Map<string, string[]>([
      ['a.ts', ['b.ts']],
      ['b.ts', ['a.ts']],
      ['orphan.ts', []],
    ]);
    const reachable = computeReachability(new Set(['a.ts']), (f) => edges.get(f) ?? []);
    expect(reachable.has('a.ts')).toBe(true);
    expect(reachable.has('b.ts')).toBe(true);
    expect(reachable.has('orphan.ts')).toBe(false);
  });
});

describe('cross-module importers', () => {
  const modules: ModuleInfo[] = [
    {
      file: 'impl.ts',
      imports: [],
      exports: [
        { exportedName: 'x', localName: 'x', kind: 'named', isTypeOnly: false, loc: { file: 'impl.ts', line: 1, column: 1 } },
      ],
    },
    {
      file: 'barrel.ts',
      imports: [],
      exports: [
        {
          exportedName: 'x',
          localName: 'x',
          kind: 'named-reexport',
          reexportFrom: './impl',
          resolvedReexport: 'impl.ts',
          isTypeOnly: false,
          loc: { file: 'barrel.ts', line: 1, column: 1 },
        },
      ],
    },
    {
      file: 'user.ts',
      imports: [
        {
          localName: 'x',
          specifier: './impl',
          resolvedFile: 'impl.ts',
          kind: 'named',
          importedName: 'x',
          isTypeOnly: false,
          references: 1,
          loc: { file: 'user.ts', line: 1, column: 1 },
        },
      ],
      exports: [],
    },
  ];

  it('reports a direct importer', () => {
    const sites = findImporters(modules, 'impl.ts', 'x');
    expect(sites.some((s) => s.file === 'user.ts' && !s.viaReexport)).toBe(true);
  });

  it('reports a re-export site as an importer of the origin', () => {
    const sites = findImporters(modules, 'impl.ts', 'x');
    expect(sites.some((s) => s.file === 'barrel.ts' && s.viaReexport)).toBe(true);
  });
});
