import type {LinksFunction} from 'react-router';
import {useLoaderData} from 'react-router';
import type {Route} from './+types/editor';
import {Editor} from '@unigrid/editor';
import {DEMO_COLLECTION, DEMO_MENUS, DEMO_PRODUCTS, HARNESS} from '~/blocks/harness';
import {DEV, gridDevLinks} from '~/blocks/grid-dev';
import radixStyles from '@radix-ui/themes/styles.css?url';
import unigridStyles from '@unigrid/blocks/unigrid.css?url';
import editorStyles from '@unigrid/editor/editor.css?url';
import {loadMedia} from '~/lib/layout';

// the playground. no onSave, so there is no path from here to a store.

export const handle = {bare: true};

export const links: LinksFunction = () => [
  {rel: 'stylesheet', href: radixStyles},
  {rel: 'stylesheet', href: unigridStyles},
  {rel: 'stylesheet', href: editorStyles},
  ...gridDevLinks(),
];

export async function loader({context}: Route.LoaderArgs) {
  return {media: await loadMedia(context.storefront, [HARNESS])};
}

export default function Playground() {
  const {media} = useLoaderData<typeof loader>();
  return (
    <Editor
      initial={HARNESS}
      media={media}
      dev={DEV}
      menus={DEMO_MENUS}
      products={DEMO_PRODUCTS}
      collections={[DEMO_COLLECTION]}
    />
  );
}
