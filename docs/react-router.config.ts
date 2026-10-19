import { readdir } from "node:fs/promises";

import type { Config } from "@react-router/dev/config";
import { createGetUrl, getSlugs } from "fumadocs-core/source";

const getUrl = createGetUrl("/");
const ignoredDirs = ["app/", "build/", "public/", "node_modules/"];

export default {
  // Archived versions are built under their own path, such as `/0.8/`.
  basename: process.env.HEADPLANE_DOCS_BASE ?? "/",
  ssr: false,
  async prerender({ getStaticPaths }) {
    const paths = getStaticPaths();
    const entries = await readdir(import.meta.dirname, { recursive: true });

    for (const entry of entries) {
      if (!/\.mdx?$/.test(entry) || ignoredDirs.some((dir) => entry.startsWith(dir))) {
        continue;
      }

      paths.push(getUrl(getSlugs(entry)));
    }

    return paths;
  },
} satisfies Config;
