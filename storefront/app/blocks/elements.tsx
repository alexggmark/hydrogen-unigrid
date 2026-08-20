import type {CSSProperties} from 'react';
import {isGroup, type Element, type Flex, type Node} from '@unigrid/core';

export const flexVars = (f: Flex): CSSProperties =>
  ({
    '--fd': f.direction,
    '--jc': f.justify === 'between' ? 'space-between' : `flex-${f.justify}`,
    '--ai': f.align === 'stretch' ? 'stretch' : `flex-${f.align}`,
    '--gap': f.gap,
  }) as CSSProperties;

const HEADINGS = ['h1', 'h2', 'h3', 'h4', 'h5'] as const;

function Leaf({node}: {node: Element}) {
  switch (node.kind) {
    case 'headline': {
      const Tag = HEADINGS[node.level - 1] ?? 'h2';
      return <Tag className={`u-hl u-hl-${node.level}`}>{node.value}</Tag>;
    }
    case 'text':
      return <p className={`u-text u-text-${node.size}`}>{node.value}</p>;
    case 'richText':
      // newline-separated paragraphs until rich text becomes its own metaobject.
      // whitespace-pre-line does the split in css, so there are no keys to invent
      // for lines that have no identity of their own.
      return (
        <p className={`u-text u-text-${node.size} u-lines`}>{node.value}</p>
      );
    case 'button':
      return (
        <span className="u-btn" data-variant={node.variant}>
          {node.label}
        </span>
      );
  }
}

export function Nodes({nodes}: {nodes: readonly Node[]}) {
  return (
    <>
      {nodes.map((node) =>
        isGroup(node) ? (
          <div
            key={node.id}
            className="u-flow u-group"
            data-node={node.id}
            style={flexVars(node.flex)}
          >
            <Nodes nodes={node.children} />
          </div>
        ) : (
          <div key={node.id} className="u-el" data-node={node.id}>
            <Leaf node={node} />
          </div>
        ),
      )}
    </>
  );
}
