/** Resolves module specifiers to absolute file paths. */
export interface Resolver {
  /**
   * Resolves `specifier` as imported from `from`.
   *
   * @returns The resolved absolute path, or `null` when it cannot be resolved.
   */
  resolve(specifier: string, from: string): string | null;
}

/** Creates a {@link Resolver}. The returned resolver leaves every specifier unresolved. */
export function createResolver(): Resolver {
  return { resolve: () => null };
}
