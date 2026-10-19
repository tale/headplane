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
        className={cn("inline-flex items-center justify-center rounded-md", "focus-ring")}
      >
        {children}
      </BaseTooltip.Trigger>
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side="top" sideOffset={4} collisionPadding={8}>
          <BaseTooltip.Popup
            className={cn(
              "z-50 rounded-lg p-3 text-sm w-48",
              "outline-hidden",
              "bg-raised text-fg",
              "shadow-overlay border-overlay",
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
