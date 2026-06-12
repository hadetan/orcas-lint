import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ts } from 'ts-morph';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createProject, extractExports, extractImports, jsxFactoryRoots } from '../../src/sonar/parser';

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'orcas-parse-'));
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

function source(name: string, code: string) {
  // A fresh project per call keeps each parse hermetic.
  return createProject(dir).createSourceFile(name, code, { overwrite: true });
}

describe('sonar parser — imports', () => {
  it('extracts named, default, and namespace bindings with their imported names', () => {
    const sf = source('a.ts', `import d, { x, y as z } from './m'\nimport * as ns from './n'\n`);
    const imports = extractImports(sf, 'a.ts');
    expect(imports.map((i) => [i.localName, i.kind, i.importedName])).toEqual([
      ['d', 'default', 'default'],
      ['x', 'named', 'x'],
      ['z', 'named', 'y'],
      ['ns', 'namespace', undefined],
    ]);
  });

  it('records a side-effect import as such, with no binding', () => {
    const imports = extractImports(source('a.ts', `import './styles.css'\n`), 'a.ts');
    expect(imports).toHaveLength(1);
    expect(imports[0]?.kind).toBe('side-effect');
  });

  it('counts a used import as referenced and an unused one as zero', () => {
    const sf = source('a.ts', `import { used, dead } from './m'\nconsole.log(used)\n`);
    const byName = new Map(extractImports(sf, 'a.ts').map((i) => [i.localName, i.references]));
    expect(byName.get('used')).toBeGreaterThanOrEqual(1);
    expect(byName.get('dead')).toBe(0);
  });

  it('counts a type-only usage as a reference', () => {
    const sf = source('a.ts', `import type { T } from './m'\nexport function f(x: T) {\n  return x\n}\n`);
    const t = extractImports(sf, 'a.ts').find((i) => i.localName === 'T');
    expect(t?.isTypeOnly).toBe(true);
    expect(t?.references).toBeGreaterThanOrEqual(1);
  });

  it('counts a JSX usage as a reference', () => {
    const sf = source('a.tsx', `import { Comp } from './m'\nexport const E = <Comp />\n`);
    expect(extractImports(sf, 'a.tsx').find((i) => i.localName === 'Comp')?.references).toBeGreaterThanOrEqual(
      1,
    );
  });
});

describe('sonar parser — exports', () => {
  it('extracts named, default, star, and named re-exports', () => {
    const sf = source(
      'a.ts',
      `export const a = 1\nexport default function d() {}\nexport * from './s'\nexport { z } from './w'\n`,
    );
    const kinds = extractExports(sf, 'a.ts').map((e) => `${e.kind}:${e.exportedName}`);
    expect(kinds).toContain('named:a');
    expect(kinds).toContain('default:default');
    expect(kinds).toContain('star-reexport:*');
    expect(kinds).toContain('named-reexport:z');
  });
});

describe('jsx factory roots (runtime-aware)', () => {
  it('treats React as a factory under the classic runtime', () => {
    expect(jsxFactoryRoots({ jsx: ts.JsxEmit.React }).has('React')).toBe(true);
  });

  it('has no factory under the automatic runtime, so a stray React import stays reportable', () => {
    expect(jsxFactoryRoots({ jsx: ts.JsxEmit.ReactJSX }).size).toBe(0);
  });

  it('includes a configured custom jsxFactory root', () => {
    expect(jsxFactoryRoots({ jsx: ts.JsxEmit.React, jsxFactory: 'h' }).has('h')).toBe(true);
  });
});
