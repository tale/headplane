import path from "node:path";

import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { remarkDirectiveAdmonition } from "fumadocs-core/mdx-plugins";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import remarkDirective from "remark-directive";
import { defineConfig } from "vite";

import { remarkChangelog } from "./app/lib/remark-changelog";
import { remarkUpgrading } from "./app/lib/remark-upgrading";

// Callout variants from docs/app/components/callout.tsx
const admonitionTypes = {
  note: "neutral",
  info: "neutral",
  tip: "info",
  warning: "warning",
  danger: "error",
  success: "success",
};

export default defineConfig({
  define: {
    __HEADPLANE_BETA_DOCS__: JSON.stringify(process.env.HEADPLANE_BETA_DOCS === "true"),
  },
  plugins: [
    fumadocsMdx({
      globalOptions: {
        mdxOptions: {
          remarkPlugins: (plugins) => [
            remarkDirective,
            [remarkDirectiveAdmonition, { types: admonitionTypes }],
            remarkUpgrading,
            ...plugins,
            remarkChangelog,
          ],
          rehypeCodeOptions: {
            themes: { light: "github-light", dark: "github-dark" },
            fallbackLanguage: "text",
          },
        },
      },
    }),
    tailwindcss(),
    reactRouter(),
  ],
  resolve: {
    // Not `tsconfigPaths`: that only applies to TypeScript files, and MDX pages
    // import from `@/` too.
    alias: { "@": path.resolve(import.meta.dirname, "app") },
  },
});
