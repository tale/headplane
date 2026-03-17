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
    <label className="flex items-center gap-2.5 text-sm">
      <Radio.Root
        value={value}
        disabled={disabled}
        aria-label={label}
        className={cn(
          "w-5 h-5 aspect-square rounded-full border-2",
          "border-mist-400 dark:border-mist-500",
          "focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-1 dark:focus-visible:ring-indigo-400/40 dark:focus-visible:ring-offset-mist-900",
          "data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed",
          "data-[checked]:border-[6px] data-[checked]:border-mist-900 dark:data-[checked]:border-mist-100",
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
