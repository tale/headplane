import React, { useRef } from "react";
import { type AriaButtonOptions, useButton } from "react-aria";

import cn from "~/utils/cn";

export interface ButtonProps extends AriaButtonOptions<"button"> {
  variant?: "heavy" | "light" | "danger";
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
        "w-fit text-sm rounded-md px-3 py-2",
        "focus:outline-hidden focus:ring-3",
        props.isDisabled && "opacity-60 cursor-not-allowed",
        ...(variant === "heavy"
          ? [
              "bg-mist-900 dark:bg-mist-50 font-semibold",
              "hover:bg-mist-900/90 dark:hover:bg-mist-50/90",
              "text-mist-200 dark:text-mist-800",
            ]
          : variant === "danger"
            ? ["bg-red-500 text-white font-semibold", "hover:bg-red-500/90"]
            : [
                "bg-mist-100 dark:bg-mist-800/50 font-medium",
                "border border-mist-200 dark:border-mist-700",
                "hover:bg-mist-200/90 dark:hover:bg-mist-700/50",
              ]),
        props.className,
      )}
    >
      {props.children}
    </button>
  );
}
