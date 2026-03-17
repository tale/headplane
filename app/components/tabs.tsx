import { useRef } from "react";
import { AriaTabListProps, AriaTabPanelProps, useTab, useTabList, useTabPanel } from "react-aria";
import { Item, Node, TabListState, useTabListState } from "react-stately";

import cn from "~/utils/cn";

export interface TabsProps extends AriaTabListProps<object> {
  label: string;
  className?: string;
}

function Tabs({ label, className, ...props }: TabsProps) {
  const state = useTabListState(props);
  const ref = useRef<HTMLDivElement | null>(null);

  const { tabListProps } = useTabList(props, state, ref);
  return (
    <div className={cn("flex flex-col", className)}>
      <div
        {...tabListProps}
        className={cn(
          "flex items-center rounded-t-lg w-fit max-w-full overflow-x-auto",
          "border-mist-100 dark:border-mist-800",
          "border-t border-x",
        )}
        ref={ref}
      >
        {[...state.collection].map((item) => (
          <Tab item={item} key={item.key} state={state} />
        ))}
      </div>
      <TabsPanel key={state.selectedItem?.key} state={state} />
    </div>
  );
}

export interface TabsTabProps {
  item: Node<object>;
  state: TabListState<object>;
}

function Tab({ item, state }: TabsTabProps) {
  const { key, rendered } = item;
  const ref = useRef<HTMLDivElement | null>(null);

  const { tabProps } = useTab({ key }, state, ref);
  return (
    <div
      {...tabProps}
      className={cn(
        "pl-2 pr-3 py-2.5",
        "aria-selected:bg-mist-100 dark:aria-selected:bg-mist-950",
        "focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-1 z-10",
        "dark:focus:ring-indigo-400/40 dark:focus:ring-offset-mist-900",
        "border-r border-mist-100 dark:border-mist-800",
        "first:rounded-tl-lg last:rounded-tr-lg last:border-r-0",
      )}
      ref={ref}
    >
      {rendered}
    </div>
  );
}

export interface TabsPanelProps extends AriaTabPanelProps {
  state: TabListState<object>;
}

function TabsPanel({ state, ...props }: TabsPanelProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { tabPanelProps } = useTabPanel(props, state, ref);
  return (
    <div
      {...tabPanelProps}
      className={cn(
        "w-full overflow-clip rounded-b-lg rounded-r-lg",
        "border border-mist-100 dark:border-mist-800",
      )}
      ref={ref}
    >
      {state.selectedItem?.props.children}
    </div>
  );
}

export default Object.assign(Tabs, { Item });
