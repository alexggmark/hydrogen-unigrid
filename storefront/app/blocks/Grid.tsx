import type {ReactNode} from 'react';
import type {LinkDescriptor} from 'react-router';
import {GridDev} from './GridDev';
import {GridProbes} from './GridProbes';
import devStyles from '~/styles/unigrid-dev.css?url';

// a side-effect css import in a component never reaches the route's <link> tags
export const gridDevLinks = (): LinkDescriptor[] =>
  import.meta.env.DEV ? [{rel: 'stylesheet', href: devStyles}] : [];

// frame and grid are separate elements on purpose — see unigrid.css
export function Grid({
  children,
  probes,
}: {
  children?: ReactNode;
  probes?: boolean;
}) {
  return (
    <div className="u-frame">
      <div className="u-grid">
        {import.meta.env.DEV ? <GridDev /> : null}
        {probes || import.meta.env.DEV ? <GridProbes /> : null}
        {children}
      </div>
    </div>
  );
}
