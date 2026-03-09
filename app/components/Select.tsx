import { Check, ChevronDown } from "lucide-react";
import { useRef } from "react";
import {
  AriaComboBoxProps,
  AriaListBoxOptions,
  useButton,
  useComboBox,
  useFilter,
  useId,
  useListBox,
  useOption,
} from "react-aria";
import { Item, ListState, Node, useComboBoxState } from "react-stately";

import Popover from "~/components/Popover";
import cn from "~/utils/cn";

export interface SelectProps extends AriaComboBoxProps<object> {
  className?: string;
}

function Select(props: SelectProps) {
  const { contains } = useFilter({ sensitivity: "base" });
  const state = useComboBoxState({ ...props, defaultFilter: contains });
  const id = useId(props.id);

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listBoxRef = useRef<HTMLUListElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const {
    buttonProps: triggerProps,
    inputProps,
    listBoxProps,
    labelProps,
    descriptionProps,
  } = useComboBox(
    {
      ...props,
      inputRef,
      buttonRef,
      listBoxRef,
      popoverRef,
    },
    state,
  );

  const { buttonProps } = useButton(triggerProps, buttonRef);
  return (
    <div className={cn("flex flex-col", props.className)}>
      <label
        {...labelProps}
        className={cn("text-xs font-medium px-3 mb-0.5", "text-mist-700 dark:text-mist-100")}
        htmlFor={id}
      >
        {props.label}
      </label>
      <div
        className={cn(
          "flex rounded-md focus:outline-hidden focus-within:ring-3",
          "bg-white dark:bg-mist-900",
          "border border-mist-100 dark:border-mist-800",
          props.isInvalid && "ring-red-400",
        )}
      >
        <input
          {...inputProps}
          className="w-full rounded-l-md bg-transparent px-3 py-2 outline-hidden"
          data-1p-ignore
          id={id}
          ref={inputRef}
        />
        <button
          {...buttonProps}
          className={cn(
            "flex items-center justify-center p-1 rounded-lg m-1",
            "bg-mist-100 dark:bg-mist-700/30 font-medium",
            props.isDisabled
              ? "opacity-50 cursor-not-allowed"
              : "hover:bg-mist-200/90 dark:hover:bg-mist-800/30",
          )}
          ref={buttonRef}
        >
          <ChevronDown className="p-0.5" />
        </button>
      </div>
      {props.description && (
        <div
          {...descriptionProps}
          className={cn("text-xs px-3 mt-1", "text-mist-500 dark:text-mist-400")}
        >
          {props.description}
        </div>
      )}
      {state.isOpen && (
        <Popover
          className="w-full max-w-xs"
          isNonModal
          placement="bottom start"
          popoverRef={popoverRef}
          state={state}
          triggerRef={inputRef}
        >
          <ListBox {...listBoxProps} listBoxRef={listBoxRef} state={state} />
        </Popover>
      )}
    </div>
  );
}

interface ListBoxProps extends AriaListBoxOptions<object> {
  listBoxRef: React.RefObject<HTMLUListElement | null>;
  state: ListState<object>;
}

function ListBox(props: ListBoxProps) {
  const { listBoxRef, state } = props;
  const { listBoxProps } = useListBox(props, state, listBoxRef);

  return (
    <ul
      {...listBoxProps}
      className="max-h-72 w-full overflow-auto pt-1 outline-hidden"
      ref={listBoxRef}
    >
      {[...state.collection].map((item) => (
        <Option item={item} key={item.key} state={state} />
      ))}
    </ul>
  );
}

interface OptionProps {
  item: Node<unknown>;
  state: ListState<unknown>;
}

function Option({ item, state }: OptionProps) {
  const ref = useRef<HTMLLIElement | null>(null);
  const { optionProps, isDisabled, isSelected, isFocused } = useOption(
    {
      key: item.key,
    },
    state,
    ref,
  );

  return (
    <li
      {...optionProps}
      className={cn(
        "flex items-center justify-between",
        "py-2 px-3 mx-1 rounded-lg mb-1",
        "focus:outline-hidden select-none",
        isFocused || isSelected
          ? "bg-mist-100/50 dark:bg-mist-800"
          : "hover:bg-mist-100/50 dark:hover:bg-mist-800",
        isDisabled && "text-mist-300 dark:text-mist-600",
      )}
      ref={ref}
    >
      {item.rendered}
      {isSelected && <Check className="p-0.5" />}
    </li>
  );
}

export default Object.assign(Select, { Item });
