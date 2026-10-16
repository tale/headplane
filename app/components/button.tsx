import { Button as BaseButton } from "@base-ui/react/button";
import { LoaderCircle } from "lucide-react";
import React from "react";

import cn from "~/utils/cn";

const variants = {
  primary: "bg-ink text-ink-fg hover:bg-ink/90",
  secondary: "border border-line-strong bg-surface hover:bg-hover",
  ghost: "text-muted hover:bg-hover hover:text-fg",
  danger: "bg-danger text-white hover:bg-danger/90",
  icon: "px-0 text-muted hover:bg-hover hover:text-fg",
};

const sizes = {
  md: "h-8 px-3",
  sm: "h-7 px-2",
};

const iconSizes = {
  md: "size-8",
  sm: "size-7",
};

export interface ButtonProps extends React.ComponentProps<typeof BaseButton> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  pending?: boolean;
}

export default function Button({
  variant = "secondary",
  size = "md",
  pending,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <BaseButton
      {...props}
      aria-busy={pending || undefined}
      className={cn(
        "inline-flex w-fit shrink-0 items-center justify-center gap-1.5 rounded-md",
        "text-sm font-medium whitespace-nowrap transition-colors duration-100",
        "focus-ring data-disabled:cursor-not-allowed data-disabled:opacity-50",
        variant === "icon" ? iconSizes[size] : sizes[size],
        variants[variant],
        className,
      )}
      disabled={disabled || pending}
      focusableWhenDisabled={pending}
    >
      {pending && <LoaderCircle className="size-3.5 animate-spin" />}
      {children}
    </BaseButton>
  );
}
