import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import type { ComponentProps, ReactNode } from "react";

import cn from "~/utils/cn";

export interface TabsProps {
  label: string;
  className?: string;
  defaultValue?: string | number;
  value?: string | number;
  onValueChange?: (value: string | number) => void;
  children: ReactNode;
}

function Tabs({ label, className, children, ...props }: TabsProps) {
  return (
    <BaseTabs.Root
      {...props}
      defaultValue={props.defaultValue ?? 0}
      aria-label={label}
      className={cn("flex flex-col", className)}
    >
      {children}
    </BaseTabs.Root>
  );
}

function TabList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <BaseTabs.List
      className={cn(
        "flex items-center rounded-t-md w-fit max-w-full",
        "border-line",
        "border-t border-x",
        className,
      )}
    >
      {children}
    </BaseTabs.List>
  );
}

function Tab({
  value,
  children,
  className,
  ...props
}: ComponentProps<typeof BaseTabs.Tab> & { className?: string }) {
  return (
    <BaseTabs.Tab
      value={value}
      {...props}
      className={cn(
        "pl-2 pr-3 py-2.5",
        "data-[selected]:bg-subtle",
        "focus-ring z-10",
        "border-r border-line",
        "first:rounded-tl-md last:rounded-tr-md last:border-r-0",
        className,
      )}
    >
      {children}
    </BaseTabs.Tab>
  );
}

function Panel({
  value,
  children,
  className,
  ...props
}: ComponentProps<typeof BaseTabs.Panel> & { className?: string }) {
  return (
    <BaseTabs.Panel
      value={value}
      {...props}
      className={cn(
        "w-full overflow-clip rounded-b-md rounded-r-md",
        "border border-line",
        className,
      )}
    >
      {children}
    </BaseTabs.Panel>
  );
}

export { Tabs, TabList as TabsList, Tab as TabsTab, Panel as TabsPanel };
