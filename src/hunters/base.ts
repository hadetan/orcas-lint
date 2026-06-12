import type { Budget } from '../pod/budget';
import type { Echo } from '../echo';
import type { Finding, OrcasConfig, RuleId, Skip } from '../types';

/**
 * Read-only context handed to every Hunter. Reachability Hunters read the file
 * list and module graph; value-flow Hunters additionally read the value graph.
 * A Hunter must not mutate anything it receives here.
 */
export interface HunterContext {
  readonly cwd: string;
  readonly files: readonly string[];
  readonly config: OrcasConfig;
  readonly budget: Budget;
  readonly echo: Echo;
}

export interface HunterResult {
  findings: Finding[];
  skips: Skip[];
}

/** The single contract every tracker implements. One Hunter owns one rule. */
export interface Hunter {
  readonly id: string;
  readonly rule: RuleId;
  run(ctx: HunterContext): HunterResult | Promise<HunterResult>;
}
