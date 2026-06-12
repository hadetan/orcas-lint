import type { Finding, Skip } from '../types';
import type { Hunter, HunterContext } from './base';

export interface RegistryRun {
  findings: Finding[];
  skips: Skip[];
  huntersRun: number;
}

export interface Registry {
  register(hunter: Hunter): void;
  list(): Hunter[];
  run(ctx: HunterContext): Promise<RegistryRun>;
}

/** Holds the enabled Hunters and invokes them uniformly. */
export function createRegistry(initial: Hunter[] = []): Registry {
  const hunters = new Map<string, Hunter>();
  for (const hunter of initial) hunters.set(hunter.id, hunter);

  return {
    register(hunter) {
      hunters.set(hunter.id, hunter);
    },
    list() {
      return [...hunters.values()];
    },
    async run(ctx) {
      const findings: Finding[] = [];
      const skips: Skip[] = [];
      let huntersRun = 0;

      for (const hunter of hunters.values()) {
        if (ctx.config.rules[hunter.rule] === 'off') continue;
        if (ctx.budget.timeExceeded()) break;
        const result = await hunter.run(ctx);
        findings.push(...result.findings);
        skips.push(...result.skips);
        huntersRun += 1;
      }

      return { findings, skips, huntersRun };
    },
  };
}
