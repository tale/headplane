import { Minus, Plus } from "lucide-react";
import { useRef } from "react";
import { type AriaNumberFieldProps, useId, useLocale, useNumberField } from "react-aria";
import { useNumberFieldState } from "react-stately";

import Button from "~/components/button";
import cn from "~/utils/cn";

export interface InputProps extends AriaNumberFieldProps {
  isRequired?: boolean;
  name?: string;
}

export default function NumberInput(props: InputProps) {
  const { label, name } = props;
  const { locale } = useLocale();
  const state = useNumberFieldState({ ...props, locale });
  const ref = useRef<HTMLInputElement | null>(null);
  const id = useId(props.id);

  const {
    labelProps,
    inputProps,
    groupProps,
    incrementButtonProps,
    decrementButtonProps,
    descriptionProps,
    errorMessageProps,
    isInvalid,
    validationErrors,
  } = useNumberField(props, state, ref);

  return (
    <div className="flex flex-col">
      <label
        {...labelProps}
        htmlFor={id}
        className={cn("text-xs font-medium px-3 mb-0.5", "text-mist-700 dark:text-mist-100")}
      >
        {label}
      </label>
      <div
        {...groupProps}
        className={cn(
          "flex items-center gap-1 rounded-md pr-1",
          "focus-within:outline-hidden focus-within:ring-2 focus-within:ring-indigo-500/40 focus-within:ring-offset-1",
          "dark:focus-within:ring-indigo-400/40 dark:focus-within:ring-offset-mist-900",
          "bg-white dark:bg-mist-900",
          "border border-mist-100 dark:border-mist-800",
        )}
      >
        <input
          {...inputProps}
          required={props.isRequired}
          ref={ref}
          id={id}
          className="w-full rounded-l-md bg-transparent py-2 pl-3 focus:outline-hidden"
        />
        <input type="hidden" name={name} value={state.numberValue} />
        <Button
          {...decrementButtonProps}
          aria-label="Decrement"
          className="h-7.5 w-7.5 rounded-lg p-1"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Button
          {...incrementButtonProps}
          aria-label="Increment"
          className="h-7.5 w-7.5 rounded-lg p-1"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {props.description && (
        <div
          {...descriptionProps}
          className={cn("text-xs px-3 mt-1", "text-mist-500 dark:text-mist-400")}
        >
          {props.description}
        </div>
      )}
      {isInvalid && (
        <div
          {...errorMessageProps}
          className={cn("text-xs px-3 mt-1", "text-red-500 dark:text-red-400")}
        >
          {validationErrors.join(" ")}
        </div>
      )}
    </div>
  );
}
