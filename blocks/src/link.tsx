import {createContext, useContext, type ComponentType, type ReactNode} from 'react';

// this package is shared with the admin app, which has no router, so navigation
// cannot be imported here — only handed in. same seam product images and prices
// will use.
export type LinkProps = {
  href: string;
  className?: string;
  // carried through as a data attribute so the css keeps addressing it
  variant?: string;
  children: ReactNode;
};

export type LinkRender = ComponentType<LinkProps>;

// an anchor is what the model already says a link is. injectors refine it:
// client nav on the storefront, inert in the editor.
const Anchor: LinkRender = ({href, className, variant, children}) => (
  <a className={className} data-variant={variant} href={href}>
    {children}
  </a>
);

const Ctx = createContext<LinkRender>(Anchor);

export const useLinkRender = (): LinkRender => useContext(Ctx);

export function LinkRenderer({
  render,
  children,
}: {
  render?: LinkRender;
  children: ReactNode;
}) {
  return <Ctx.Provider value={render ?? Anchor}>{children}</Ctx.Provider>;
}
