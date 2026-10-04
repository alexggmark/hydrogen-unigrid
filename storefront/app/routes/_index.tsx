import type {LinksFunction} from 'react-router';
import {useLoaderData} from 'react-router';
import type {Route} from './+types/_index';
import {Composition} from '~/blocks/Composition';
import {loadComposition} from '~/lib/layout';
import unigridStyles from '@unigrid/blocks/unigrid.css?url';
import demoStyles from '~/styles/unigrid-demo.css?url';

export const meta: Route.MetaFunction = () => [{title: 'unigrid'}];

export const handle = {bare: true};

export const links: LinksFunction = () => [
  {rel: 'stylesheet', href: unigridStyles},
  {rel: 'stylesheet', href: demoStyles},
];

export async function loader({context}: Route.LoaderArgs) {
  return {
    composition: await loadComposition(
      context.storefront,
      'home',
      'published',
      [context.env.PUBLIC_STORE_DOMAIN],
      context.ab,
    ),
  };
}

export default function Home() {
  const {composition} = useLoaderData<typeof loader>();
  return <Composition {...composition} />;
}
