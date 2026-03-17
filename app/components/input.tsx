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
      <Field.Label
        className={cn(
          "text-sm font-medium",
          "text-mist-700 dark:text-mist-200",
          labelHidden && "sr-only",
        )}
      >
        {label}
        {required && <Asterisk className="ml-0.5 inline w-3.5 pb-1 text-red-500" />}
      </Field.Label>
      <BaseInput
        {...rest}
        required={required}
        className={cn(
          "rounded-md px-3 py-2 text-sm",
          "focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-1",
          "dark:focus:ring-indigo-400/40 dark:focus:ring-offset-mist-900",
          "bg-white dark:bg-mist-900",
          "border border-mist-200 dark:border-mist-800",
        )}
        onChange={
          onChange
            ? (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)
            : undefined
        }
      />
      {description && (
        <Field.Description className={cn("text-xs", "text-mist-500 dark:text-mist-400")}>
          {description}
        </Field.Description>
      )}
      {invalid && errorMessage ? (
        <Field.Error className={cn("text-xs", "text-red-500 dark:text-red-400")}>
          {errorMessage}
        </Field.Error>
      ) : null}
    </Field.Root>
  );
}
