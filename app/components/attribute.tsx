import { Check, Copy } from "lucide-react";

import { SettingRow } from "~/components/section";
import cn from "~/utils/cn";
import { copyToClipboard } from "~/utils/copy";
import toast from "~/utils/toast";

export interface AttributeProps {
  name: string;
  value: string;
  tooltip?: string;
  isCopyable?: boolean;
  // Addresses, keys, and versions read better in mono, as in the tables.
  isMono?: boolean;
}

// A read-only SettingRow, optionally copied on click. Multi-line values are
// split on newlines. The copy button has no background or outline because the
// row clips overflow to truncate, which would cut them off.
export default function Attribute({ name, value, tooltip, isCopyable, isMono }: AttributeProps) {
  const lines = value.split("\n");
  const textClass = isMono ? "font-mono text-xs" : undefined;

  return (
    <SettingRow isMultiline={lines.length > 1} label={name} tooltip={tooltip}>
      {isCopyable ? (
        <button
          className={cn(
            "group/copy flex max-w-full min-w-0 items-center gap-1.5 text-left outline-none",
            "decoration-accent decoration-2 underline-offset-2 focus-visible:underline",
          )}
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
          type="button"
        >
          <span className={cn("truncate", textClass)} suppressHydrationWarning>
            {value}
          </span>
          <span
            className={cn(
              "text-muted group-hover/copy:text-fg opacity-0 transition-opacity",
              "group-hover/setting:opacity-100 group-focus-visible/copy:opacity-100 pointer-coarse:opacity-100",
            )}
          >
            <Check className="hidden size-3.5 data-copied:block" />
            <Copy className="block size-3.5 data-copied:hidden" />
          </span>
        </button>
      ) : (
        lines.map((line) => (
          <span
            className={cn("block break-all sm:truncate", textClass)}
            key={line}
            suppressHydrationWarning
          >
            {line}
          </span>
        ))
      )}
    </SettingRow>
  );
}
