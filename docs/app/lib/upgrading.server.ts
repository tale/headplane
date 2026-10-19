import { readFile } from "node:fs/promises";
import path from "node:path";

import { upgradeHeading } from "@/lib/upgrading";

const changelogPath = path.resolve(import.meta.dirname, "../../../CHANGELOG.md");

// Fumadocs only builds a page's TOC from its own headings, so the releases
// <UpgradeNotes> renders are listed here.
export async function upgradeToc() {
  const text = await readFile(changelogPath, "utf8");
  const items: { title: string; url: string; depth: number }[] = [];
  let version: string | undefined;

  for (const line of text.split("\n")) {
    const release = /^# (.+?)(?: \(.+\))?$/.exec(line);
    if (release) {
      version = release[1];
      continue;
    }

    if (line.trim() === "## Upgrading" && version) {
      const { id, title } = upgradeHeading(version);
      items.push({ title, url: `#${id}`, depth: 2 });
    }
  }

  return items;
}
