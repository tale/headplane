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
        "flex items-center justify-center rounded-full p-1",
        "transition-colors duration-100",
        "focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-1",
        "dark:focus:ring-indigo-400/40 dark:focus:ring-offset-mist-900",
        props.isDisabled && "pointer-events-none opacity-50",
        ...(variant === "heavy"
          ? [
              "bg-indigo-500 font-semibold text-white",
              "hover:bg-indigo-500/90",
              "dark:bg-indigo-500/90 dark:hover:bg-indigo-500/80",
            ]
          : ["bg-mist-100 dark:bg-mist-700/30", "hover:bg-mist-200/90 dark:hover:bg-mist-800/30"]),
        props.className,
      )}
    >
      {props.children}
    </button>
  );
}
