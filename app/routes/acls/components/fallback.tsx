import { Loader2 } from "lucide-react";

import cn from "~/utils/cn";

export default function Fallback() {
  return (
    <div
      className={cn("h-editor overflow-hidden rounded-md", "bg-[var(--cm-bg)] text-[var(--cm-fg)]")}
    >
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-[var(--cm-gutter-fg)]">
          <Loader2 className="size-5 animate-spin" />
          <p className="text-sm">Loading editor…</p>
        </div>
      </div>
    </div>
  );
}
