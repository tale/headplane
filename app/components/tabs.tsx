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
        "flex items-center rounded-t-lg w-fit max-w-full",
        "border-mist-200 dark:border-mist-800",
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
        "data-[selected]:bg-mist-50 dark:data-[selected]:bg-mist-950",
        "focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-1 z-10",
        "dark:focus:ring-indigo-400/40 dark:focus:ring-offset-mist-900",
        "border-r border-mist-200 dark:border-mist-800",
        "first:rounded-tl-lg last:rounded-tr-lg last:border-r-0",
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
        "w-full overflow-clip rounded-b-lg rounded-r-lg",
        "border border-mist-200 dark:border-mist-800",
        className,
      )}
    >
      {children}
    </BaseTabs.Panel>
  );
}

export { Tabs, TabList as TabsList, Tab as TabsTab, Panel as TabsPanel };
