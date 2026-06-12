import type { Budget } from '../pod/budget';
import type { Echo } from '../echo';
import type { Atlas } from '../atlas';
import type { SemanticModel } from '../sonar/model';
import type { Finding, OrcasConfig, RuleId, Skip } from '../types';

/**
 * Read-only context handed to every Hunter. Reachability Hunters read Sonar's
 * semantic model; value-flow Hunters additionally read the value graph.
 * A Hunter must not mutate anything it receives here.
 */
export interface HunterContext {
  readonly cwd: string;
  readonly files: readonly string[];
  readonly config: OrcasConfig;
  readonly budget: Budget;
  readonly echo: Echo;
  /** Sonar's read-only semantic model: imports, exports, resolution, reachability. */
  readonly sonar: SemanticModel;
  /** The value graph, present only when a value-flow rule is enabled. */
  readonly atlas?: Atlas;
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
