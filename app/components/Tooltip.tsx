import React, { cloneElement, useRef } from "react";
import { AriaTooltipProps, mergeProps, useTooltip, useTooltipTrigger } from "react-aria";
import { TooltipTriggerState, useTooltipTriggerState } from "react-stately";

import cn from "~/utils/cn";

export interface TooltipProps extends AriaTooltipProps {
  children: [React.ReactElement, React.ReactElement<TooltipBodyProps>];
}

function Tooltip(props: TooltipProps) {
  const state = useTooltipTriggerState({
    ...props,
    delay: 0,
    closeDelay: 0,
  });

  const ref = useRef<HTMLButtonElement | null>(null);
  const { triggerProps, tooltipProps } = useTooltipTrigger(
    {
      ...props,
      delay: 0,
      closeDelay: 0,
    },
    state,
    ref,
  );

  const [component, body] = props.children;
  return (
    <span className="relative">
      <button
        ref={ref}
        {...triggerProps}
        className={cn(
          "flex items-center justify-center",
          "focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-1 rounded-md",
          "dark:focus:ring-indigo-400/40 dark:focus:ring-offset-mist-900",
        )}
      >
        {component}
      </button>
      {state.isOpen &&
        cloneElement(body, {
          ...tooltipProps,
          state,
        })}
    </span>
  );
}

interface TooltipBodyProps extends AriaTooltipProps {
  children: React.ReactNode;
  state?: TooltipTriggerState;
  className?: string;
}

function Body({ state, className, ...props }: TooltipBodyProps) {
  const { tooltipProps } = useTooltip(props, state);
  return (
    <span
      {...mergeProps(props, tooltipProps)}
      className={cn(
        "absolute z-50 p-3 top-full mt-1",
        "outline-hidden rounded-lg text-sm w-48",
        "bg-white dark:bg-mist-950",
        "text-black dark:text-white",
        "shadow-overlay",
        "border border-mist-100 dark:border-mist-800",
        className,
      )}
    >
      {props.children}
    </span>
  );
}

export default Object.assign(Tooltip, {
  Body,
});
