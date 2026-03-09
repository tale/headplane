import React, { useRef } from "react";
import { type AriaButtonOptions, useButton } from "react-aria";

import cn from "~/utils/cn";

export interface IconButtonProps extends AriaButtonOptions<"button"> {
  variant?: "heavy" | "light";
  className?: string;
  children: React.ReactNode;
  label: string;
  ref?: React.RefObject<HTMLButtonElement | null>;
}

export default function IconButton({ variant = "light", ...props }: IconButtonProps) {
  // In case the button is used as a trigger ref
  const ref = props.ref ?? useRef<HTMLButtonElement | null>(null);
  const { buttonProps } = useButton(props, ref);

  return (
    <button
      ref={ref}
      {...buttonProps}
      aria-label={props.label}
      className={cn(
        "rounded-full flex items-center justify-center p-1",
        "focus:outline-hidden focus:ring-3",
        props.isDisabled && "opacity-60 cursor-not-allowed",
        ...(variant === "heavy"
          ? [
              "bg-mist-900 dark:bg-mist-50 font-semibold",
              "hover:bg-mist-900/90 dark:hover:bg-mist-50/90",
              "text-mist-200 dark:text-mist-800",
            ]
          : [
              "bg-mist-100 dark:bg-mist-700/30 font-medium",
              "hover:bg-mist-200/90 dark:hover:bg-mist-800/30",
            ]),
        props.className,
      )}
    >
      {props.children}
    </button>
  );
}
