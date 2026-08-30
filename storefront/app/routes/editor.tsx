import type {LinksFunction} from 'react-router';
import {Editor} from '@unigrid/editor';
import {DEMO_MENUS, DEMO_PRODUCTS, HARNESS} from '~/blocks/harness';
import {DEV, gridDevLinks} from '~/blocks/grid-dev';
import radixStyles from '@radix-ui/themes/styles.css?url';
import unigridStyles from '@unigrid/blocks/unigrid.css?url';
import editorStyles from '@unigrid/editor/editor.css?url';

// the playground. no onSave, so there is no path from here to a store.

export const handle = {bare: true};

export const links: LinksFunction = () => [
  {rel: 'stylesheet', href: radixStyles},
  {rel: 'stylesheet', href: unigridStyles},
  {rel: 'stylesheet', href: editorStyles},
  ...gridDevLinks(),
];

export default function Playground() {
  return (
    <Editor
      initial={HARNESS}
      dev={DEV}
      menus={DEMO_MENUS}
      products={DEMO_PRODUCTS}
    />
  );
}
