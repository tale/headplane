import React, { useRef, cloneElement } from 'react';
import { type AriaMenuProps, Key, Placement, useMenuTrigger } from 'react-aria';
import { useMenu, useMenuItem, useMenuSection, useSeparator } from 'react-aria';
import { Item, Section } from 'react-stately';
import {
	type MenuTriggerProps,
	Node,
	TreeState,
	useMenuTriggerState,
	useTreeState,
} from 'react-stately';
import Button, { ButtonProps } from '~/components/Button';
import IconButton, { IconButtonProps } from '~/components/IconButton';
import Popover from '~/components/Popover';
import cn from '~/utils/cn';

interface MenuProps extends MenuTriggerProps {
	placement?: Placement;
	isDisabled?: boolean;
	disabledKeys?: Key[];
	children: [
		React.ReactElement<ButtonProps> | React.ReactElement<IconButtonProps>,
		React.ReactElement<MenuPanelProps>,
	];
}

// TODO: onAction is called twice for some reason?
// TODO: isDisabled per-prop
function Menu(props: MenuProps) {
	const { placement = 'bottom', isDisabled, disabledKeys = [] } = props;
	const state = useMenuTriggerState(props);
	const ref = useRef<HTMLButtonElement | null>(null);
	const { menuTriggerProps, menuProps } = useMenuTrigger<object>(
		{},
		state,
		ref,
	);

	// cloneElement is necessary because the button is a union type
	// of multiple things and we need to join props from our hooks
	const [button, panel] = props.children;
	return (
		<div>
			{cloneElement(button, {
				...menuTriggerProps,
				isDisabled: isDisabled,
				ref,
			})}
			{state.isOpen && (
				<Popover state={state} triggerRef={ref} placement={placement}>
					{cloneElement(panel, {
						...menuProps,
						autoFocus: state.focusStrategy ?? true,
						onClose: () => state.close(),
						disabledKeys,
					})}
				</Popover>
			)}
		</div>
	);
}

interface MenuPanelProps extends AriaMenuProps<object> {
	onClose?: () => void;
	disabledKeys?: Key[];
}

function Panel(props: MenuPanelProps) {
	const state = useTreeState(props);
	const ref = useRef(null);

	const { menuProps } = useMenu(props, state, ref);
	return (
		<ul
			{...menuProps}
			ref={ref}
			className="pt-1 pb-1 shadow-xs rounded-md min-w-[200px] focus:outline-none"
		>
			{[...state.collection].map((item) => (
				<MenuSection
					key={item.key}
					section={item}
					state={state}
					disabledKeys={props.disabledKeys}
				/>
			))}
		</ul>
	);
}

interface MenuSectionProps<T> {
	section: Node<T>;
	state: TreeState<T>;
	disabledKeys?: Key[];
}

function MenuSection<T>({ section, state, disabledKeys }: MenuSectionProps<T>) {
	const { itemProps, groupProps } = useMenuSection({
		heading: section.rendered,
		'aria-label': section['aria-label'],
	});

	const { separatorProps } = useSeparator({
		elementType: 'li',
	});

	return (
		<>
			{section.key !== state.collection.getFirstKey() ? (
				<li
					{...separatorProps}
					className={cn(
						'mx-2 mt-1 mb-1 border-t',
						'border-headplane-200 dark:border-headplane-800',
					)}
				/>
			) : undefined}
			<li {...itemProps}>
				<ul {...groupProps}>
					{[...section.childNodes].map((item) => (
						<MenuItem
							key={item.key}
							item={item}
							state={state}
							isDisabled={disabledKeys?.includes(item.key)}
						/>
					))}
				</ul>
			</li>
		</>
	);
}

interface MenuItemProps<T> {
	item: Node<T>;
	state: TreeState<T>;
	isDisabled?: boolean;
}

function MenuItem<T>({ item, state, isDisabled }: MenuItemProps<T>) {
	const ref = useRef<HTMLLIElement | null>(null);
	const { menuItemProps } = useMenuItem({ key: item.key }, state, ref);

	const isFocused = state.selectionManager.focusedKey === item.key;

	return (
		<li
			{...menuItemProps}
			ref={ref}
			className={cn(
				'py-2 px-3 mx-1 rounded-lg',
				'focus:outline-none select-none',
				isFocused && 'bg-headplane-100/50 dark:bg-headplane-800',
				isDisabled
					? 'text-headplane-400 dark:text-headplane-600'
					: 'hover:bg-headplane-100/50 dark:hover:bg-headplane-800 cursor-pointer',
			)}
		>
			{item.rendered}
		</li>
	);
}

export default Object.assign(Menu, {
	Button,
	IconButton,
	Panel,
	Section,
	Item,
});
