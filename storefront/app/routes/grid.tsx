import type {LinksFunction} from 'react-router';
import {Block, Grid, deriveAll} from '@unigrid/blocks';
import {DEV, gridDevLinks} from '~/blocks/grid-dev';
import {HARNESS} from '~/blocks/harness';
import unigridStyles from '@unigrid/blocks/unigrid.css?url';
import demoStyles from '~/styles/unigrid-demo.css?url';

// read-only reference render. /editor is the same geometry with chrome on top.

export const handle = {bare: true};

export const links: LinksFunction = () => [
  {rel: 'stylesheet', href: unigridStyles},
  {rel: 'stylesheet', href: demoStyles},
  ...gridDevLinks(),
];

export default function GridHarness() {
  const at = deriveAll(HARNESS);

  return (
    <div className="unigrid-demo u-page">
      <div className="u-stack">
        <Grid dev={DEV}>
          {HARNESS.blocks.map((block) => {
            const placement = at.get(block.id);
            if (!placement) return null;
            return <Block key={block.id} block={block} at={placement} />;
          })}
        </Grid>
      </div>
    </div>
  );
}
