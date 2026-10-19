import path from "node:path";

import type { Heading, Nodes, Paragraph, Root, RootContent, Text } from "mdast";

import type { ReleaseSummary } from "./changelog";

const openerPattern = /\s*\((?:closes|via) $/;
const separatorPattern = /^,\s*(?:(?:closes|via)\s+)?$/;
const referencePattern = /^https:\/\/github\.com\/tale\/headplane\/(issues|pulls?)\/(\d+)$/;

// Groups each `# 0.8.1 (October 16, 2026)` section of the changelog into a
// <Release>, its `## Changes`/`## Fixes` into <ReleaseSection>s, and turns
// trailing `(closes #612)` references into <Reference> chips. A <ReleaseList>
// wraps it all with the version list for navigation, and the list is exported
// as `releases` for the Upgrading page.
export function remarkChangelog() {
  return (tree: Root, file: { path?: string; data: Record<string, unknown> }) => {
    if (!file.path || path.basename(file.path) !== "CHANGELOG.md") {
      return;
    }

    visitParagraphs(tree);
    const grouped = group(tree.children, 1, release) as unknown as (RootContent | Element)[];
    // Other top-level nodes, like ESM the compiler injects, stay where they are.
    const releases = grouped.filter(
      (node): node is Element =>
        node.type === "mdxJsxFlowElement" && "name" in node && node.name === "Release",
    );
    for (const node of releases) {
      node.children = group(node.children, 2, section);
    }

    const releaseList: ReleaseSummary[] = releases.map((node) => ({
      version: attribute(node, "version"),
      hasUpgrading: node.children.some(
        (child) => isElement(child, "ReleaseSection") && attribute(child, "title") === "Upgrading",
      ),
    }));
    const exportList = (file.data["mdx-export"] ??= []) as { name: string; value: unknown }[];
    exportList.push({ name: "releases", value: releaseList });

    const versions = releaseList.map((release) => release.version);
    const list = element("ReleaseList", { versions: JSON.stringify(versions) });
    list.children = releases as unknown as RootContent[];
    tree.children = [
      ...grouped.filter((node) => !releases.includes(node as Element)),
      list,
    ] as RootContent[];
  };
}

interface Element {
  type: "mdxJsxFlowElement";
  name: string;
  attributes: { type: "mdxJsxAttribute"; name: string; value: string }[];
  children: RootContent[];
}

function element(name: string, attributes: Record<string, string | undefined>): Element {
  return {
    type: "mdxJsxFlowElement",
    name,
    attributes: Object.entries(attributes)
      .filter((entry): entry is [string, string] => entry[1] !== undefined)
      .map(([key, value]) => ({ type: "mdxJsxAttribute", name: key, value })),
    children: [],
  };
}

// Content before the first heading of `depth` stays ungrouped (a release's
// preamble), and `---` separators and beta notices are dropped.
function group(nodes: RootContent[], depth: number, wrap: (heading: Heading) => Element) {
  const result: (RootContent | Element)[] = [];
  let current: Element | undefined;
  for (const node of nodes) {
    if (node.type === "heading" && node.depth === depth) {
      current = wrap(node);
      result.push(current);
      continue;
    }

    if (node.type === "thematicBreak" || isBetaNotice(node)) {
      continue;
    }

    (current?.children ?? result).push(node);
  }

  return result as RootContent[];
}

function isElement(node: unknown, name: string): node is Element {
  return (node as Element).type === "mdxJsxFlowElement" && (node as Element).name === name;
}

function attribute(node: Element, name: string) {
  return node.attributes.find((item) => item.name === name)?.value ?? "";
}

function release(heading: Heading) {
  const [, version, date] = /^(.+?)(?: \((.+)\))?$/.exec(textOf(heading)) ?? [];
  return element("Release", { version, date });
}

function section(heading: Heading) {
  return element("ReleaseSection", { title: textOf(heading) });
}

function textOf(heading: Heading) {
  return heading.children
    .map((child) => ("value" in child ? child.value : ""))
    .join("")
    .trim();
}

// Prereleases get a badge instead of the "This is a beta release" blockquote.
function isBetaNotice(node: RootContent) {
  return (
    node.type === "blockquote" &&
    node.children.some(
      (child) =>
        child.type === "paragraph" &&
        child.children.some((text) => text.type === "text" && /beta release/i.test(text.value)),
    )
  );
}

function visitParagraphs(node: Nodes) {
  if (node.type === "paragraph") {
    extractReferences(node);
    return;
  }

  if ("children" in node) {
    for (const child of node.children) {
      visitParagraphs(child);
    }
  }
}

function extractReferences(paragraph: Paragraph) {
  const nodes = paragraph.children;
  const start = nodes.findIndex((node) => node.type === "text" && openerPattern.test(node.value));
  if (start === -1) {
    return;
  }

  const references: Element[] = [];
  let end = start + 1;
  for (; end < nodes.length; end++) {
    const node = nodes[end];
    const match = node.type === "link" ? referencePattern.exec(node.url) : null;
    if (match) {
      references.push(
        element("Reference", { kind: match[1] === "issues" ? "issues" : "pull", number: match[2] }),
      );
      continue;
    }

    if (node.type === "text" && separatorPattern.test(node.value)) {
      continue;
    }

    break;
  }

  const closer = nodes[end];
  if (!references.length || closer?.type !== "text" || !closer.value.startsWith(")")) {
    return;
  }

  const opener = nodes[start] as Text;
  opener.value = opener.value.replace(openerPattern, "") + closer.value.slice(1);
  const inline = references.map((reference) => ({ ...reference, type: "mdxJsxTextElement" }));
  paragraph.children = [
    ...nodes.slice(0, start + 1),
    ...nodes.slice(end + 1),
    ...inline,
  ] as Paragraph["children"];
}
