import React from "react";

import cn from "~/utils/cn";

const variants = {
  neutral: "bg-subtle text-muted border-line",
  warn: "bg-warn-subtle text-warn border-transparent",
  bad: "bg-bad-subtle text-bad border-transparent",
};

export interface ChipProps {
  text: string;
  variant?: keyof typeof variants;
  className?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export default function Chip({
  text,
  variant = "neutral",
  className,
  leftIcon,
  rightIcon,
}: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex h-[18px] items-center gap-x-1 rounded-sm border px-1.5",
        "text-[11px] font-medium text-nowrap",
        variants[variant],
        className,
      )}
    >
      {leftIcon}
      {text}
      {rightIcon}
    </span>
  );
}
