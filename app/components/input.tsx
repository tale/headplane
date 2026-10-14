import { Field } from "@base-ui/react/field";
import { Input as BaseInput } from "@base-ui/react/input";
import { Asterisk } from "lucide-react";
import type { ComponentProps } from "react";

import cn from "~/utils/cn";

export interface InputProps extends Omit<ComponentProps<typeof BaseInput>, "onChange"> {
  label: string;
  labelHidden?: boolean;
  required?: boolean;
  className?: string;
  invalid?: boolean;
  errorMessage?: string;
  description?: string;
  onChange?: (value: string) => void;
}

export default function Input(props: InputProps) {
  const {
    label,
    labelHidden,
    className,
    invalid,
    errorMessage,
    description,
    required,
    onChange,
    ...rest
  } = props;

  return (
    <Field.Root className={cn("flex w-full flex-col gap-1", className)} invalid={invalid}>
      <Field.Label className={cn("text-sm font-medium", "text-fg", labelHidden && "sr-only")}>
        {label}
        {required && <Asterisk className="text-bad ml-0.5 inline w-3.5 pb-1" />}
      </Field.Label>
      <BaseInput
        {...rest}
        required={required}
        className={cn(
          "rounded-md px-3 py-2 text-sm",
          "focus-ring",
          "bg-surface",
          "border border-line",
        )}
        onChange={
          onChange
            ? (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)
            : undefined
        }
      />
      {description && (
        <Field.Description className={cn("text-xs", "text-muted")}>{description}</Field.Description>
      )}
      {invalid && errorMessage ? (
        <Field.Error className={cn("text-xs", "text-bad")}>{errorMessage}</Field.Error>
      ) : null}
    </Field.Root>
  );
}
