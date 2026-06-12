export type AtlasNodeKind = 'symbol' | 'value' | 'access-path';

export interface AtlasNode {
  id: string;
  kind: AtlasNodeKind;
}
