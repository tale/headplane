import { NumberField } from "@base-ui/react/number-field";
import { Minus, Plus } from "lucide-react";

import cn from "~/utils/cn";

export interface NumberInputProps {
  label?: string;
  name?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
  value?: number;
  onValueChange?: (value: number | null) => void;
}

export default function NumberInput(props: NumberInputProps) {
  const { label, name, description } = props;

  return (
    <NumberField.Root
      className="flex flex-col gap-1"
      defaultValue={props.defaultValue}
      value={props.value}
      onValueChange={props.onValueChange}
      min={props.min}
      max={props.max}
      step={props.step}
      disabled={props.disabled}
      required={props.required}
    >
      {label && (
        <NumberField.ScrubArea>
          <label className={cn("text-sm font-medium", "text-mist-700 dark:text-mist-200")}>
            <NumberField.ScrubAreaCursor />
            {label}
          </label>
        </NumberField.ScrubArea>
      )}
      <NumberField.Group
        className={cn(
          "flex items-center gap-1 rounded-md pr-1",
          "focus-within:outline-hidden focus-within:ring-2 focus-within:ring-indigo-500/40 focus-within:ring-offset-1",
          "dark:focus-within:ring-indigo-400/40 dark:focus-within:ring-offset-mist-900",
          "bg-white dark:bg-mist-900",
          "border border-mist-200 dark:border-mist-800",
        )}
      >
        <NumberField.Input
          name={name}
          className="w-full rounded-l-md bg-transparent py-2 pl-3 text-sm focus:outline-hidden"
        />
        <NumberField.Decrement aria-label="Decrement" className="h-7.5 w-7.5 rounded-lg p-1">
          <Minus className="h-4 w-4" />
        </NumberField.Decrement>
        <NumberField.Increment aria-label="Increment" className="h-7.5 w-7.5 rounded-lg p-1">
          <Plus className="h-4 w-4" />
        </NumberField.Increment>
      </NumberField.Group>
      {description && (
        <div className={cn("text-xs", "text-mist-500 dark:text-mist-400")}>{description}</div>
      )}
    </NumberField.Root>
  );
}
