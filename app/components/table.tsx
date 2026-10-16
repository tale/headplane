import { ChevronDown, ChevronUp } from "lucide-react";
import type React from "react";

import cn from "~/utils/cn";

export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="-mx-2 overflow-x-auto">
      <table {...props} className={cn("w-full min-w-160 border-collapse text-sm", className)} />
    </div>
  );
}

export function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      {...props}
      className={cn(
        "align-top [&>tr]:border-t [&>tr]:border-line [&>tr:hover]:bg-subtle",
        className,
      )}
    />
  );
}

export function TableHeader({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      {...props}
      className={cn(
        "h-9 px-2 text-left text-xs font-medium whitespace-nowrap text-muted",
        className,
      )}
    />
  );
}

export function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return <td {...props} className={cn("px-2 py-2.5", className)} />;
}

export type SortDirection = "asc" | "desc";

export interface SortHeaderProps<T extends string> extends Omit<
  React.ComponentProps<"th">,
  "onClick"
> {
  field: T;
  sortField: T;
  sortDirection: SortDirection;
  onSort: (field: T) => void;
  suffix?: React.ReactNode;
}

export function SortHeader<T extends string>({
  field,
  sortField,
  sortDirection,
  onSort,
  suffix,
  children,
  ...props
}: SortHeaderProps<T>) {
  const isActive = field === sortField;
  const Icon = sortDirection === "asc" ? ChevronUp : ChevronDown;

  return (
    <TableHeader
      {...props}
      aria-sort={isActive ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        className="focus-ring hover:text-fg -mx-1 inline-flex items-center gap-1 rounded-sm px-1 align-middle"
        onClick={() => onSort(field)}
        type="button"
      >
        {children}
        {isActive && <Icon className="size-3" />}
      </button>
      {suffix}
    </TableHeader>
  );
}
