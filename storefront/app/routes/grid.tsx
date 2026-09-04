import type {LinksFunction} from 'react-router';
import {useLoaderData} from 'react-router';
import type {Route} from './+types/grid';
import {Block, Grid, deriveAll} from '@unigrid/blocks';
import {DEV, gridDevLinks} from '~/blocks/grid-dev';
import {DEMO_COLLECTION, DEMO_MENU_LINKS, HARNESS} from '~/blocks/harness';
import unigridStyles from '@unigrid/blocks/unigrid.css?url';
import demoStyles from '~/styles/unigrid-demo.css?url';
import {loadLogo, loadMedia} from '~/lib/layout';

// read-only reference render. /editor is the same geometry with chrome on top.

export const handle = {bare: true};

export const links: LinksFunction = () => [
  {rel: 'stylesheet', href: unigridStyles},
  {rel: 'stylesheet', href: demoStyles},
  ...gridDevLinks(),
];

// the harness holds file references like a real layout, so the route resolves
// them the same way loadComposition does
export async function loader({context}: Route.LoaderArgs) {
  const [media, logo] = await Promise.all([
    loadMedia(context.storefront, [HARNESS]),
    loadLogo(context.storefront),
  ]);
  return {media, logo};
}

export default function GridHarness() {
  const {media, logo} = useLoaderData<typeof loader>();
  const at = deriveAll(HARNESS);

  return (
    <div className="unigrid-demo u-page">
      <div className="u-stack">
        <Grid
          dev={DEV}
          collection={DEMO_COLLECTION}
          media={media}
          menus={DEMO_MENU_LINKS}
          logo={logo}
        >
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
