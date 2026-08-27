// grid maths, block model, band derivation, serialisation, undo. zero deps

export const UNIGRID_CORE = 'unigrid-core' as const;

export {BANDS, COLUMNS, WIDEST, isBand, type Band} from './bands';
export {
  DEFAULT_FLEX,
  emptyBlock,
  DEFAULT_PALETTE,
  SLOTS,
  emptyLayout,
  isSlot,
  isGroup,
  type Block,
  type ButtonVariant,
  type Cell,
  type Colour,
  type Element,
  type ElementKind,
  type Fill,
  type Flex,
  type Group,
  type HeadingLevel,
  type Layout,
  type Media,
  type MenuDirection,
  type Palette,
  type Slot,
  type Node,
  type Placement,
  type TextAlign,
  type TextSize,
} from './types';
export {
  addNode,
  findNode,
  menuHandles,
  moveNode,
  patchBlock,
  patchNode,
  placeNode,
  removeNode,
  setFlex,
  type Found,
} from './content';
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
export {derive, cellFor, type Resolved} from './derive';
export {insertAfter} from './insert';
