import { Input as BaseInput } from "@base-ui/react/input";
import type { ComponentProps } from "react";

import Field, { controlClass, type FieldProps } from "~/components/field";
import cn from "~/utils/cn";

export interface InputProps
  extends
    Omit<ComponentProps<typeof BaseInput>, "onChange" | "children" | "className">,
    Omit<FieldProps, "children"> {
  onChange?: (value: string) => void;
}

export default function Input({
  label,
  labelHidden,
  labelTooltip,
  description,
  invalid,
  errorMessage,
  className,
  name,
  disabled,
  validate,
  onChange,
  ...props
}: InputProps) {
  return (
    <Field
      className={className}
      description={description}
      disabled={disabled}
      errorMessage={errorMessage}
      invalid={invalid}
      label={label}
      labelHidden={labelHidden}
      labelTooltip={labelTooltip}
      name={name}
      validate={validate}
    >
      <BaseInput
        {...props}
        className={cn(controlClass, "px-2.5")}
        onChange={onChange ? (event) => onChange(event.currentTarget.value) : undefined}
      />
    </Field>
  );
}
