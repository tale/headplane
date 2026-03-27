import { Copy } from "lucide-react";

import cn from "~/utils/cn";
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
        "w-full cursor-pointer rounded-md bg-mist-100 text-left dark:bg-mist-800",
        "hover:bg-mist-200 dark:hover:bg-mist-700 transition-colors",
        className,
      )}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        toast("Copied to clipboard");
      }}
    >
      <code className="block px-3 pt-2 pb-1 text-sm break-all">{text}</code>
      <span className="mt-0.5 flex items-center gap-1 px-3 pb-2 text-xs text-mist-500 dark:text-mist-400">
        <Copy className="size-3" />
        Click to copy
      </span>
    </button>
  );
}
