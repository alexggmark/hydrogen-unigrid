import {createContext, useContext, type ReactNode} from 'react';

// what the shell knows about the shopper. the cart count, the drawer opener and
// the account state are all hydrogen or router things, so blocks/ takes them the
// way it takes the image and link renderers rather than reaching for them.
export type ShopState = {
  cartCount?: number;
  // absent means nothing can be opened — the admin has no cart to show
  onOpenCart?: () => void;
  accountHref?: string;
  loggedIn?: boolean;
  // takes a variant id because a cart line is a variant, never a product
  onAddToCart?: (variantId: string) => void;
  addingToCart?: boolean;
  // a collapsed menu opens this rather than expanding in place. absent means
  // the shell has no drawer, and the toggle falls back to expanding inline.
  onOpenMenu?: (handle: string) => void;
};

const Ctx = createContext<ShopState>({});

export const useShop = (): ShopState => useContext(Ctx);

export function ShopSource({
  shop,
  children,
}: {
  shop?: ShopState;
  children: ReactNode;
}) {
  return <Ctx.Provider value={shop ?? {}}>{children}</Ctx.Provider>;
}
