import type { Certainty, RuleId, Severity } from './severity';

export interface SourceLocation {
  file: string;
  line: number;
  column: number;
}

/** A reported, certain result the user can act on. */
export interface Finding {
  rule: RuleId;
  severity: Severity;
  message: string;
  /** Optional access-path or symbol the finding refers to, such as `config.retry.backoff`. */
  path?: string;
  location: SourceLocation;
  certainty: Certainty;
}

/** Enumerated reasons the engine backed off rather than report. Surfaced via Echo. */
export type SkipReason =
  | 'container-spread'
  | 'container-serialized'
  | 'dynamic-access'
  | 'escapes-boundary'
  | 'beyond-depth-budget'
  | 'unanalyzable-construct'
  | 'unrecognized-config'
  | 'unresolved-specifier'
  | 'budget-exceeded';

/** Something the engine could not prove dead. Recorded, not reported unless `--debug`. */
export interface Skip {
  rule: RuleId;
  reason: SkipReason;
  message: string;
  path?: string;
  location: SourceLocation;
}
