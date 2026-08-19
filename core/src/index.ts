// grid maths, block model, resolver, serialisation, undo. zero deps

export const UNIGRID_CORE = 'unigrid-core' as const;

export {BANDS, COLUMNS, WIDEST, isBand, type Band} from './bands';
export {
  emptyLayout,
  type Block,
  type BlockType,
  type Cell,
  type ContentRef,
  type Layout,
  type Placement,
} from './types';
export {
  add,
  cellIn,
  findBlock,
  inBounds,
  isOverridden,
  overlaps,
  place,
  readingOrder,
  remove,
  resetToDerived,
  validSpan,
  type Invalid,
  type Result,
} from './layout';
export {encode, decode} from './serialise';
export {
  canRedo,
  canUndo,
  commit,
  history,
  redo,
  undo,
  LIMIT,
  type History,
} from './history';
export {
  resolve,
  resolveCells,
  pushes,
  ResolverDidNotConverge,
  type Measurements,
  type Resolved,
} from './resolve';
