import path from "node:path";

import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { remarkDirectiveAdmonition } from "fumadocs-core/mdx-plugins";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import remarkDirective from "remark-directive";
import { defineConfig } from "vite";

import { remarkChangelog } from "./app/lib/remark-changelog";

// Maps each `:::type` directive to a variant in app/components/callout.tsx.
const admonitionTypes = {
  note: "neutral",
  info: "neutral",
  tip: "info",
  warning: "warning",
  danger: "error",
  success: "success",
};

// Set by the docs workflows. Local builds have no channel. Beta builds use the
// commit as their version, and the date is formatted here so the prerendered
// HTML matches what the browser renders.
const docsBuild = {
  channel: process.env.HEADPLANE_DOCS_CHANNEL ?? "",
  version: process.env.HEADPLANE_DOCS_VERSION ?? "",
  date: process.env.HEADPLANE_DOCS_DATE
    ? new Date(process.env.HEADPLANE_DOCS_DATE).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    : "",
};

export default defineConfig({
  base: process.env.HEADPLANE_DOCS_BASE ?? "/",
  define: {
    __HEADPLANE_DOCS__: JSON.stringify(docsBuild),
  },
  plugins: [
    fumadocsMdx({
      globalOptions: {
        mdxOptions: {
          remarkPlugins: (plugins) => [
            remarkDirective,
            [remarkDirectiveAdmonition, { types: admonitionTypes }],
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
