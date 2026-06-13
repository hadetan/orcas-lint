import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ts } from 'ts-morph';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createProject,
  extractCjsBindings,
  extractCjsExports,
  extractExports,
  extractImports,
  jsxFactoryRoots,
} from '../../src/sonar/parser';

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

describe('sonar parser — CJS bindings (extractCjsBindings)', () => {
  it('extracts named bindings from destructured require', () => {
    const sf = source('a.ts', `const { foo, bar } = require('./utils')\n`);
    const bindings = extractCjsBindings(sf, 'a.ts');
    expect(bindings).toHaveLength(2);
    const names = bindings.map((b) => [b.localName, b.kind, b.importedName]);
    expect(names).toContainEqual(['foo', 'cjs-named', 'foo']);
    expect(names).toContainEqual(['bar', 'cjs-named', 'bar']);
    expect(bindings.every((b) => b.specifier === './utils')).toBe(true);
    expect(bindings.every((b) => b.isTypeOnly === false)).toBe(true);
  });

  it('handles renamed destructured bindings: { original: alias }', () => {
    const sf = source('a.ts', `const { alpha: a, beta } = require('./m')\nconsole.log(a, beta)\n`);
    const bindings = extractCjsBindings(sf, 'a.ts');
    const byLocal = new Map(bindings.map((b) => [b.localName, b]));
    expect(byLocal.get('a')?.importedName).toBe('alpha');
    expect(byLocal.get('beta')?.importedName).toBe('beta');
  });

  it('ref-counts a used destructured name as referenced and an unused one as zero', () => {
    const sf = source('a.ts', `const { used, dead } = require('./m')\nconsole.log(used)\n`);
    const bindings = extractCjsBindings(sf, 'a.ts');
    const byName = new Map(bindings.map((b) => [b.localName, b.references]));
    expect(byName.get('used')).toBeGreaterThanOrEqual(1);
    expect(byName.get('dead')).toBe(0);
  });

  it('extracts a whole-object require as cjs-namespace', () => {
    const sf = source('a.ts', `const utils = require('./utils')\nconsole.log(utils.x)\n`);
    const bindings = extractCjsBindings(sf, 'a.ts');
    expect(bindings).toHaveLength(1);
    expect(bindings[0]?.kind).toBe('cjs-namespace');
    expect(bindings[0]?.localName).toBe('utils');
    expect(bindings[0]?.references).toBeGreaterThanOrEqual(1);
  });

  it('produces no bindings for a dynamic require specifier', () => {
    const sf = source('a.ts', `const m = require(dynamicPath)\n`);
    expect(extractCjsBindings(sf, 'a.ts')).toHaveLength(0);
  });

  it('produces no bindings when the require result is discarded inline', () => {
    const sf = source('a.ts', `require('./side-effect')\n`);
    expect(extractCjsBindings(sf, 'a.ts')).toHaveLength(0);
  });
});

describe('sonar parser — CJS exports (extractCjsExports)', () => {
  it('extracts each key from module.exports = { ... } object literal', () => {
    const sf = source('a.ts', `const alpha = 1\nconst beta = 2\nmodule.exports = { alpha, beta }\n`);
    const exports = extractCjsExports(sf, 'a.ts');
    expect(exports).toHaveLength(2);
    const names = exports.map((e) => e.exportedName);
    expect(names).toContain('alpha');
    expect(names).toContain('beta');
    expect(exports.every((e) => e.kind === 'cjs-named')).toBe(true);
    expect(exports.every((e) => e.isTypeOnly === false)).toBe(true);
  });

  it('extracts exports.foo = value assignment', () => {
    const sf = source('a.ts', `exports.gamma = 42\n`);
    const exports = extractCjsExports(sf, 'a.ts');
    expect(exports).toHaveLength(1);
    expect(exports[0]?.exportedName).toBe('gamma');
    expect(exports[0]?.kind).toBe('cjs-named');
  });

  it('produces no exports for non-literal module.exports assignment', () => {
    const sf = source('a.ts', `module.exports = someVariable\n`);
    expect(extractCjsExports(sf, 'a.ts')).toHaveLength(0);
  });

  it('produces no exports for dynamic module.exports', () => {
    const sf = source('a.ts', `module.exports = getExports()\n`);
    expect(extractCjsExports(sf, 'a.ts')).toHaveLength(0);
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
