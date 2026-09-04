import {createContext, useContext, type ReactNode} from 'react';

// the theme's mark, resolved by the route like every other reference. the
// element holds a width and no image, so one logo changes every page at once.
export type LogoData = {url: string; alt?: string};

const Ctx = createContext<LogoData | undefined>(undefined);

export const useLogo = (): LogoData | undefined => useContext(Ctx);

export function LogoSource({
  logo,
  children,
}: {
  logo?: LogoData;
  children: ReactNode;
}) {
  return <Ctx.Provider value={logo}>{children}</Ctx.Provider>;
}
