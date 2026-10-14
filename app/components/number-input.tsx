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
    // `name` belongs on the Root, not the Input. The Input is a text field that
    // holds the locale-formatted value ("365,000", "365 000", "365.000"), while
    // the Root renders a hidden number input carrying the raw value. Naming the
    // Input would submit the formatted string and break server-side parsing.
    <NumberField.Root
      className="flex flex-col gap-1"
      name={name}
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
          <label className={cn("text-sm font-medium", "text-fg")}>
            <NumberField.ScrubAreaCursor />
            {label}
          </label>
        </NumberField.ScrubArea>
      )}
      <NumberField.Group
        className={cn(
          "flex items-center gap-1 rounded-md pr-1",
          "focus-within-ring",
          "bg-surface",
          "border border-line",
        )}
      >
        <NumberField.Input className="w-full rounded-l-md bg-transparent py-2 pl-3 text-sm" />
        <NumberField.Decrement aria-label="Decrement" className="h-7.5 w-7.5 rounded-lg p-1">
          <Minus className="h-4 w-4" />
        </NumberField.Decrement>
        <NumberField.Increment aria-label="Increment" className="h-7.5 w-7.5 rounded-lg p-1">
          <Plus className="h-4 w-4" />
        </NumberField.Increment>
      </NumberField.Group>
      {description && <div className={cn("text-xs", "text-muted")}>{description}</div>}
    </NumberField.Root>
  );
}
