import { ChevronDown, X } from "lucide-react";
import type { JSX } from "react";

import Button from "~/components/button";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "~/components/menu";
import type { User } from "~/types/User";
import cn from "~/utils/cn";
import type { PopulatedNode } from "~/utils/node-info";
import { getUserDisplayName, sortUsersByDisplayName } from "~/utils/user";

import { useMachineFilterParams } from "../hooks/use-machine-filter-params";

const STATUS_OPTIONS = [
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
  { value: "expired", label: "Expired" },
] as const;

const ROUTE_OPTIONS = [
  { value: "exit-node", label: "Exit node" },
  { value: "subnet", label: "Subnet router" },
] as const;

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: readonly { value: string; label: string }[];
  onChange: (value: string | null) => void;
}): JSX.Element {
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

interface MachineFiltersProps {
  users: User[];
  populatedNodes: PopulatedNode[];
}

export function MachineFilters({ users, populatedNodes }: MachineFiltersProps): JSX.Element {
  const {
    filterUser,
    filterTag,
    filterStatus,
    filterRoute,
    hasActiveFilters,
    setParam,
    clearFilters,
  } = useMachineFilterParams();

  const tagOwnedExists = populatedNodes.some((n) => !n.user);
  const userOptions = [
    ...(tagOwnedExists ? [{ value: "tag-owned", label: "Tag-owned" }] : []),
    ...sortUsersByDisplayName(users).map((u) => ({ value: u.name, label: getUserDisplayName(u) })),
  ];

  const tagOptions = Array.from(new Set(populatedNodes.flatMap((n) => n.tags)))
    .filter(Boolean)
    .sort()
    .map((tag) => ({ value: tag, label: tag }));

  return (
    <>
      {userOptions.length > 0 && (
        <FilterDropdown
          label="User"
          onChange={(v) => setParam("user", v)}
          options={userOptions}
          value={filterUser}
        />
      )}
      {tagOptions.length > 0 && (
        <FilterDropdown
          label="Tag"
          onChange={(v) => setParam("tag", v)}
          options={tagOptions}
          value={filterTag}
        />
      )}
      <FilterDropdown
        label="Status"
        onChange={(v) => setParam("status", v)}
        options={STATUS_OPTIONS}
        value={filterStatus}
      />
      <FilterDropdown
        label="Route"
        onChange={(v) => setParam("route", v)}
        options={ROUTE_OPTIONS}
        value={filterRoute}
      />
      {hasActiveFilters && (
        <Button onClick={clearFilters} variant="ghost">
          Clear filters
          <X className="size-3.5" />
        </Button>
      )}
    </>
  );
}
