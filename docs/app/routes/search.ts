import { createFromSource } from "fumadocs-core/search/server";

import { source } from "@/lib/source";
import { resolveVersion } from "@/lib/versions";

const versionPattern = /\{versions\.([\w.]+)\}/g;

// Fumadocs indexes the page source, so `{versions.x}` expressions would show up
// raw in results without filling them in here.
const server = createFromSource(source, {
  language: "english",
  async buildIndex(page) {
    const { headings, contents } = await page.data.structuredData();
    return {
      title: page.data.title,
      description: page.data.description,
      url: page.url,
      id: page.url,
      structuredData: {
        headings: headings.map(fillVersions),
        contents: contents.map(fillVersions),
      },
    };
  },
});

function fillVersions<T extends { content: string }>(item: T): T {
  return {
    ...item,
    content: item.content.replace(versionPattern, (_, key: string) => resolveVersion(key)),
  };
}

export async function loader() {
  return server.staticGET();
}
