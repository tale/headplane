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
        "bg-mist-300 dark:bg-mist-700",
        "border border-transparent dark:border-mist-800",
        "data-[checked]:bg-mist-900 dark:data-[checked]:bg-mist-950",
        "focus-visible:ring-2 focus-visible:ring-indigo-500/40 focus-visible:ring-offset-1 dark:focus-visible:ring-indigo-400/40 dark:focus-visible:ring-offset-mist-900",
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
          "bg-white transition duration-50 ease-in-out",
          "translate-x-0 data-[checked]:translate-x-full",
          props.switchClassName,
        )}
      />
    </BaseSwitch.Root>
  );
}
