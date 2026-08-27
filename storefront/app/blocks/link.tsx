import {Link} from 'react-router';
import type {LinkRender} from '@unigrid/blocks';

// the injected half of the link seam. routing is legal out here and banned in
// the shared package, which is the whole point of handing it in.
export const StoreLink: LinkRender = ({href, className, variant, children}) =>
  href.startsWith('/') ? (
    <Link
      className={className}
      data-variant={variant}
      prefetch="intent"
      to={href}
    >
      {children}
    </Link>
  ) : (
    // off-site, or a scheme the router cannot own
    <a className={className} data-variant={variant} href={href}>
      {children}
    </a>
  );
