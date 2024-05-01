import { type Dispatch, type ReactNode, type SetStateAction } from 'react'
import {
	Button as AriaButton,
	Menu as AriaMenu,
	MenuItem,
	MenuTrigger,
	Popover
} from 'react-aria-components'

import { cn } from '~/utils/cn'

function Button(properties: Parameters<typeof AriaButton>[0]) {
	return (
		<AriaButton
			{...properties}
			className={cn(
				'outline-none',
				properties.className
			)}
			aria-label='Menu'
		/>
	)
}

function Items(properties: Parameters<typeof AriaMenu>[0]) {
	return (
		<Popover className={cn(
			'mt-2 rounded-md',
			'bg-ui-50 dark:bg-ui-800',
			'overflow-hidden z-50',
			'border border-ui-200 dark:border-ui-600',
			'entering:animate-in exiting:animate-out',
			'entering:fade-in entering:zoom-in-95',
			'exiting:fade-out exiting:zoom-out-95',
			'fill-mode-forwards origin-left-right'
		)}
		>
			<AriaMenu
				{...properties}
				className={cn(
					'outline-none',
					'divide-y divide-ui-200 dark:divide-ui-600',
					properties.className
				)}
			>
				{properties.children}
			</AriaMenu>
		</Popover>
	)
}

type ButtonProperties = Parameters<typeof AriaButton>[0] & {
	readonly control?: [boolean, Dispatch<SetStateAction<boolean>>];
}

function ItemButton(properties: ButtonProperties) {
	return (
		<MenuItem className='outline-none'>
			<AriaButton
				{...properties}
				className={cn(
					'px-4 py-2 w-full outline-none text-left',
					'hover:bg-ui-200 dark:hover:bg-ui-700',
					properties.className
				)}
				aria-label='Menu Dialog'
				// If control is passed, set the state value
				onPress={event => {
					properties.onPress?.(event)
					properties.control?.[1](true)
				}}
			/>
		</MenuItem>
	)
}

function Item(properties: Parameters<typeof MenuItem>[0]) {
	return (
		<MenuItem
			{...properties}
			className={cn(
				'px-4 py-2 w-full outline-none',
				'hover:bg-ui-200 dark:hover:bg-ui-700',
				properties.className
			)}
		/>
	)
}

function Menu({ children }: { readonly children: ReactNode }) {
	return (
		<MenuTrigger>
			{children}
		</MenuTrigger>
	)
}

export default Object.assign(Menu, { Button, Item, ItemButton, Items })
