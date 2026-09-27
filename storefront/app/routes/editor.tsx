import type {LinksFunction} from 'react-router';
import {useLoaderData} from 'react-router';
import type {Route} from './+types/editor';
import {Editor, type Region, type Snapshot, type StoreMenu} from '@unigrid/editor';
import {decode, encode, metricsFrom, type Layout, type Palette} from '@unigrid/core';
import {DEMO_COLLECTION, DEMO_MENUS, DEMO_PRODUCTS, HARNESS} from '~/blocks/harness';
import radixStyles from '@radix-ui/themes/styles.css?url';
import unigridStyles from '@unigrid/blocks/unigrid.css?url';
import editorStyles from '@unigrid/editor/editor.css?url';
import {loadLayout, loadMedia, loadMenus, loadSettings} from '~/lib/layout';
import snapshot from '~/blocks/playground.json';

// what the playground opens on: a snapshot exported from the playground itself,
// so the default is arranged by hand rather than typed. through the wire and
// back, because a json import is only typed as strings, and decode is what
// actually checks it is a layout. /grid keeps the harness as its fixture.
const saved = snapshot.regions as Record<string, unknown>;
const region = (target: string): Layout | null =>
  saved[target] ? (decode(encode(saved[target] as Layout)) ?? null) : null;
const DEFAULT: Layout = region('page') ?? HARNESS;
const PALETTE = snapshot.palette as Palette;
const METRICS = metricsFrom(snapshot.metrics);

// the playground. no onSave, so there is no path from here to a store.

export const handle = {bare: true};

export const links: LinksFunction = () => [
  {rel: 'stylesheet', href: radixStyles},
  {rel: 'stylesheet', href: unigridStyles},
  {rel: 'stylesheet', href: editorStyles},
];

const EMPTY: Layout = {version: 1, blocks: []};

export async function loader({context}: Route.LoaderArgs) {
  const {storefront} = context;
  // header and footer are the store's live ones unless the snapshot carries its
  // own, so the playground reads as the real site. reading is all it does.
  const [settings, liveHeader, liveFooter] = await Promise.all([
    loadSettings(storefront),
    loadLayout(storefront, 'header'),
    loadLayout(storefront, 'footer'),
  ]);
  const header = region('header') ?? liveHeader?.layout ?? EMPTY;
  const footer = region('footer') ?? liveFooter?.layout ?? EMPTY;
  const all = [header, DEFAULT, footer];
  const [media, menus] = await Promise.all([
    loadMedia(storefront, all, settings.logo ? [settings.logo] : []),
    loadMenus(storefront, all, [context.env.PUBLIC_STORE_DOMAIN]),
  ]);
  return {media, settings, header, footer, menus};
}

// a file, not storage: the playground persists nothing, and a snapshot is
// something to read, diff and hand back as the next default
function download(snapshot: Snapshot) {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'unigrid-playground.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Playground() {
  const {media, settings, header, footer, menus} = useLoaderData<typeof loader>();
  const regions: Region[] = [
    {target: 'header', label: 'Header', layout: header},
    {target: 'page', label: 'Page', layout: DEFAULT},
    {target: 'footer', label: 'Footer', layout: footer},
  ];
  // the store's menus win over the demo one of the same handle: they are what
  // the live header actually shows
  const storeMenus: StoreMenu[] = Object.entries(menus).map(([handle, items]) => ({
    handle,
    title: handle,
    items,
  }));
  const allMenus = [
    ...storeMenus,
    ...DEMO_MENUS.filter((d) => !(d.handle in menus)),
  ];
  return (
    <Editor
      initial={DEFAULT}
      regions={regions}
      activeTarget="page"
      initialPalette={PALETTE}
      initialMetrics={METRICS}
      media={media}
      menus={allMenus}
      products={DEMO_PRODUCTS}
      collections={[DEMO_COLLECTION]}
      initialSettings={settings}
      onExport={download}
    />
  );
}
