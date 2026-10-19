import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Heading, Root } from "mdast";

const changelogPath = path.resolve(import.meta.dirname, "../../../CHANGELOG.md");

// Replaces the `::changelog-upgrading` marker on the Upgrading page with every
// release's `## Upgrading` section from CHANGELOG.md, each under a `## <version>`
// heading. It runs before Fumadocs' plugins so the headings reach the TOC.
export function remarkUpgrading(this: { parse(text: string): unknown }) {
  return async (tree: Root, file: { value: unknown }) => {
    const index = tree.children.findIndex(
      (node) =>
        "name" in node && node.type === "leafDirective" && node.name === "changelog-upgrading",
    );
    if (index === -1) {
      return;
    }

    const changelogText = await readFile(changelogPath, "utf8");
    const markdown = upgradeMarkdown(changelogText, this.parse(changelogText) as Root);

    // Fumadocs indexes search by slicing the page's source at each node's
    // position, so the sections are appended to it and parsed from there.
    const source = `${String(file.value)}\n\n`;
    file.value = source + markdown;
    const sections = this.parse(markdown) as Root;
    shiftPositions(sections, source);
    tree.children.splice(index, 1, ...sections.children);
  };
}

function upgradeMarkdown(text: string, changelog: Root) {
  const blocks: string[] = [];
  let version = "";
  let isCollecting = false;

  for (const node of changelog.children) {
    if (node.type === "heading" && node.depth === 1) {
      version = textOf(node).replace(/ \(.+\)$/, "");
      isCollecting = false;
      continue;
    }

    if (node.type === "heading" && node.depth === 2) {
      isCollecting = textOf(node) === "Upgrading";
      if (isCollecting) {
        blocks.push(`## ${version === "Next" ? "Next release" : version}`);
      }

      continue;
    }

    if (isCollecting && node.type !== "thematicBreak" && node.position) {
      blocks.push(text.slice(node.position.start.offset, node.position.end.offset));
    }
  }

  return blocks.join("\n\n");
}

function shiftPositions(node: object, source: string) {
  const lines = source.split("\n").length - 1;
  const visit = (current: object) => {
    const { position } = current as { position?: Root["position"] };
    for (const point of position ? [position.start, position.end] : []) {
      point.line += lines;
      point.offset = (point.offset ?? 0) + source.length;
    }

    const { children } = current as { children?: object[] };
    children?.forEach(visit);
  };

  visit(node);
}

function textOf(heading: Heading) {
  return heading.children
    .map((child) => ("value" in child ? child.value : ""))
    .join("")
    .trim();
}
