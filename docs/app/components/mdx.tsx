import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";

import Figure from "@/components/figure";

export function useMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    Figure,
    ...components,
  } satisfies MDXComponents;
}

declare global {
  type MDXProvidedComponents = ReturnType<typeof useMDXComponents>;
}
