import {
  SidebarDrawerContent,
  SidebarDrawerOverlay,
  SidebarFolder,
  SidebarFolderContent as BaseFolderContent,
  SidebarFolderLink as BaseFolderLink,
  SidebarFolderTrigger as BaseFolderTrigger,
  SidebarItem as BaseItem,
  SidebarSeparator as BaseSeparator,
  SidebarViewport,
  useFolderDepth,
} from "fumadocs-ui/components/sidebar/base";
import { createPageTreeRenderer } from "fumadocs-ui/components/sidebar/page-tree";
import type { ComponentProps } from "react";

import VersionPicker from "@/components/version-picker";

// Matches the settings nav in the app (app/routes/settings/layout.tsx).
const itemClass =
  "flex min-h-8 w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-sm leading-5 text-muted transition-colors hover:bg-hover hover:text-fg data-[active=true]:bg-subtle data-[active=true]:font-medium data-[active=true]:text-fg [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-faint";

function SidebarSeparator(props: ComponentProps<typeof BaseSeparator>) {
  return (
    <BaseSeparator
      {...props}
      className="text-faint mt-6 mb-1 px-2 text-xs font-medium first:mt-0"
    />
  );
}

function SidebarItem(props: ComponentProps<typeof BaseItem>) {
  return <BaseItem {...props} className={itemClass} />;
}

function SidebarFolderLink(props: ComponentProps<typeof BaseFolderLink>) {
  return <BaseFolderLink {...props} className={itemClass} />;
}

function SidebarFolderTrigger(props: ComponentProps<typeof BaseFolderTrigger>) {
  return <BaseFolderTrigger {...props} className={itemClass} />;
}

function SidebarFolderContent(props: ComponentProps<typeof BaseFolderContent>) {
  const depth = useFolderDepth();

  return (
    <BaseFolderContent
      {...props}
      className={
        depth > 0
          ? "border-line ml-3 flex flex-col gap-0.5 border-l py-0.5 pl-2"
          : "flex flex-col gap-0.5"
      }
    />
  );
}

const PageTree = createPageTreeRenderer({
  SidebarFolder,
  SidebarFolderContent,
  SidebarFolderLink,
  SidebarFolderTrigger,
  SidebarItem,
  SidebarSeparator,
});

function SidebarLinks() {
  return (
    <SidebarViewport>
      <nav className="flex flex-col gap-0.5 py-2">
        <PageTree />
      </nav>
    </SidebarViewport>
  );
}

function SidebarFooter({ hasVersionPicker = false }: { hasVersionPicker?: boolean }) {
  return (
    <div className="border-line text-faint flex items-center gap-x-3 border-t px-5 py-3 text-xs">
      {hasVersionPicker && <VersionPicker className="mr-auto -ml-2" />}
      <a className="hover:text-fg" href="https://github.com/sponsors/tale">
        Sponsor
      </a>
      <a className="hover:text-fg" href="https://ko-fi.com/atale">
        Ko-fi
      </a>
    </div>
  );
}

export default function Sidebar() {
  return (
    <>
      <aside
        className="border-line md:layout:[--fd-sidebar-width:16rem] sticky top-(--fd-docs-row-1) flex h-[calc(var(--fd-docs-height)-var(--fd-docs-row-1))] flex-col items-end border-r [grid-area:sidebar] *:w-(--fd-sidebar-width) max-md:hidden"
        id="nd-sidebar"
      >
        <SidebarLinks />
        <SidebarFooter />
      </aside>
      <SidebarDrawerOverlay className="bg-backdrop data-[state=closed]:animate-fd-fade-out data-[state=open]:animate-fd-fade-in fixed inset-0 z-40" />
      <SidebarDrawerContent className="bg-canvas border-line shadow-overlay data-[state=closed]:animate-fd-sidebar-out data-[state=open]:animate-fd-sidebar-in fixed inset-y-0 right-0 z-40 flex w-[85%] max-w-80 flex-col border-l">
        <SidebarLinks />
        <SidebarFooter hasVersionPicker />
      </SidebarDrawerContent>
    </>
  );
}
