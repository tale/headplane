import { Switch as BaseSwitch } from "@base-ui/react/switch";

import cn from "~/utils/cn";

export interface SwitchProps {
  label: string;
  className?: string;
  switchClassName?: string;
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
        "flex h-[22px] w-[38px] p-[3px] shrink-0 rounded-full",
        "bg-line-strong",
        "border border-transparent",
        "data-[checked]:bg-accent",
        "focus-ring",
        props.disabled && "opacity-50",
        props.className,
      )}
      defaultChecked={props.defaultChecked}
      disabled={props.disabled}
      name={props.name}
      onCheckedChange={props.onCheckedChange}
    >
      <BaseSwitch.Thumb
        className={cn(
          "h-[14px] w-[14px] transform rounded-full",
          "bg-surface data-[checked]:bg-accent-fg transition duration-50 ease-in-out",
          "translate-x-0 data-[checked]:translate-x-full",
          props.switchClassName,
        )}
      />
    </BaseSwitch.Root>
  );
}
