import type React from "react";

import cn from "~/utils/cn";

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  // Pages nested under another page's title, like the settings pages.
  isSubpage?: boolean;
  className?: string;
}

export default function PageHeader({
  title,
  description,
  actions,
  isSubpage,
  className,
}: PageHeaderProps) {
  const Heading = isSubpage ? "h2" : "h1";

  return (
    <div className={cn("mb-6 flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <Heading className={cn("font-semibold text-balance", isSubpage ? "text-lg" : "text-xl")}>
          {title}
        </Heading>
        {description && (
          <p className={cn("text-muted mt-1 max-w-prose", isSubpage && "text-sm")}>{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
