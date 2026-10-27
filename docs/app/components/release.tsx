import { TOCProvider, TOCScrollArea } from "fumadocs-ui/components/toc";
import { TOCItem, TOCItems } from "fumadocs-ui/components/toc/default";
import { CircleDot, GitPullRequest, History } from "lucide-react";
import type { ReactNode } from "react";

import { releaseId, releaseLabel } from "@/lib/changelog";

// Rendered by remark-changelog from CHANGELOG.md.

// Clears the sticky header (and the beta banner, when shown).
const stickyTop = "top-[calc(var(--fd-banner-height,0px)+5rem)]";

export function ReleaseList({ versions, children }: { versions: string; children: ReactNode }) {
  const toc = (JSON.parse(versions) as string[]).map((version) => ({
    title: releaseLabel(version),
    url: `#${releaseId(version)}`,
    depth: 2,
  }));

  return (
    <TOCProvider toc={toc}>
      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_10rem] xl:gap-x-12">
        <div className="min-w-0">{children}</div>
        <aside
          className={`sticky ${stickyTop} hidden max-h-[calc(100vh-7rem)] flex-col gap-y-3 self-start xl:flex`}
        >
          <p className="text-muted inline-flex items-center gap-1.5 text-sm">
            <History className="size-4" />
            Versions
          </p>
          <TOCScrollArea className="ms-px">
            <TOCItems>
              {toc.map((item) => (
                <TOCItem item={item} key={item.url} />
              ))}
            </TOCItems>
          </TOCScrollArea>
        </aside>
      </div>
    </TOCProvider>
  );
}

interface ReleaseProps {
  version: string;
  date?: string;
  children: ReactNode;
}

export function Release({ version, date, children }: ReleaseProps) {
  const isPrerelease = version.includes("-");
  const id = releaseId(version);

  return (
    <section
      className="border-line grid scroll-mt-[calc(var(--fd-banner-height,0px)+5rem)] gap-x-10 gap-y-4 border-t py-10 first:border-t-0 first:pt-0 md:grid-cols-[10rem_minmax(0,1fr)]"
      id={id}
    >
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1 self-start md:sticky md:top-[calc(var(--fd-banner-height,0px)+5rem)] md:flex-col">
        <a className="text-fg text-lg font-semibold tracking-tight" href={`#${id}`}>
          {releaseLabel(version)}
        </a>
        {date && <time className="text-muted text-sm">{date}</time>}
        {isPrerelease && (
          <span className="bg-subtle text-muted border-line inline-flex h-[18px] items-center rounded-sm border px-1.5 text-[11px] font-medium">
            Beta
          </span>
        )}
      </header>
      <div className="prose release-notes min-w-0">{children}</div>
    </section>
  );
}

const sectionStyles: Record<string, string> = {
  Upgrading: "bg-warn-subtle text-warn border-warn/30",
  Changes: "bg-accent-subtle text-accent border-accent/30",
  Fixes: "bg-ok-subtle text-ok border-ok/30",
};

export function ReleaseSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="release-section">
      <div className="not-prose">
        <h3
          className={`inline-flex h-6 items-center rounded-md border px-2 text-xs font-semibold ${sectionStyles[title] ?? "bg-subtle text-muted border-line"}`}
        >
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

export function Reference({ kind, number }: { kind: "issues" | "pull"; number: string }) {
  const Icon = kind === "pull" ? GitPullRequest : CircleDot;

  return (
    <span className="not-prose">
      <a
        className="bg-accent-subtle text-accent border-accent/25 hover:border-accent/60 ms-1.5 inline-flex h-5 -translate-y-px items-center gap-1 rounded-md border px-1.5 align-middle text-xs font-medium tabular-nums transition-colors [&_svg]:size-3"
        href={`https://github.com/tale/headplane/${kind}/${number}`}
        title={`${kind === "pull" ? "Pull request" : "Issue"} #${number}`}
      >
        <Icon />#{number}
      </a>
    </span>
  );
}
