import { Switch as BaseSwitch } from "@base-ui/react/switch";
import type React from "react";

import cn from "~/utils/cn";

export interface SwitchProps {
  label: string;
  className?: string;
  name?: string;
  disabled?: boolean;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export default function Switch(props: SwitchProps) {
  return (
    <BaseSwitch.Root
      aria-label={props.label}
      checked={props.checked}
      className={cn(
        "flex h-[18px] w-[30px] shrink-0 rounded-full p-0.5",
        "bg-line-strong data-[checked]:bg-accent",
        "focus-ring data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        props.className,
      )}
      defaultChecked={props.defaultChecked}
      disabled={props.disabled}
      name={props.name}
      onCheckedChange={props.onCheckedChange}
    >
      <BaseSwitch.Thumb
        className={cn(
          "size-3.5 rounded-full bg-white shadow-xs",
          "transition-transform duration-100 data-[checked]:translate-x-3 data-[checked]:bg-accent-fg",
        )}
      />
    </BaseSwitch.Root>
  );
}

interface SwitchFieldProps extends SwitchProps {
  description?: React.ReactNode;
}

export function SwitchField({ label, description, ...props }: SwitchFieldProps) {
  return (
    <label className="flex items-center justify-between gap-4">
      <span>
        <span className="block font-medium">{label}</span>
        {description && <span className="text-muted block">{description}</span>}
      </span>
      <Switch label={label} {...props} />
    </label>
  );
}
