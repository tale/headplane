import { Field as BaseField } from "@base-ui/react/field";
import { Info } from "lucide-react";
import type React from "react";

import Tooltip from "~/components/tooltip";
import cn from "~/utils/cn";

export const controlClass = cn(
  "h-8 w-full rounded-md border border-line-strong bg-surface text-sm text-fg",
  "placeholder:text-muted outline-hidden transition-[border-color,box-shadow] duration-100",
  "focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/25",
  "group-data-invalid:border-bad group-data-invalid:focus-within:border-bad",
  "group-data-invalid:focus-within:ring-bad/25",
  "group-data-disabled:cursor-not-allowed group-data-disabled:opacity-50",
);

export interface FieldProps {
  label: string;
  labelHidden?: boolean;
  labelTooltip?: React.ReactNode;
  description?: React.ReactNode;
  name?: string;
  disabled?: boolean;
  invalid?: boolean;
  errorMessage?: string;
  validate?: (value: unknown) => string | null;
  className?: string;
  children: React.ReactNode;
}

export default function Field({
  label,
  labelHidden,
  labelTooltip,
  description,
  name,
  disabled,
  invalid,
  errorMessage,
  validate,
  className,
  children,
}: FieldProps) {
  return (
    <BaseField.Root
      className={cn("group flex w-full flex-col gap-1.5", className)}
      disabled={disabled}
      invalid={invalid}
      name={name}
      validate={validate}
    >
      {labelTooltip ? (
        <div className={cn("flex items-center gap-1", labelHidden && "sr-only")}>
          <BaseField.Label className="text-fg text-sm font-medium">{label}</BaseField.Label>
          <Tooltip className="w-72" content={labelTooltip}>
            <Info
              aria-label={`About ${label}`}
              className="text-muted hover:text-fg size-3.5 transition-colors"
            />
          </Tooltip>
        </div>
      ) : (
        <BaseField.Label className={cn("text-sm font-medium text-fg", labelHidden && "sr-only")}>
          {label}
        </BaseField.Label>
      )}
      {children}
      {description && (
        <BaseField.Description className="text-muted text-xs">{description}</BaseField.Description>
      )}
      <BaseField.Error
        className="text-bad text-xs"
        {...(errorMessage && { match: invalid, children: errorMessage })}
      />
    </BaseField.Root>
  );
}
