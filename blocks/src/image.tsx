import {createContext, useContext, type ComponentType, type ReactNode} from 'react';

// the seam link.tsx opens for navigation, opened again for images: the admin app
// is not a hydrogen app, so <Image> cannot be imported here — only handed in.
export type ImageProps = {
  src: string;
  alt: string;
  className?: string;
};

export type ImageRender = ComponentType<ImageProps>;

const Img: ImageRender = ({src, alt, className}) => (
  <img className={className} src={src} alt={alt} loading="lazy" />
);

const Ctx = createContext<ImageRender>(Img);

export const useImageRender = (): ImageRender => useContext(Ctx);

export function ImageRenderer({
  render,
  children,
}: {
  render?: ImageRender;
  children: ReactNode;
}) {
  return <Ctx.Provider value={render ?? Img}>{children}</Ctx.Provider>;
}
