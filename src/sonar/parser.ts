import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Project, ts, type Identifier, type Node, type SourceFile } from 'ts-morph';
import type { SourceLocation } from '../types';
import type { ExportRecord, ImportBinding } from './model';

/** An import binding before its specifier has been resolved. */
export type RawImport = Omit<ImportBinding, 'resolvedFile'>;
/** An export record before its re-export target has been resolved. */
export type RawExport = Omit<ExportRecord, 'resolvedReexport'>;

/**
 * Create a ts-morph project for `cwd`. Uses the project's `tsconfig.json` when
 * present. Files are added explicitly by the caller.
 */
export function createProject(cwd: string): Project {
  const tsConfigFilePath = join(cwd, 'tsconfig.json');
  const hasTsconfig = existsSync(tsConfigFilePath);
  return new Project({
    ...(hasTsconfig ? { tsConfigFilePath } : {}),
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      allowJs: true,
      noEmit: true,
      ...(hasTsconfig
        ? {}
        : {
            jsx: ts.JsxEmit.Preserve,
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
            moduleResolution: ts.ModuleResolutionKind.Bundler,
          }),
    },
  });
}

/**
 * The import identifiers that, when JSX is present, must be treated as used,
 * the JSX factory roots. Under the *classic* runtime JSX desugars to
 * `React.createElement`, so that import is used implicitly. Under the
 * *automatic* runtime no factory import is needed, so the set is empty, and a
 * stray `import React` is then correctly reportable.
 */
export function jsxFactoryRoots(options: ts.CompilerOptions): Set<string> {
  const jsx = options.jsx;
  const automatic = jsx === ts.JsxEmit.ReactJSX || jsx === ts.JsxEmit.ReactJSXDev;
  if (automatic) return new Set();
  const roots = new Set<string>(['React']);
  if (options.jsxFactory) roots.add(options.jsxFactory.split('.')[0] ?? 'React');
  if (options.jsxFragmentFactory) roots.add(options.jsxFragmentFactory.split('.')[0] ?? 'React');
  return roots;
}

function hasJsx(sf: SourceFile): boolean {
  return (
    sf.getFirstDescendantByKind(ts.SyntaxKind.JsxElement) !== undefined ||
    sf.getFirstDescendantByKind(ts.SyntaxKind.JsxSelfClosingElement) !== undefined ||
    sf.getFirstDescendantByKind(ts.SyntaxKind.JsxFragment) !== undefined
  );
}

function locAt(sf: SourceFile, relFile: string, pos: number): SourceLocation {
  const { line, column } = sf.getLineAndColumnAtPos(pos);
  return { file: relFile, line, column };
}

function locOf(sf: SourceFile, relFile: string, node: Node): SourceLocation {
  return locAt(sf, relFile, node.getStart());
}

/**
 * Count in-module usages of an import binding, excluding the binding site itself.
 * Returns 1 when references cannot be determined, biasing toward "used" so a dead
 * import is never wrongly flagged.
 */
function countReferences(nameNode: Identifier, declStart: number, declEnd: number): number {
  let refs: Node[];
  try {
    refs = nameNode.findReferencesAsNodes();
  } catch {
    return 1;
  }
  const file = nameNode.getSourceFile();
  let count = 0;
  for (const r of refs) {
    if (r.getSourceFile() !== file) continue;
    const start = r.getStart();
    if (start >= declStart && start < declEnd) continue;
    count += 1;
  }
  return count;
}

const NO_FACTORIES: ReadonlySet<string> = new Set();

/**
 * Extract every import binding from a module, with in-module reference counts.
 * When the module contains JSX, an import whose local name is a JSX factory root
 * is treated as used even with no explicit reference.
 * See {@link jsxFactoryRoots}.
 */
export function extractImports(
  sf: SourceFile,
  relFile: string,
  jsxFactories: ReadonlySet<string> = NO_FACTORIES,
): RawImport[] {
  const out: RawImport[] = [];
  const jsx = jsxFactories.size > 0 && hasJsx(sf);
  const refsFor = (node: Identifier, name: string, declStart: number, declEnd: number): number => {
    const count = countReferences(node, declStart, declEnd);
    return jsx && jsxFactories.has(name) ? Math.max(count, 1) : count;
  };

  for (const decl of sf.getImportDeclarations()) {
    const specifier = decl.getModuleSpecifierValue();
    const declTypeOnly = decl.isTypeOnly();
    const declStart = decl.getStart();
    const declEnd = decl.getEnd();

    const clause = decl.getImportClause();
    if (!clause) {
      out.push({
        localName: '',
        specifier,
        kind: 'side-effect',
        isTypeOnly: false,
        references: 0,
        loc: locOf(sf, relFile, decl),
      });
      continue;
    }

    const def = decl.getDefaultImport();
    if (def) {
      out.push({
        localName: def.getText(),
        specifier,
        kind: 'default',
        importedName: 'default',
        isTypeOnly: declTypeOnly,
        references: refsFor(def, def.getText(), declStart, declEnd),
        loc: locOf(sf, relFile, def),
      });
    }

    const ns = decl.getNamespaceImport();
    if (ns) {
      out.push({
        localName: ns.getText(),
        specifier,
        kind: 'namespace',
        isTypeOnly: declTypeOnly,
        references: refsFor(ns, ns.getText(), declStart, declEnd),
        loc: locOf(sf, relFile, ns),
      });
    }

    for (const spec of decl.getNamedImports()) {
      const nameNode = spec.getNameNode();
      const local = spec.getAliasNode() ?? nameNode;
      const localId = local.asKind(ts.SyntaxKind.Identifier);
      out.push({
        localName: local.getText(),
        specifier,
        kind: 'named',
        importedName: nameNode.getText(),
        isTypeOnly: declTypeOnly || spec.isTypeOnly(),
        references: localId ? refsFor(localId, local.getText(), declStart, declEnd) : 1,
        loc: locOf(sf, relFile, local),
      });
    }
  }
  return out;
}

interface ExportableLike {
  hasExportKeyword(): boolean;
  isDefaultExport(): boolean;
  getName(): string | undefined;
  getNameNode(): Node | undefined;
  getStart(): number;
}

function pushExportable(
  sf: SourceFile,
  relFile: string,
  node: ExportableLike,
  isTypeOnly: boolean,
  out: RawExport[],
): void {
  if (!node.hasExportKeyword()) return;
  const pos = node.getNameNode()?.getStart() ?? node.getStart();
  if (node.isDefaultExport()) {
    out.push({
      exportedName: 'default',
      localName: node.getName(),
      kind: 'default',
      isTypeOnly,
      loc: locAt(sf, relFile, pos),
    });
    return;
  }
  const name = node.getName();
  if (!name) return;
  out.push({ exportedName: name, localName: name, kind: 'named', isTypeOnly, loc: locAt(sf, relFile, pos) });
}

/** Extract every export a module declares, distinguishing local exports from re-exports. */
export function extractExports(sf: SourceFile, relFile: string): RawExport[] {
  const out: RawExport[] = [];

  for (const decl of sf.getExportDeclarations()) {
    const from = decl.getModuleSpecifierValue();
    const declTypeOnly = decl.isTypeOnly();
    const nsExport = decl.getNamespaceExport();
    const named = decl.getNamedExports();

    if (from && named.length === 0 && !nsExport) {
      out.push({
        exportedName: '*',
        kind: 'star-reexport',
        reexportFrom: from,
        isTypeOnly: declTypeOnly,
        loc: locOf(sf, relFile, decl),
      });
      continue;
    }
    if (from && nsExport) {
      out.push({
        exportedName: nsExport.getName(),
        localName: '*',
        kind: 'star-reexport',
        reexportFrom: from,
        isTypeOnly: declTypeOnly,
        loc: locOf(sf, relFile, nsExport),
      });
      continue;
    }
    for (const spec of named) {
      const name = spec.getNameNode().getText();
      const alias = spec.getAliasNode()?.getText();
      out.push({
        exportedName: alias ?? name,
        localName: name,
        kind: from ? 'named-reexport' : 'named',
        ...(from ? { reexportFrom: from } : {}),
        isTypeOnly: declTypeOnly || spec.isTypeOnly(),
        loc: locOf(sf, relFile, spec.getNameNode()),
      });
    }
  }

  for (const ea of sf.getExportAssignments()) {
    if (ea.isExportEquals()) continue;
    out.push({ exportedName: 'default', kind: 'default', isTypeOnly: false, loc: locOf(sf, relFile, ea) });
  }

  for (const vs of sf.getVariableStatements()) {
    if (!vs.hasExportKeyword()) continue;
    for (const d of vs.getDeclarations()) {
      const name = d.getName();
      if (!name) continue;
      out.push({
        exportedName: name,
        localName: name,
        kind: 'named',
        isTypeOnly: false,
        loc: locOf(sf, relFile, d.getNameNode()),
      });
    }
  }
  for (const fn of sf.getFunctions()) pushExportable(sf, relFile, fn, false, out);
  for (const cls of sf.getClasses()) pushExportable(sf, relFile, cls, false, out);
  for (const en of sf.getEnums()) pushExportable(sf, relFile, en, false, out);
  for (const it of sf.getInterfaces()) pushExportable(sf, relFile, it, true, out);
  for (const ta of sf.getTypeAliases()) pushExportable(sf, relFile, ta, true, out);

  return out;
}

/** A CJS require call before its specifier has been resolved. */
type RawRequire = { specifier: string; loc: SourceLocation };

/**
 * Extract every `require('literal')` call from a module. Only calls where the
 * callee is the bare identifier `require`, not `require.resolve` or similar,
 * and the argument is a string literal are captured. Dynamic `require(variable)`
 * calls are silently skipped.
 */
export function extractRequires(sf: SourceFile, relFile: string): RawRequire[] {
  const out: RawRequire[] = [];
  for (const call of sf.getDescendantsOfKind(ts.SyntaxKind.CallExpression)) {
    const expr = call.getExpression();
    if (expr.getKind() !== ts.SyntaxKind.Identifier || expr.getText() !== 'require') continue;
    const args = call.getArguments();
    const arg = args[0];
    if (!arg) continue;
    const literal =
      arg.asKind(ts.SyntaxKind.StringLiteral) ??
      arg.asKind(ts.SyntaxKind.NoSubstitutionTemplateLiteral);
    if (!literal) continue;
    out.push({ specifier: literal.getLiteralValue(), loc: locAt(sf, relFile, call.getStart()) });
  }
  return out;
}

/**
 * Extract CJS require bindings from top-level variable declarations.
 * `const { foo } = require('./x')` → one `cjs-named` binding per destructured name.
 * `const utils = require('./x')` → one `cjs-namespace` binding.
 * Dynamic require, non-literal specifier, or non-variable results yield no bindings.
 */
export function extractCjsBindings(sf: SourceFile, relFile: string): RawImport[] {
  const out: RawImport[] = [];

  for (const varStmt of sf.getVariableStatements()) {
    for (const decl of varStmt.getDeclarations()) {
      const init = decl.getInitializer();
      if (!init || init.getKind() !== ts.SyntaxKind.CallExpression) continue;
      const call = init.asKind(ts.SyntaxKind.CallExpression);
      if (!call) continue;
      const expr = call.getExpression();
      if (expr.getKind() !== ts.SyntaxKind.Identifier || expr.getText() !== 'require') continue;

      const args = call.getArguments();
      const arg = args[0];
      if (!arg) continue;
      const literal =
        arg.asKind(ts.SyntaxKind.StringLiteral) ??
        arg.asKind(ts.SyntaxKind.NoSubstitutionTemplateLiteral);
      if (!literal) continue;

      const specifier = literal.getLiteralValue();
      const nameNode = decl.getNameNode();
      const declStart = decl.getStart();
      const declEnd = decl.getEnd();

      if (nameNode.getKind() === ts.SyntaxKind.ObjectBindingPattern) {
        const pattern = nameNode.asKind(ts.SyntaxKind.ObjectBindingPattern);
        if (!pattern) continue;
        for (const element of pattern.getElements()) {
          const localNameNode = element.getNameNode();
          if (localNameNode.getKind() !== ts.SyntaxKind.Identifier) continue;
          const localId = localNameNode.asKind(ts.SyntaxKind.Identifier);
          if (!localId) continue;
          const propNameNode = element.getPropertyNameNode();
          let importedName: string;
          if (!propNameNode) {
            importedName = localId.getText();
          } else if (propNameNode.getKind() === ts.SyntaxKind.Identifier) {
            importedName = propNameNode.getText();
          } else if (propNameNode.getKind() === ts.SyntaxKind.StringLiteral) {
            importedName = propNameNode.asKind(ts.SyntaxKind.StringLiteral)!.getLiteralValue();
          } else {
            continue;
          }
          out.push({
            localName: localId.getText(),
            specifier,
            kind: 'cjs-named',
            importedName,
            isTypeOnly: false,
            references: countReferences(localId, declStart, declEnd),
            loc: locOf(sf, relFile, element),
          });
        }
      } else if (nameNode.getKind() === ts.SyntaxKind.Identifier) {
        const localId = nameNode.asKind(ts.SyntaxKind.Identifier);
        if (!localId) continue;
        out.push({
          localName: localId.getText(),
          specifier,
          kind: 'cjs-namespace',
          isTypeOnly: false,
          references: countReferences(localId, declStart, declEnd),
          loc: locOf(sf, relFile, localId),
        });
      }
    }
  }

  return out;
}

/**
 * Extract CJS named exports from top-level assignment statements.
 * `module.exports = { alpha, beta }` → one `cjs-named` record per property key.
 * `exports.gamma = value` → one `cjs-named` record.
 * Non-literal `module.exports` and computed keys are silently skipped.
 * `module.exports.foo = value` is NOT handled.
 */
export function extractCjsExports(sf: SourceFile, relFile: string): RawExport[] {
  const out: RawExport[] = [];

  for (const stmt of sf.getStatements()) {
    if (stmt.getKind() !== ts.SyntaxKind.ExpressionStatement) continue;
    const exprStmt = stmt.asKind(ts.SyntaxKind.ExpressionStatement);
    if (!exprStmt) continue;
    const expr = exprStmt.getExpression();
    if (expr.getKind() !== ts.SyntaxKind.BinaryExpression) continue;
    const binary = expr.asKind(ts.SyntaxKind.BinaryExpression);
    if (!binary) continue;
    if (binary.getOperatorToken().getKind() !== ts.SyntaxKind.EqualsToken) continue;

    const lhs = binary.getLeft();
    if (lhs.getKind() !== ts.SyntaxKind.PropertyAccessExpression) continue;
    const propAccess = lhs.asKind(ts.SyntaxKind.PropertyAccessExpression);
    if (!propAccess) continue;
    const objText = propAccess.getExpression().getText();
    const exportedName = propAccess.getName();

    if (objText === 'module' && exportedName === 'exports') {
      const rhs = binary.getRight();
      if (rhs.getKind() !== ts.SyntaxKind.ObjectLiteralExpression) continue;
      const objLit = rhs.asKind(ts.SyntaxKind.ObjectLiteralExpression);
      if (!objLit) continue;
      for (const prop of objLit.getProperties()) {
        if (prop.getKind() === ts.SyntaxKind.PropertyAssignment) {
          const pa = prop.asKind(ts.SyntaxKind.PropertyAssignment);
          if (!pa) continue;
          const name = pa.getName();
          if (name) {
            out.push({
              exportedName: name,
              localName: name,
              kind: 'cjs-named',
              isTypeOnly: false,
              loc: locOf(sf, relFile, pa.getNameNode()),
            });
          }
        } else if (prop.getKind() === ts.SyntaxKind.ShorthandPropertyAssignment) {
          const spa = prop.asKind(ts.SyntaxKind.ShorthandPropertyAssignment);
          if (!spa) continue;
          const name = spa.getName();
          out.push({
            exportedName: name,
            localName: name,
            kind: 'cjs-named',
            isTypeOnly: false,
            loc: locOf(sf, relFile, spa.getNameNode()),
          });
        }
      }
    } else if (objText === 'exports') {
      out.push({
        exportedName,
        localName: exportedName,
        kind: 'cjs-named',
        isTypeOnly: false,
        loc: locOf(sf, relFile, propAccess.getNameNode()),
      });
    }
  }

  return out;
}

/** Whether the module performs a dynamic `import()` with a non-literal specifier. */
export function detectDynamicImport(sf: SourceFile): boolean {
  for (const call of sf.getDescendantsOfKind(ts.SyntaxKind.CallExpression)) {
    if (call.getExpression().getKind() !== ts.SyntaxKind.ImportKeyword) continue;
    const arg = call.getArguments()[0];
    if (!arg) return true;
    const literal =
      arg.asKind(ts.SyntaxKind.StringLiteral) ??
      arg.asKind(ts.SyntaxKind.NoSubstitutionTemplateLiteral);
    if (!literal) return true;
  }
  return false;
}
