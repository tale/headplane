import { Children, isValidElement, type ReactNode } from "react";

import { useMDXComponents } from "@/components/mdx";
import { changelog } from "@/lib/source";
import { upgradeHeading } from "@/lib/upgrading";

// Renders only the `## Upgrading` section of each release in CHANGELOG.md,
// reusing the changelog's compiled <Release> and <ReleaseSection> elements.
export default function UpgradeNotes() {
  const entry = changelog.get("CHANGELOG.md");
  if (!entry) {
    throw new Error("CHANGELOG.md is missing from the changelog collection");
  }

  const Body = entry.body;
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

          const { id, title } = upgradeHeading(version);
          return (
            <>
              <components.h2 id={id}>{title}</components.h2>
              {section.props.children}
            </>
          );
        },
      }}
    />
  );
}
