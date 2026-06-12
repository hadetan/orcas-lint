import type { RuleId } from '../types';

export const RULE_IDS = [
  'dead-import',
  'dead-export',
  'dead-file',
  'unused-dependency',
  'unlisted-dependency',
  'dead-property',
  'dead-return',
  'dead-mutation',
] as const satisfies readonly RuleId[];

export interface RuleMeta {
  id: RuleId;
  title: string;
  /** Reachability rules ride on Sonar; value-flow rules ride on Atlas. */
  family: 'reachability' | 'value-flow';
}

export const RULE_META: Record<RuleId, RuleMeta> = {
  'dead-import': { id: 'dead-import', title: 'Dead import', family: 'reachability' },
  'dead-export': { id: 'dead-export', title: 'Unused export', family: 'reachability' },
  'dead-file': { id: 'dead-file', title: 'Unused file', family: 'reachability' },
  'unused-dependency': {
    id: 'unused-dependency',
    title: 'Unused dependency',
    family: 'reachability',
  },
  'unlisted-dependency': {
    id: 'unlisted-dependency',
    title: 'Unlisted dependency',
    family: 'reachability',
  },
  'dead-property': { id: 'dead-property', title: 'Unused property', family: 'value-flow' },
  'dead-return': { id: 'dead-return', title: 'Discarded return value', family: 'value-flow' },
  'dead-mutation': { id: 'dead-mutation', title: 'Dead mutation', family: 'value-flow' },
};
