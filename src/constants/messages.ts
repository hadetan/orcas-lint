/** User-facing message strings, centralized so output copy lives in one place. */
export const MESSAGES = {
  noIssues: 'No issues found.',
  partialRun: 'Analysis stopped early (budget exceeded); results are partial.',
  configError: (detail: string): string => `Invalid Orcas configuration: ${detail}`,
} as const;
