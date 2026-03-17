import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown } from "lucide-react";

import cn from "~/utils/cn";

export interface SelectItem {
  value: string;
  label: string;
}

export interface SelectProps {
  items: SelectItem[];
  label?: string;
  "aria-label"?: string;
  name?: string;
  className?: string;
  placeholder?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
}

export default function Select({
  items,
  label,
  className,
  placeholder,
  description,
  required,
  disabled,
  invalid,
  value,
  defaultValue,
  onValueChange,
  name,
  ...props
}: SelectProps) {
  const selectedItem =
    value !== undefined ? (items.find((i) => i.value === value) ?? null) : undefined;
  const defaultSelectedItem =
    defaultValue !== undefined ? (items.find((i) => i.value === defaultValue) ?? null) : undefined;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && (
        <label className={cn("text-sm font-medium", "text-mist-700 dark:text-mist-200")}>
          {label}
        </label>
      )}
      <Combobox.Root
        items={items}
        value={selectedItem}
        defaultValue={defaultSelectedItem}
        onValueChange={(item) => onValueChange?.(item?.value ?? null)}
        disabled={disabled}
        name={name}
        aria-label={props["aria-label"]}
      >
        <div
          className={cn(
            "relative rounded-md",
            "focus-within:ring-2 focus-within:ring-indigo-500/40 focus-within:ring-offset-1",
            "dark:focus-within:ring-indigo-400/40 dark:focus-within:ring-offset-mist-900",
            "bg-white dark:bg-mist-900",
            "border border-mist-200 dark:border-mist-800",
            invalid && "ring-red-400",
          )}
        >
          <Combobox.Input
            placeholder={placeholder}
            required={required}
            className="w-full rounded-md bg-transparent px-3 py-2 pr-9 text-sm outline-hidden"
            data-1p-ignore
          />
          <Combobox.Trigger
            className={cn(
              "absolute inset-y-0 right-0 flex items-center pr-3",
              "text-mist-400 dark:text-mist-500",
              disabled
                ? "opacity-50 cursor-not-allowed"
                : "hover:text-mist-600 dark:hover:text-mist-300",
            )}
          >
            <ChevronDown className="h-4 w-4" />
          </Combobox.Trigger>
        </div>
        <Combobox.Portal>
          <Combobox.Positioner
            className="z-50"
            sideOffset={8}
            style={{ width: "var(--anchor-width)" }}
          >
            <Combobox.Popup
              className={cn(
                "max-h-72 w-full overflow-auto rounded-lg p-1",
                "bg-white dark:bg-mist-900",
                "border border-mist-200 dark:border-mist-800",
                "shadow-overlay",
              )}
            >
              <Combobox.Empty className="px-3 py-2 text-sm text-mist-500 empty:hidden">
                No results found.
              </Combobox.Empty>
              <Combobox.List>
                {(item: SelectItem) => (
                  <Combobox.Item
                    key={item.value}
                    value={item}
                    className={cn(
                      "flex items-center justify-between text-sm",
                      "py-1.5 px-2.5 rounded-md",
                      "outline-hidden select-none cursor-default",
                      "data-[highlighted]:bg-mist-100 dark:data-[highlighted]:bg-mist-800",
                      "data-[selected]:font-medium",
                      "data-[disabled]:text-mist-300 dark:data-[disabled]:text-mist-600",
                    )}
                  >
                    {item.label}
                    <Combobox.ItemIndicator>
                      <Check className="h-3.5 w-3.5" />
                    </Combobox.ItemIndicator>
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
      {description && (
        <div className={cn("text-xs", "text-mist-500 dark:text-mist-400")}>{description}</div>
      )}
    </div>
  );
}
