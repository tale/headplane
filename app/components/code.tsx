import { Check, Copy } from "lucide-react";
import { HTMLProps } from "react";

import cn from "~/utils/cn";
import toast from "~/utils/toast";

export interface CodeProps extends HTMLProps<HTMLSpanElement> {
  isCopyable?: boolean;
  children: string | string[] | number;
}

export default function Code({ isCopyable, children, className }: CodeProps) {
  return (
    <code
      className={cn(
        "bg-mist-100 dark:bg-mist-800 px-1 py-0.5 font-mono",
        "rounded-sm focus-within:outline-hidden focus-within:ring-2",
        isCopyable && "relative pr-7",
        className,
      )}
    >
      {children}
      {isCopyable && (
        <button
          className="absolute right-0 bottom-0"
          onClick={async (event) => {
            const text = Array.isArray(children) ? children.join("") : String(children);

            const svgs = event.currentTarget.querySelectorAll("svg");
            for (const svg of svgs) {
              svg.toggleAttribute("data-copied", true);
            }

            await navigator.clipboard.writeText(text);
            toast("Copied to clipboard");

            setTimeout(() => {
              for (const svg of svgs) {
                svg.toggleAttribute("data-copied", false);
              }
            }, 1000);
          }}
          type="button"
        >
          <Check className="hidden h-4.5 w-4.5 p-1 data-copied:block" />
          <Copy className="block h-4.5 w-4.5 p-1 data-copied:hidden" />
        </button>
      )}
    </code>
  );
}
