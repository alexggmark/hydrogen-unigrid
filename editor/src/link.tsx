import type {LinkRender} from '@unigrid/blocks';

// still an anchor, so it renders and reads exactly as it will on the storefront.
// activating it is swallowed: navigating away from the canvas would take
// unsaved work with it, and native anchor dragging fights dnd-kit.
export const InertLink: LinkRender = ({href, className, variant, children}) => (
  <a
    className={className}
    data-variant={variant}
    draggable={false}
    href={href}
    onClick={(e) => e.preventDefault()}
  >
    {children}
  </a>
);
