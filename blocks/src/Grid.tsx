import type {ReactNode} from 'react';
import {GridDev} from './GridDev';
import {GridProbes} from './GridProbes';

// frame and grid are separate elements on purpose — see unigrid.css
export function Grid({
  children,
  probes,
  dev,
}: {
  children?: ReactNode;
  probes?: boolean;
  // the consumer decides, because a shared package cannot know whose build it is in
  dev?: boolean;
}) {
  return (
    <div className="u-frame">
      <div className="u-grid">
        {dev ? <GridDev /> : null}
        {probes || dev ? <GridProbes /> : null}
        {children}
      </div>
    </div>
  );
}
