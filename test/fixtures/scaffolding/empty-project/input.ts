// A small, self-contained module that proves the fixture harness works.
// It references nothing outside itself (hermetic).

export function add(a: number, b: number): number {
  return a + b;
}

export const TITLE = 'scaffolding fixture';
