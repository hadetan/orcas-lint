/** Severity a rule can be configured to. `off` means the rule never reports. */
export type Severity = 'off' | 'warn' | 'error';

/**
 * Whether the engine is sure about a result. Findings are always `certain`;
 * `uncertain` items become skips (visible only under `--debug`), never findings.
 */
export type Certainty = 'certain' | 'uncertain';

/** The canonical rule identifiers. (Nested-property cases 3–5 collapse into `dead-property`.) */
export type RuleId =
  | 'dead-import'
  | 'dead-export'
  | 'dead-file'
  | 'unused-dependency'
  | 'unlisted-dependency'
  | 'dead-property'
  | 'dead-return'
  | 'dead-mutation';

export type ReporterName = 'pretty' | 'json';
