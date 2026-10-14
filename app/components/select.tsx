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
      {label && <label className={cn("text-sm font-medium", "text-fg")}>{label}</label>}
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
            "focus-within-ring",
            "bg-surface",
            "border border-line",
            invalid && "ring-bad",
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
              "text-muted",
              disabled ? "opacity-50 cursor-not-allowed" : "hover:text-muted",
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
                "max-h-72 w-full overflow-auto rounded-lg p-1 outline-hidden",
                "bg-raised border-overlay shadow-overlay",
              )}
            >
              <Combobox.Empty className="text-muted px-3 py-2 text-sm empty:hidden">
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
                      "data-[highlighted]:bg-hover",
                      "data-[selected]:font-medium",
                      "data-[disabled]:text-faint",
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
      {description && <div className={cn("text-xs", "text-muted")}>{description}</div>}
    </div>
  );
}
