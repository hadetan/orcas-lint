/** User-facing message strings, centralized so output copy lives in one place. */
export const MESSAGES = {
  noIssues: 'No issues found.',
  partialRun: 'Analysis stopped early (budget exceeded); results are partial.',
  configError: (detail: string): string => `Invalid Orcas configuration: ${detail}`,
  deadImport: (name: string): string => `'${name}' is imported but never used`,
  deadExport: (name: string): string => `'${name}' is exported but never used`,
  deadFile: (file: string): string => `'${file}' is unreachable from any entry point`,
  skipReferencesBudget: (name: string): string =>
    `could not resolve references for '${name}' within the analysis budget`,
  skipDynamicImport: (name: string): string =>
    `'${name}' may be consumed by a non-literal dynamic import`,
  skipDynamicFile: (file: string): string =>
    `'${file}' may be loaded by a non-literal dynamic import in reachable code`,
  skipReexportBoundary: (name: string): string =>
    `'${name}' is re-exported to a target outside the analyzed project`,
  unusedDependency: (pkg: string): string =>
    `'${pkg}' is declared in package.json but never imported`,
  unlistedDependency: (pkg: string): string =>
    `'${pkg}' is imported but not listed in package.json`,
} as const;
