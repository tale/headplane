import React from "react";

import cn from "~/utils/cn";

export interface ChipProps {
  text: string;
  className?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export default function Chip({ text, className, leftIcon, rightIcon }: ChipProps) {
  return (
    <span
      className={cn(
        "h-5 text-xs py-0.5 px-1 rounded-md text-nowrap",
        "text-fg",
        "bg-subtle",
        "inline-flex items-center gap-x-1",
        className,
      )}
    >
      {leftIcon}
      {text}
      {rightIcon}
    </span>
  );
}
