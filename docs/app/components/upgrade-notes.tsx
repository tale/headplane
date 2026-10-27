import { Children, isValidElement, type ReactNode } from "react";

import { useMDXComponents } from "@/components/mdx";
import { releaseId, releaseLabel, type ReleaseSummary } from "@/lib/changelog";
import { changelog } from "@/lib/source";

function changelogEntry() {
  const entry = changelog.get("CHANGELOG.md");
  if (!entry) {
    throw new Error("CHANGELOG.md is missing from the changelog collection");
  }

  return entry;
}

// Fumadocs only builds a page's TOC from its own headings, so the docs loader
// adds the releases <UpgradeNotes> renders.
export function upgradeToc() {
  const releases = changelogEntry()._exports.releases as ReleaseSummary[];
  return releases
    .filter((release) => release.hasUpgrading)
    .map((release) => ({
      title: releaseLabel(release.version),
      url: `#${releaseId(release.version)}`,
      depth: 2,
    }));
}

// Renders only the `## Upgrading` section of each release in CHANGELOG.md,
// reusing the changelog's compiled <Release> and <ReleaseSection> elements.
export default function UpgradeNotes() {
  const Body = changelogEntry().body;
  const components = useMDXComponents();

  return (
    <Body
      components={{
        ...components,
        ReleaseList: ({ children }: { children: ReactNode }) => children,
        Release: ({ version, children }: { version: string; children: ReactNode }) => {
          const section = Children.toArray(children).find(
            (child) =>
              isValidElement<{ title?: string }>(child) && child.props.title === "Upgrading",
          );
          if (!isValidElement<{ children?: ReactNode }>(section)) {
            return null;
          }

          return (
            <>
              <components.h2 id={releaseId(version)}>{releaseLabel(version)}</components.h2>
              {section.props.children}
            </>
          );
        },
      }}
    />
  );
}
