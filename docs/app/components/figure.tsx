import type { ReactNode } from "react";

interface FigureProps {
  alt: string;
  src?: string;
  light?: string;
  dark?: string;
  caption?: ReactNode;
}

export default function Figure({ alt, src, light, dark, caption }: FigureProps) {
  return (
    <figure>
      {src && <img alt={alt} src={src} />}
      {light && <img alt={alt} className="dark:hidden" src={light} />}
      {dark && <img alt={alt} className="hidden dark:block" src={dark} />}
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
