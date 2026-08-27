import {createContext, useContext, type ReactNode} from 'react';

// menus are authored in the shopify admin and this package cannot fetch, so a
// route resolves the handles its layout referenced and hands the links in.
export type MenuLink = {id: string; title: string; url: string};
export type Menus = Record<string, MenuLink[]>;

const Ctx = createContext<Menus>({});

export const useMenu = (handle: string): MenuLink[] =>
  useContext(Ctx)[handle] ?? [];

export function MenuSource({
  menus,
  children,
}: {
  menus?: Menus;
  children: ReactNode;
}) {
  return <Ctx.Provider value={menus ?? {}}>{children}</Ctx.Provider>;
}

// shopify returns menu urls absolute. both surfaces have to strip the origin or
// every link leaves the site, so the rule lives once here rather than twice.
export function menuPath(url: string, domains: readonly string[]): string {
  try {
    const parsed = new URL(url);
    const own =
      parsed.hostname.endsWith('myshopify.com') ||
      domains.some((d) => d && parsed.hostname === hostOf(d));
    return own ? parsed.pathname + parsed.search : url;
  } catch {
    // already relative
    return url;
  }
}

// a domain may arrive with a scheme or without one
const hostOf = (d: string): string => {
  try {
    return new URL(d).hostname;
  } catch {
    return d;
  }
};
