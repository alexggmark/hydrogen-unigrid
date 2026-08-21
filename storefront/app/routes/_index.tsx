import type {LinksFunction} from 'react-router';
import {useLoaderData} from 'react-router';
import type {Route} from './+types/_index';
import {Block, Grid, deriveAll} from '@unigrid/blocks';
import {DEV, gridDevLinks} from '~/blocks/grid-dev';
import {loadLayout, loadPalette} from '~/lib/layout';
import unigridStyles from '@unigrid/blocks/unigrid.css?url';
import demoStyles from '~/styles/unigrid-demo.css?url';

export const meta: Route.MetaFunction = () => [{title: 'unigrid'}];

export const handle = {bare: true};

export const links: LinksFunction = () => [
  {rel: 'stylesheet', href: unigridStyles},
  {rel: 'stylesheet', href: demoStyles},
  ...gridDevLinks(),
];

export async function loader({context}: Route.LoaderArgs) {
  const [stored, palette] = await Promise.all([
    loadLayout(context.storefront, 'home'),
    loadPalette(context.storefront),
  ]);
  return {stored, palette};
}

export default function Home() {
  const {stored, palette} = useLoaderData<typeof loader>();

  if (!stored) {
    return (
      <div className="unigrid-demo">
        <Grid dev={DEV} palette={palette}>
          <Block
            block={{
              id: 'empty',
              at: {a: {col: 1, colSpan: 12, row: 1, rowSpan: 2}},
              fill: {},
              flex: {direction: 'column', justify: 'center', align: 'start', gap: 1},
              invert: false,
              children: [
                {
                  id: 'empty-h',
                  kind: 'headline',
                  level: 3,
                  value: 'No layout published for this page.',
                },
              ],
            }}
            at={{a: {col: 1, colSpan: 12, row: 1, rowSpan: 2}}}
          />
        </Grid>
      </div>
    );
  }

  const at = deriveAll(stored.layout);

  return (
    <div className="unigrid-demo">
      <Grid dev={DEV} palette={palette}>
        {stored.layout.blocks.map((block) => {
          const placement = at.get(block.id);
          return placement ? (
            <Block key={block.id} block={block} at={placement} />
          ) : null;
        })}
      </Grid>
    </div>
  );
}
