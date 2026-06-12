export type AtlasEdgeKind = 'defines' | 'reads' | 'aliases' | 'escapes';

export interface AtlasEdge {
  from: string;
  to: string;
  kind: AtlasEdgeKind;
}
