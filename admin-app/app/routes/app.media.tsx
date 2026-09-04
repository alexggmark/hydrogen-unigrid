import type {LoaderFunctionArgs} from 'react-router';
import {authenticate} from '../shopify.server';
import {resolveMedia} from '../lib/layout.server';

// the picker returns ids and the editor needs urls, so one lookup has to happen
// between the two. a resource route rather than an action: it reads, and the
// editor wants a promise rather than fetcher state.
export const loader = async ({request}: LoaderFunctionArgs) => {
  const {admin} = await authenticate.admin(request);
  const ids = new URL(request.url).searchParams.getAll('id');
  return {media: await resolveMedia(admin, ids.slice(0, 25))};
};
