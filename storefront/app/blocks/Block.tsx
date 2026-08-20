import type {CSSProperties, ReactNode} from 'react';
import type {Block as BlockModel} from '@unigrid/core';
import {placementVars, type Placement} from './placement';
import {flexVars, Nodes} from './elements';

export type BlockProps = {
  block: BlockModel;
  at: Placement;
  blockId?: string;
  selected?: boolean;
  // editor overlays only. never part of the measured content.
  chrome?: ReactNode;
};

export function Block({block, at, blockId, selected, chrome}: BlockProps) {
  const {fill} = block;
  const style = {
    ...placementVars(at),
    ...(fill.color ? {'--fill': fill.color} : {}),
  } as CSSProperties;

  return (
    <div
      className="u-block"
      style={style}
      data-block={blockId}
      data-selected={selected ? '' : undefined}
      data-invert={block.invert ? '' : undefined}
    >
      {fill.media ? (
        fill.media.kind === 'video' ? (
          <video
            className="u-bg"
            src={fill.media.src}
            autoPlay
            muted
            loop
            playsInline
          />
        ) : (
          <img className="u-bg" src={fill.media.src} alt="" />
        )
      ) : null}
      {fill.overlay ? (
        <div
          className="u-bg u-tint"
          aria-hidden
          style={
            {
              '--tint': fill.overlay.color,
              '--tint-a': fill.overlay.opacity,
            } as CSSProperties
          }
        />
      ) : null}
      {/* the one measured element. everything else in here is background or chrome. */}
      <div className="u-flow" style={flexVars(block.flex)}>
        <Nodes nodes={block.children} />
      </div>
      {chrome}
    </div>
  );
}
