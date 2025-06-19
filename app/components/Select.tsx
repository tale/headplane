import { Check, ChevronDown } from 'lucide-react';
import { useRef } from 'react';
import {
	AriaComboBoxProps,
	AriaListBoxOptions,
	useButton,
	useComboBox,
	useFilter,
	useId,
	useListBox,
	useOption,
} from 'react-aria';
import { Item, ListState, Node, useComboBoxState } from 'react-stately';
import Popover from '~/components/Popover';
import cn from '~/utils/cn';

export interface SelectProps extends AriaComboBoxProps<object> {
	className?: string;
}

function Select(props: SelectProps) {
	const { contains } = useFilter({ sensitivity: 'base' });
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
		<div className={cn('flex flex-col', props.className)}>
			<label
				{...labelProps}
				htmlFor={id}
				className={cn(
					'text-xs font-medium px-3 mb-0.5',
					'text-headplane-700 dark:text-headplane-100',
				)}
			>
				{props.label}
			</label>
			<div
				className={cn(
					'flex rounded-xl focus:outline-hidden focus-within:ring-3',
					'bg-white dark:bg-headplane-900',
					'border border-headplane-100 dark:border-headplane-800',
				)}
			>
				<input
					{...inputProps}
					ref={inputRef}
					id={id}
					className="outline-hidden px-3 py-2 rounded-l-xl w-full bg-transparent"
					data-1p-ignore
				/>
				<button
					{...buttonProps}
					ref={buttonRef}
					className={cn(
						'flex items-center justify-center p-1 rounded-lg m-1',
						'bg-headplane-100 dark:bg-headplane-700/30 font-medium',
						props.isDisabled
							? 'opacity-50 cursor-not-allowed'
							: 'hover:bg-headplane-200/90 dark:hover:bg-headplane-800/30',
					)}
				>
					<ChevronDown className="p-0.5" />
				</button>
			</div>
			{props.description && (
				<div
					{...descriptionProps}
					className={cn(
						'text-xs px-3 mt-1',
						'text-headplane-500 dark:text-headplane-400',
					)}
				>
					{props.description}
				</div>
			)}
			{state.isOpen && (
				<Popover
					popoverRef={popoverRef}
					triggerRef={inputRef}
					state={state}
					isNonModal
					placement="bottom start"
					className="w-full max-w-xs"
				>
					<ListBox {...listBoxProps} listBoxRef={listBoxRef} state={state} />
				</Popover>
			)}
		</div>
	);
}

interface ListBoxProps extends AriaListBoxOptions<object> {
	listBoxRef?: React.RefObject<HTMLUListElement | null>;
	state: ListState<object>;
}

function ListBox(props: ListBoxProps) {
	const { listBoxRef, state } = props;
	const ref = listBoxRef ?? useRef<HTMLUListElement | null>(null);
	const { listBoxProps } = useListBox(props, state, ref);

	return (
		<ul
			{...listBoxProps}
			ref={listBoxRef}
			className="w-full max-h-72 overflow-auto outline-hidden pt-1"
		>
			{[...state.collection].map((item) => (
				<Option key={item.key} item={item} state={state} />
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
			ref={ref}
			className={cn(
				'flex items-center justify-between',
				'py-2 px-3 mx-1 rounded-lg mb-1',
				'focus:outline-hidden select-none',
				isFocused || isSelected
					? 'bg-headplane-100/50 dark:bg-headplane-800'
					: 'hover:bg-headplane-100/50 dark:hover:bg-headplane-800',
				isDisabled && 'text-headplane-300 dark:text-headplane-600',
			)}
		>
			{item.rendered}
			{isSelected && <Check className="p-0.5" />}
		</li>
	);
}

export default Object.assign(Select, { Item });
