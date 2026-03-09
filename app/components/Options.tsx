import { useRef } from "react";
import { AriaTabListProps, AriaTabPanelProps, useTab, useTabList, useTabPanel } from "react-aria";
import { Item, Node, TabListState, useTabListState } from "react-stately";

import cn from "~/utils/cn";

export interface OptionsProps extends AriaTabListProps<object> {
  label: string;
  className?: string;
}

function Options({ label, className, ...props }: OptionsProps) {
  const state = useTabListState(props);
  const ref = useRef<HTMLDivElement | null>(null);

  const { tabListProps } = useTabList(props, state, ref);
  return (
    <div className={cn("flex flex-col", className)}>
      <div {...tabListProps} ref={ref} className="flex items-center gap-2 overflow-x-scroll">
        {[...state.collection].map((item) => (
          <Option key={item.key} item={item} state={state} />
        ))}
      </div>
      <OptionsPanel key={state.selectedItem?.key} state={state} />
    </div>
  );
}

export interface OptionsOptionProps {
  item: Node<object>;
  state: TabListState<object>;
}

function Option({ item, state }: OptionsOptionProps) {
  const { key, rendered } = item;
  const ref = useRef<HTMLDivElement | null>(null);

  const { tabProps } = useTab({ key }, state, ref);
  return (
    <div
      {...tabProps}
      ref={ref}
      className={cn(
        "pl-0.5 pr-2 py-0.5 rounded-md cursor-pointer",
        "aria-selected:bg-mist-100 dark:aria-selected:bg-mist-950",
        "focus:outline-hidden focus:ring-2 focus:ring-indigo-500/40 focus:ring-offset-1 z-10",
        "dark:focus:ring-indigo-400/40 dark:focus:ring-offset-mist-900",
        "border border-mist-100 dark:border-mist-800",
      )}
    >
      {rendered}
    </div>
  );
}

export interface OptionsPanelProps extends AriaTabPanelProps {
  state: TabListState<object>;
}

function OptionsPanel({ state, ...props }: OptionsPanelProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { tabPanelProps } = useTabPanel(props, state, ref);
  return (
    <div {...tabPanelProps} ref={ref} className="mt-2 w-full">
      {state.selectedItem?.props.children}
    </div>
  );
}

export default Object.assign(Options, { Item });
