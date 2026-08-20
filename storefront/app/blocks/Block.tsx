import type {CSSProperties, ReactNode} from 'react';
import {placementVars, type Placement} from './placement';

// closed union, not generic polymorphism: blocks are furniture, not a library
type BlockTag =
  'div' | 'header' | 'footer' | 'section' | 'article' | 'aside' | 'figure';

export type BlockProps = {
  at: Placement;
  as?: BlockTag;
  className?: string;
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
