import { Menu } from "@base-ui/react/menu";
import { Check, ChevronDown } from "lucide-react";
import { useLocation } from "react-router";

import { betaOrigin, docsBuild, pageOn, stableOrigin, useReleases } from "@/lib/releases";

// Switches to the same page in another version's docs.
export default function VersionPicker({ className = "" }: { className?: string }) {
  const { pathname } = useLocation();
  const releases = useReleases();
  if (!docsBuild.channel) {
    return null;
  }

  const isBeta = docsBuild.channel === "beta";
  const items = [
    { label: "Beta", href: pageOn(betaOrigin, "/", pathname), isCurrent: isBeta },
    ...releases.map((release, index) => ({
      label: index === 0 ? `${release.version} (latest)` : release.version,
      href: pageOn(stableOrigin, release.path, pathname),
      isCurrent: !isBeta && release.version === docsBuild.version,
    })),
  ];

  // Until the list loads, or if it can't, still show this build's version.
  if (!isBeta && !items.some((item) => item.isCurrent)) {
    items.push({
      label: docsBuild.version,
      href: pageOn("", import.meta.env.BASE_URL, pathname),
      isCurrent: true,
    });
  }

  return (
    <Menu.Root>
      <Menu.Trigger
        className={`text-muted hover:bg-hover hover:text-fg data-popup-open:bg-hover data-popup-open:text-fg focus-visible:outline-accent inline-flex h-8 items-center gap-1 rounded-md px-2 text-[13px] font-medium focus-visible:outline-2 ${className}`}
      >
        {isBeta ? "Beta" : docsBuild.version}
        <ChevronDown className="size-3.5" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="start" className="z-50" sideOffset={6}>
          <Menu.Popup className="bg-raised border-line shadow-overlay min-w-44 rounded-lg border py-1 outline-hidden">
            {items.map((item) => (
              <Menu.LinkItem
                className="text-fg data-highlighted:bg-hover mx-1 flex cursor-pointer items-center justify-between gap-4 rounded-md px-3 py-1.5 text-sm outline-hidden"
                href={item.href}
                key={item.label}
              >
                {item.label}
                {item.isCurrent && <Check className="text-muted size-3.5" />}
              </Menu.LinkItem>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
