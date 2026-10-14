import { Button as BaseButton } from "@base-ui/react/button";
import React from "react";

import cn from "~/utils/cn";

export interface ButtonProps extends React.ComponentProps<typeof BaseButton> {
  variant?: "heavy" | "light" | "danger" | "ghost";
}

export default function Button({ variant = "light", className, ...props }: ButtonProps) {
  return (
    <BaseButton
      {...props}
      className={cn(
        "inline-flex w-fit items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm",
        "transition-colors duration-100",
        "focus-ring",
        props.disabled && "pointer-events-none opacity-50",
        ...(variant === "heavy"
          ? ["bg-ink font-medium text-ink-fg", "hover:bg-ink/90"]
          : variant === "danger"
            ? ["bg-danger font-medium text-white", "hover:bg-danger/90"]
            : variant === "ghost"
              ? ["font-medium text-accent", "hover:bg-accent-subtle"]
              : ["border border-line-strong bg-surface font-medium", "hover:bg-hover"]),
        className,
      )}
    />
  );
}
