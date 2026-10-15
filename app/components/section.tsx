import { Info } from "lucide-react";
import type React from "react";

import Button, { type ButtonProps } from "~/components/button";
import Tooltip from "~/components/tooltip";
import cn from "~/utils/cn";

interface Props {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}

// Splits into two columns by its own width rather than the viewport, so it
// also fits beside the settings nav.
export default function Section({ title, description, action, children }: Props) {
  return (
    <section
      className={cn(
        "@container border-line -mx-2 border-t px-2 py-8",
        "first-of-type:border-t-0 first-of-type:pt-0",
      )}
    >
      <div className="grid gap-x-12 gap-y-4 @2xl:grid-cols-[15rem_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col items-start gap-3">
          <div>
            <h2 className="font-semibold">{title}</h2>
            {description && <p className="text-muted mt-1 text-sm">{description}</p>}
          </div>
          {action}
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

// Quiet until hovered, since it repeats on every row.
export function RemoveButton({ className, children, ...props }: ButtonProps) {
  return (
    <Button
      {...props}
      className={cn("hover:bg-bad-subtle hover:text-bad", className)}
      size="sm"
      variant="ghost"
    >
      {children ?? "Remove"}
    </Button>
  );
}

// Lists bleed into the gutter like Section so their edges line up.
const listClass = "divide-line -mx-2 divide-y text-sm";
const rowClass = "flex min-h-11 items-center gap-4 px-2 py-1.5";

interface RowProps {
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function RowList({ children }: { children: React.ReactNode }) {
  return <ul className={listClass}>{children}</ul>;
}

export function Row({ action, className, children }: RowProps) {
  return (
    <li className={cn(rowClass, className)}>
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </li>
  );
}

interface SettingRowProps {
  label: string;
  tooltip?: React.ReactNode;
  action?: React.ReactNode;
  // Top-aligns the label for values that span several lines.
  isMultiline?: boolean;
  children?: React.ReactNode;
}

export function SettingList({ children }: { children: React.ReactNode }) {
  return <dl className={listClass}>{children}</dl>;
}

export function SettingRow({ label, tooltip, action, isMultiline, children }: SettingRowProps) {
  return (
    <div className={cn("group/setting", rowClass, isMultiline && "items-start py-2.5")}>
      <dt className="text-muted flex w-32 shrink-0 items-center gap-1 sm:w-40">
        {label}
        {tooltip && (
          <Tooltip content={tooltip}>
            <Info className="size-3.5 opacity-40 transition-opacity hover:opacity-100" />
          </Tooltip>
        )}
      </dt>
      <dd className="flex min-w-0 flex-1 items-center justify-between gap-4">
        <span className="min-w-0 flex-1 sm:truncate">{children}</span>
        {action}
      </dd>
    </div>
  );
}
