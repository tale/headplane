import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronDown } from "lucide-react";

import Field, { controlClass } from "~/components/field";
import cn from "~/utils/cn";

export interface SelectItem {
  value: string;
  label: string;
}

export interface SelectProps {
  items: SelectItem[];
  label: string;
  name?: string;
  className?: string;
  placeholder?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  errorMessage?: string;
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
  errorMessage,
  value,
  defaultValue,
  onValueChange,
  name,
}: SelectProps) {
  const selectedItem =
    value !== undefined ? (items.find((i) => i.value === value) ?? null) : undefined;
  const defaultSelectedItem =
    defaultValue !== undefined ? (items.find((i) => i.value === defaultValue) ?? null) : undefined;

  return (
    <Field
      className={className}
      description={description}
      disabled={disabled}
      errorMessage={errorMessage}
      invalid={invalid}
      label={label}
      name={name}
    >
      <Combobox.Root
        items={items}
        value={selectedItem}
        defaultValue={defaultSelectedItem}
        onValueChange={(item) => onValueChange?.(item?.value ?? null)}
        name={name}
      >
        <div className={cn(controlClass, "relative")}>
          <Combobox.Input
            placeholder={placeholder}
            required={required}
            className="h-full w-full bg-transparent pr-8 pl-2.5 outline-hidden"
            data-1p-ignore
          />
          <Combobox.Trigger
            className={cn(
              "absolute inset-y-0 right-0 flex items-center pr-2.5",
              "text-faint hover:text-muted",
            )}
          >
            <ChevronDown className="size-4" />
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
                      "h-8 px-2.5 rounded-sm",
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
    </Field>
  );
}
