import { Check, Copy, Info } from "lucide-react";

import cn from "~/utils/cn";
import toast from "~/utils/toast";

import Tooltip from "./tooltip";

export interface AttributeProps {
  name: string;
  value: string;
  tooltip?: string;
  isCopyable?: boolean;
}

export default function Attribute({ name, value, tooltip, isCopyable }: AttributeProps) {
  return (
    <dl className="flex items-center gap-1 text-sm">
      <dt
        className={cn(
          "w-1/3 sm:w-1/4 lg:w-1/3 shrink-0 min-w-0",
          "text-mist-500 dark:text-mist-400",
          tooltip ? "flex items-center gap-1" : undefined,
        )}
      >
        {name}
        {tooltip ? (
          <Tooltip content={tooltip}>
            <Info className="size-4" />
          </Tooltip>
        ) : undefined}
      </dt>
      <dd
        className={cn(
          "min-w-0 px-1.5 py-1 rounded-lg border border-transparent",
          ...(isCopyable
            ? [
                "cursor-pointer hover:shadow-xs",
                "hover:bg-mist-50 dark:hover:bg-mist-800",
                "hover:border-mist-100 dark:hover:border-mist-700",
              ]
            : []),
        )}
      >
        {isCopyable ? (
          <button
            type="button"
            className="relative flex w-full min-w-0 items-center gap-1.5"
            onClick={async (event) => {
              const svgs = event.currentTarget.querySelectorAll("svg");
              for (const svg of svgs) {
                svg.toggleAttribute("data-copied", true);
              }

              await navigator.clipboard.writeText(value);
              toast(`Copied ${name} to clipboard`);

              setTimeout(() => {
                for (const svg of svgs) {
                  svg.toggleAttribute("data-copied", false);
                }
              }, 1000);
            }}
          >
            <div suppressHydrationWarning className="truncate">
              {value}
            </div>
            {isCopyable ? (
              <div>
                <Check className="hidden size-4 data-copied:block" />
                <Copy className="block size-4 data-copied:hidden" />
              </div>
            ) : undefined}
          </button>
        ) : (
          <div className="relative min-w-0 truncate" suppressHydrationWarning>
            {value}
          </div>
        )}
      </dd>
    </dl>
  );
}
