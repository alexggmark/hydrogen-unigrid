import {createContext, useContext, type ReactNode} from 'react';
import {isMediaRef, type Media} from '@unigrid/core';

// gid to url. resolved by the route, like every other reference this package
// renders: blocks/ cannot fetch, so a file id means nothing to it on its own.
export type MediaUrls = Record<string, string>;

const Ctx = createContext<MediaUrls>({});

export function MediaSource({
  media,
  children,
}: {
  media?: MediaUrls;
  children: ReactNode;
}) {
  return <Ctx.Provider value={media ?? {}}>{children}</Ctx.Provider>;
}

// undefined means unresolved, which renders nothing rather than a broken image
export function useMediaSrc(media: Media | undefined): string | undefined {
  const urls = useContext(Ctx);
  if (!media) return undefined;
  return isMediaRef(media) ? urls[media.id] : media.src;
}
