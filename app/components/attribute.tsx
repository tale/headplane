import { Check, Copy, Info } from "lucide-react";

import { copyToClipboard } from "~/utils/copy";
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
    <div className="group/attr flex items-baseline gap-4 py-2 text-sm">
      <dt className="text-muted flex w-1/3 min-w-0 shrink-0 items-baseline gap-1 sm:w-40">
        {name}
        {tooltip ? (
          <Tooltip content={tooltip}>
            <Info className="size-3.5 translate-y-0.5 opacity-40 transition-opacity hover:opacity-100" />
          </Tooltip>
        ) : undefined}
      </dt>
      <dd className="min-w-0 flex-1">
        {isCopyable ? (
          <button
            type="button"
            className="focus-ring hover:bg-hover relative -mx-1 flex max-w-full min-w-0 items-center gap-1.5 rounded-sm px-1"
            onClick={async (event) => {
              const svgs = event.currentTarget.querySelectorAll("svg");
              const isCopied = await copyToClipboard(value);
              if (!isCopied) {
                toast("Copy failed. Please copy the text manually.");
                return;
              }

              for (const svg of svgs) {
                svg.toggleAttribute("data-copied", true);
              }

              toast(`Copied ${name}`);

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
            <div className="opacity-0 transition-opacity group-hover/attr:opacity-100">
              <Check className="hidden size-3.5 data-copied:block" />
              <Copy className="block size-3.5 data-copied:hidden" />
            </div>
          </button>
        ) : (
          <div className="relative min-w-0" suppressHydrationWarning>
            {value.includes("\n") ? (
              value.split("\n").map((line) => (
                <div key={line} className="truncate">
                  {line}
                </div>
              ))
            ) : (
              <div className="truncate">{value}</div>
            )}
          </div>
        )}
      </dd>
    </div>
  );
}
