import type {ReactNode} from 'react';
import {GridDev} from './GridDev';

// frame and grid are separate elements on purpose — see unigrid.css.
export function Grid({children}: {children?: ReactNode}) {
  return (
    <div className="frame">
      <div className="unigrid">
        {import.meta.env.DEV ? <GridDev /> : null}
        {children}
      </div>
    </div>
  );
}
