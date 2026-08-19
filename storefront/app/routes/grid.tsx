import type {LinksFunction} from 'react-router';
import {Grid, gridDevLinks} from '~/blocks/Grid';
import {Block} from '~/blocks/Block';
import {CHROME, CONTENT} from '~/blocks/demo';
import {HARNESS} from '~/blocks/harness';
import {resolveAll} from '~/blocks/placement';
import unigridStyles from '~/styles/unigrid.css?url';
import demoStyles from '~/styles/unigrid-demo.css?url';

// read-only reference render. no measurements, so the resolver is identity here
// and what you see is the authored layout. /editor is where it gets driven.

export const handle = {bare: true};

export const links: LinksFunction = () => [
  {rel: 'stylesheet', href: unigridStyles},
  {rel: 'stylesheet', href: demoStyles},
  ...gridDevLinks(),
];

export default function GridHarness() {
  const at = resolveAll(HARNESS);

  return (
    <div className="unigrid-demo">
      <Grid>
        {HARNESS.blocks.map((block) => {
          const placement = at.get(block.id);
          const chrome = CHROME[block.id];
          if (!placement || !chrome) return null;
          return (
            <Block
              key={block.id}
              at={placement}
              as={chrome.as}
              className={chrome.className}
              text={block.type === 'text'}
            >
              {CONTENT[block.id]}
            </Block>
          );
        })}
      </Grid>
    </div>
  );
}
