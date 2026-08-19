import type {CSSProperties, ReactNode} from 'react';
import {placementVars, type Placement} from './placement';

// the tags a block is allowed to be. a closed union rather than generic
// polymorphism: blocks are page furniture, not a component library.
type BlockTag =
  'div' | 'header' | 'footer' | 'section' | 'article' | 'aside' | 'figure';

export type BlockProps = {
  at: Placement;
  as?: BlockTag;
  className?: string;
  // marks the block as text, whose height the resolver measures rather than trusts
  text?: boolean;
  children?: ReactNode;
};

export function Block({
  at,
  as: Tag = 'div',
  className,
  text,
  children,
}: BlockProps) {
  return (
    <Tag
      className={className ? `u-block ${className}` : 'u-block'}
      style={placementVars(at) as CSSProperties}
      data-text={text ? '' : undefined}
    >
      {children}
    </Tag>
  );
}
