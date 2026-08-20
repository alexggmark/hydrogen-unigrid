import type {CSSProperties, ReactNode} from 'react';
import {placementVars, type Placement} from './placement';

// closed union, not generic polymorphism: blocks are furniture, not a library.
// every block is the same box: the authored span is its size and content that
// does not fit is clipped. type decides content, never geometry.
type BlockTag =
  'div' | 'header' | 'footer' | 'section' | 'article' | 'aside' | 'figure';

export type BlockProps = {
  at: Placement;
  as?: BlockTag;
  className?: string;
  // editor hooks. the block stays dumb — selection is decided above it
  blockId?: string;
  selected?: boolean;
  children?: ReactNode;
};

export function Block({
  at,
  as: Tag = 'div',
  className,
  blockId,
  selected,
  children,
}: BlockProps) {
  return (
    <Tag
      className={className ? `u-block ${className}` : 'u-block'}
      style={placementVars(at) as CSSProperties}
      data-block={blockId}
      data-selected={selected ? '' : undefined}
    >
      {children}
    </Tag>
  );
}
