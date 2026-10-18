import path from "node:path";

import type { Nodes, Root } from "mdast";

const contentDir = path.resolve(import.meta.dirname, "../..");

// Content links point at files (`./docker.md`) so they work on GitHub too;
// rewrite them into site URLs.
export function remarkLinks() {
  return (tree: Root, file: { path?: string }) => {
    if (!file.path) {
      return;
    }

    visit(tree, file.path);
  };
}

function visit(node: Nodes, filePath: string) {
  if (node.type === "link") {
    node.url = resolveLink(node.url, filePath);
  }

  if ("children" in node) {
    for (const child of node.children) {
      visit(child, filePath);
    }
  }
}

function resolveLink(url: string, filePath: string) {
  if (/^[a-z][a-z+.-]*:/i.test(url) || url.startsWith("#")) {
    return url;
  }

  const [target, hash] = url.split("#", 2);
  const isFile = /\.mdx?$/.test(target);
  if (target.startsWith("/") && !isFile) {
    return url;
  }

  const absolute = target.startsWith("/")
    ? path.join(contentDir, target)
    : path.resolve(path.dirname(filePath), target);

  const slug = path
    .relative(contentDir, absolute)
    .replace(/\.mdx?$/, "")
    .replace(/(^|\/)index$/, "");

  return `/${slug}${hash ? `#${hash}` : ""}`;
}
