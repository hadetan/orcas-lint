/** A path into a structured value */
export type AccessPath = string;

export function joinPath(base: string, key: string): AccessPath {
  return base ? `${base}.${key}` : key;
}
