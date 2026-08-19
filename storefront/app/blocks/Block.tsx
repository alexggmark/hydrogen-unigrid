import type {CSSProperties, ReactNode} from 'react';
import {placementVars, type Placement} from './placement';

// closed union, not generic polymorphism: blocks are furniture, not a library
type BlockTag =
  'div' | 'header' | 'footer' | 'section' | 'article' | 'aside' | 'figure';

export type BlockProps = {
  at: Placement;
  as?: BlockTag;
  className?: string;
  // marks the block as text, whose height the resolver measures rather than trusts
  text?: boolean;
  // editor hooks. the block stays dumb — selection is decided above it
  blockId?: string;
  selected?: boolean;
  children?: ReactNode;
};

export function Block({
  at,
  as: Tag = 'div',
  className,
  text,
  blockId,
  selected,
  children,
}: BlockProps) {
  return (
    <Tag
      className={className ? `u-block ${className}` : 'u-block'}
      style={placementVars(at) as CSSProperties}
      data-text={text ? '' : undefined}
      data-block={blockId}
      data-selected={selected ? '' : undefined}
    >
      {children}
    </Tag>
  );
}
