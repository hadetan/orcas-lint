/** Directed graph of files connected by import/export edges. */
export interface ModuleGraph {
  addFile(file: string): void;
  addEdge(from: string, to: string): void;
  files(): string[];
  edgesFrom(file: string): string[];
}

export function createModuleGraph(): ModuleGraph {
  const files = new Set<string>();
  const edges = new Map<string, Set<string>>();

  return {
    addFile(file) {
      files.add(file);
    },
    addEdge(from, to) {
      files.add(from);
      files.add(to);
      let set = edges.get(from);
      if (!set) {
        set = new Set<string>();
        edges.set(from, set);
      }
      set.add(to);
    },
    files() {
      return [...files];
    },
    edgesFrom(file) {
      return [...(edges.get(file) ?? [])];
    },
  };
}
