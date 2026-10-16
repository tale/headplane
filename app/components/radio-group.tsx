import { Radio } from "@base-ui/react/radio";
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";
import type React from "react";

import cn from "~/utils/cn";

interface RadioGroupProps {
  children: React.ReactNode;
  label: string;
  className?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string, eventDetails: BaseRadioGroup.ChangeEventDetails) => void;
}

function RadioGroup({ children, label, className, ...props }: RadioGroupProps) {
  return (
    <BaseRadioGroup
      {...props}
      aria-label={label}
      className={cn("flex flex-col gap-2.5", className)}
    >
      {children}
    </BaseRadioGroup>
  );
}

interface RadioItemProps {
  value: string;
  label: string;
  className?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}

function RadioItem({ children, label, className, value, disabled }: RadioItemProps) {
  return (
    <label className="flex items-center gap-2.5">
      <Radio.Root
        value={value}
        disabled={disabled}
        aria-label={label}
        className={cn(
          "size-4 shrink-0 rounded-full border border-line-strong bg-surface",
          "focus-ring data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
          "data-[checked]:border-[5px] data-[checked]:border-accent",
          className,
        )}
      >
        <Radio.Indicator />
      </Radio.Root>
      {children}
    </label>
  );
}

export default Object.assign(RadioGroup, { Radio: RadioItem });
