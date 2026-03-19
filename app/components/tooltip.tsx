import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import type { ReactNode } from "react";

import cn from "~/utils/cn";

export interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  className?: string;
}

export default function Tooltip({ children, content, className }: TooltipProps) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger
        delay={0}
        closeDelay={0}
        className={cn(
          "inline-flex items-center justify-center rounded-md",
          "focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-1",
          "dark:focus:ring-indigo-400/40 dark:focus:ring-offset-mist-900",
        )}
      >
        {children}
      </BaseTooltip.Trigger>
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner sideOffset={4}>
          <BaseTooltip.Popup
            className={cn(
              "z-50 rounded-lg p-3 text-sm w-48",
              "outline-hidden",
              "bg-white dark:bg-mist-950",
              "text-black dark:text-white",
              "shadow-overlay",
              "border border-mist-100 dark:border-mist-800",
              className,
            )}
          >
            {content}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
