import {collectionPageSize, type Layout} from '@unigrid/core';

// the layout owns the page size: whatever the largest contextual repeater on it
// asks for. nothing browsing this collection means nothing to size, so the
// skeleton grid keeps its own page.
export const collectionPageBy = (
  layouts: (Layout | null)[],
  fallback = 8,
): number =>
  Math.max(0, ...layouts.map((l) => (l ? collectionPageSize(l) : 0))) || fallback;

// hrefs, not state: paging is a navigation, so it survives with no javascript
// and blocks/ never learns what a cursor is. the param names are hydrogen's,
// because getPaginationVariables reads them back off the next request.
export function pageHrefs(
  url: URL,
  pageInfo: {
    hasPreviousPage: boolean;
    hasNextPage: boolean;
    startCursor?: string | null;
    endCursor?: string | null;
  },
): {prev?: string; next?: string} {
  const href = (direction: 'previous' | 'next', cursor: string) => {
    // every other param is kept: a filter or a preview must survive the page
    const params = new URLSearchParams(url.search);
    params.set('direction', direction);
    params.set('cursor', cursor);
    return `${url.pathname}?${params.toString()}`;
  };
  return {
    ...(pageInfo.hasPreviousPage && pageInfo.startCursor
      ? {prev: href('previous', pageInfo.startCursor)}
      : {}),
    ...(pageInfo.hasNextPage && pageInfo.endCursor
      ? {next: href('next', pageInfo.endCursor)}
      : {}),
  };
}
