import { Copy } from "lucide-react";

import cn from "~/utils/cn";
import { copyToClipboard } from "~/utils/copy";
import toast from "~/utils/toast";

export interface CodeBlockProps {
  children: string;
  className?: string;
}

export default function CodeBlock({ children, className }: CodeBlockProps) {
  const text = children.trim();

  return (
    <button
      type="button"
      className={cn(
        "w-full cursor-pointer rounded-md bg-subtle text-left",
        "hover:bg-hover transition-colors",
        className,
      )}
      onClick={async () => {
        const isCopied = await copyToClipboard(text);
        toast(isCopied ? "Copied to clipboard" : "Copy failed. Please copy the text manually.");
      }}
    >
      <code className="block px-3 pt-2 pb-1 text-sm break-all">{text}</code>
      <span className="text-muted mt-0.5 flex items-center gap-1 px-3 pb-2 text-xs">
        <Copy className="size-3" />
        Click to copy
      </span>
    </button>
  );
}
