import { ChevronDown } from "lucide-react";

import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "~/components/menu";
import cn from "~/utils/cn";

export interface FilterDropdownProps {
  label: string;
  value: string | null;
  options: readonly { value: string; label: string }[];
  onChange: (value: string | null) => void;
}

export default function FilterDropdown({ label, value, options, onChange }: FilterDropdownProps) {
  const activeOption = options.find((o) => o.value === value) ?? null;
  const isActive = activeOption !== null;

  return (
    <Menu>
      <MenuTrigger
        className={cn(
          "h-8 gap-1 rounded-md border px-2.5 text-[13px] transition-colors",
          isActive
            ? "bg-accent-subtle text-fg border-transparent"
            : "border-line-strong text-muted hover:text-fg border-dashed",
        )}
      >
        {isActive ? (
          <>
            {label}: <span className="text-accent font-medium">{activeOption.label}</span>
          </>
        ) : (
          label
        )}
        <ChevronDown className="size-3" />
      </MenuTrigger>
      <MenuContent>
        {options.map((option) => (
          <MenuItem
            key={option.value}
            onClick={() => onChange(value === option.value ? null : option.value)}
          >
            {option.value === value ? (
              <span className="text-accent font-medium">{option.label}</span>
            ) : (
              option.label
            )}
          </MenuItem>
        ))}
        {isActive && (
          <>
            <MenuSeparator />
            <MenuItem onClick={() => onChange(null)}>Clear filter</MenuItem>
          </>
        )}
      </MenuContent>
    </Menu>
  );
}
