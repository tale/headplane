import type { ReactNode } from "react";

interface FigureProps {
  alt: string;
  src?: string;
  light?: string;
  dark?: string;
  caption?: ReactNode;
}

// Screenshots are taken at 2x, so `srcSet` shows them at their natural size
// instead of stretching small crops to the column width.
const image = "mx-auto my-0 rounded-xl border border-fd-border";

export default function Figure({ alt, src, light, dark, caption }: FigureProps) {
  return (
    <figure>
      {src && <img alt={alt} className={image} src={src} srcSet={`${src} 2x`} />}
      {light && (
        <img alt={alt} className={`${image} dark:hidden`} src={light} srcSet={`${light} 2x`} />
      )}
      {dark && (
        <img alt={alt} className={`${image} hidden dark:block`} src={dark} srcSet={`${dark} 2x`} />
      )}
      {caption && <figcaption className="text-center">{caption}</figcaption>}
    </figure>
  );
}
