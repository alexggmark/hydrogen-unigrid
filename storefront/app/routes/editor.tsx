import type {LinksFunction} from 'react-router';
import {useLoaderData} from 'react-router';
import type {Route} from './+types/editor';
import {Editor} from '@unigrid/editor';
import {DEMO_COLLECTION, DEMO_MENUS, DEMO_PRODUCTS, HARNESS} from '~/blocks/harness';
import radixStyles from '@radix-ui/themes/styles.css?url';
import unigridStyles from '@unigrid/blocks/unigrid.css?url';
import editorStyles from '@unigrid/editor/editor.css?url';
import {loadMedia, loadSettings} from '~/lib/layout';

// the playground. no onSave, so there is no path from here to a store.

export const handle = {bare: true};

export const links: LinksFunction = () => [
  {rel: 'stylesheet', href: radixStyles},
  {rel: 'stylesheet', href: unigridStyles},
  {rel: 'stylesheet', href: editorStyles},
];

export async function loader({context}: Route.LoaderArgs) {
  // the playground reads the theme but never writes one, so the logo resolves
  // exactly as it does in the admin
  const settings = await loadSettings(context.storefront);
  const media = await loadMedia(
    context.storefront,
    [HARNESS],
    settings.logo ? [settings.logo] : [],
  );
  return {media, settings};
}

export default function Playground() {
  const {media, settings} = useLoaderData<typeof loader>();
  return (
    <Editor
      initial={HARNESS}
      media={media}
      menus={DEMO_MENUS}
      products={DEMO_PRODUCTS}
      collections={[DEMO_COLLECTION]}
      initialSettings={settings}
    />
  );
}
