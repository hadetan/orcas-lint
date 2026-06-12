import { describe, expect, it } from 'vitest';
import { createBudget } from '../../src/pod/budget';

describe('budget', () => {
  it('makes cyclic traversal terminate via the visited-set', () => {
    const budget = createBudget();
    const graph: Record<string, string[]> = { a: ['b'], b: ['a'] };
    const order: string[] = [];
    const walk = (node: string): void => {
      if (budget.seen(node)) return;
      order.push(node);
      for (const next of graph[node] ?? []) walk(next);
    };
    walk('a');
    expect(order).toEqual(['a', 'b']);
  });

  it('honors the interprocedural depth limit', () => {
    const budget = createBudget({ depthLimit: 2 });
    expect(budget.enter()).toBe(true);
    expect(budget.enter()).toBe(true);
    expect(budget.enter()).toBe(false);
    budget.exit();
    expect(budget.enter()).toBe(true);
  });

  it('reports time exceeded using an injected clock', () => {
    let now = 1000;
    const budget = createBudget({ maxTimeMs: 100, clock: () => now });
    expect(budget.timeExceeded()).toBe(false);
    now = 1101;
    expect(budget.timeExceeded()).toBe(true);
  });

  it('treats maxTimeMs <= 0 as unlimited', () => {
    let now = 0;
    const budget = createBudget({ maxTimeMs: 0, clock: () => now });
    now = 10_000_000;
    expect(budget.timeExceeded()).toBe(false);
  });
});
