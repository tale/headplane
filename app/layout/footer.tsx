import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import Link from "~/components/link";
import cn from "~/utils/cn";

export interface FooterProps {
  isDebug: boolean;
  baseUrl: string;
}

export default function Footer({ isDebug, baseUrl }: FooterProps) {
  const [urlVisible, setUrlVisible] = useState(false);

  return (
    <footer
      className={cn(
        "fixed w-full bottom-0 left-0 z-20",
        "bg-mist-50 dark:bg-mist-950",
        "dark:border-t dark:border-mist-800",
      )}
    >
      <div className="container flex items-center justify-between py-2">
        <p className="text-xs">
          Headplane is free and open-source. Please consider{" "}
          <Link external styled to="https://tale.me/sponsor">
            sponsoring
          </Link>{" "}
          to support development.
        </p>
        <div className="flex items-center gap-2 text-xs">
          {isDebug && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-medium",
                "bg-amber-100 text-amber-800",
                "dark:bg-amber-900/50 dark:text-amber-300",
              )}
            >
              Debug
            </span>
          )}
          <p className="text-mist-500 dark:text-mist-400">
            {__VERSION__} &middot;{" "}
            {urlVisible ? (
              <code>{baseUrl}</code>
            ) : (
              <span aria-hidden="true">&bull;&bull;&bull;&bull;&bull;</span>
            )}
            <button
              type="button"
              aria-label={urlVisible ? "Hide server URL" : "Show server URL"}
              className={cn(
                "ml-1 inline-flex align-middle rounded-xs p-0.5",
                "text-mist-400 hover:text-mist-600",
                "dark:text-mist-500 dark:hover:text-mist-300",
                "focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-1",
                "dark:focus:ring-indigo-400/40 dark:focus:ring-offset-mist-900",
              )}
              onClick={() => setUrlVisible((v) => !v)}
            >
              {urlVisible ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
          </p>
        </div>
      </div>
    </footer>
  );
}
