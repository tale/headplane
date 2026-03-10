import React, { useRef } from "react";
import { type AriaButtonOptions, useButton } from "react-aria";

import cn from "~/utils/cn";

export interface ButtonProps extends AriaButtonOptions<"button"> {
  variant?: "heavy" | "light" | "danger" | "ghost";
  className?: string;
  children?: React.ReactNode;
  ref?: React.RefObject<HTMLButtonElement | null>;
}

export default function Button({ variant = "light", ...props }: ButtonProps) {
  // In case the button is used as a trigger ref
  const ref = props.ref ?? useRef<HTMLButtonElement | null>(null);
  const { buttonProps } = useButton(props, ref);

  return (
    <button
      ref={ref}
      {...buttonProps}
      className={cn(
        "w-fit rounded-md px-3.5 py-2 text-sm leading-tight",
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
          : variant === "danger"
            ? [
                "bg-red-600 font-semibold text-white",
                "hover:bg-red-600/90",
                "dark:bg-red-500 dark:hover:bg-red-500/90",
              ]
            : variant === "ghost"
              ? [
                  "font-medium text-indigo-600 dark:text-indigo-400",
                  "hover:bg-indigo-50 dark:hover:bg-indigo-500/10",
                ]
              : [
                  "border border-mist-200 bg-white font-medium",
                  "hover:bg-mist-50",
                  "dark:border-mist-700 dark:bg-mist-800/50",
                  "dark:hover:bg-mist-700/50",
                ]),
        props.className,
      )}
    >
      {props.children}
    </button>
  );
}
