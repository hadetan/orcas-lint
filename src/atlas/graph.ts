import type { AtlasEdge } from './edge';
import type { AtlasNode } from './node';

/**
 * The value graph: a store of value, symbol, and access-path nodes connected by
 * `defines`, `reads`, `aliases`, and `escapes` edges. Hunters query it to decide
 * whether a value is ever consumed.
 */
export interface Atlas {
  /** Adds a node, replacing any existing node with the same id. */
  addNode(node: AtlasNode): void;
  /** Adds an edge between two nodes. */
  addEdge(edge: AtlasEdge): void;
  /** Returns all nodes in the graph. */
  nodes(): AtlasNode[];
  /** Returns all edges in the graph. */
  edges(): AtlasEdge[];
}

/** Creates an empty {@link Atlas}. */
export function createAtlas(): Atlas {
  const nodes = new Map<string, AtlasNode>();
  const edges: AtlasEdge[] = [];

  return {
    addNode(node) {
      nodes.set(node.id, node);
    },
    addEdge(edge) {
      edges.push(edge);
    },
    nodes() {
      return [...nodes.values()];
    },
    edges() {
      return edges.slice();
    },
  };
}
