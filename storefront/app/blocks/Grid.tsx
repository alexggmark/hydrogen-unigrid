import type {ReactNode} from 'react';
import type {LinkDescriptor} from 'react-router';
import {GridDev} from './GridDev';
import devStyles from '~/styles/unigrid-dev.css?url';

// a route rendering <Grid> spreads this into its links export. a side-effect
// css import inside the component never reaches the route's <link> tags.
export const gridDevLinks = (): LinkDescriptor[] =>
  import.meta.env.DEV ? [{rel: 'stylesheet', href: devStyles}] : [];

// frame and grid are separate elements on purpose — see unigrid.css.
export function Grid({children}: {children?: ReactNode}) {
  return (
    <div className="u-frame">
      <div className="u-grid">
        {import.meta.env.DEV ? <GridDev /> : null}
        {children}
      </div>
    </div>
  );
}
