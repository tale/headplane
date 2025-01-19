import type { Dispatch, ReactNode, SetStateAction } from 'react';
import Button from '~/components/Button';
import IconButton from '~/components/IconButton';
import {
	Button as AriaButton,
	Menu as AriaMenu,
	MenuItem,
	MenuTrigger,
	Popover,
} from 'react-aria-components';
import { cn } from '~/utils/cn';

function Items(props: Parameters<typeof AriaMenu>[0]) {
	return (
		<Popover
			className={cn(
				'mt-2 rounded-md',
				'bg-ui-50 dark:bg-ui-800',
				'overflow-hidden z-50',
				'border border-ui-200 dark:border-ui-600',
				'entering:animate-in exiting:animate-out',
				'entering:fade-in entering:zoom-in-95',
				'exiting:fade-out exiting:zoom-out-95',
				'fill-mode-forwards origin-left-right',
			)}
		>
			<AriaMenu
				{...props}
				className={cn(
					'outline-none',
					'divide-y divide-ui-200 dark:divide-ui-600',
					props.className,
				)}
			>
				{props.children}
			</AriaMenu>
		</Popover>
	);
}

type ButtonProps = Parameters<typeof AriaButton>[0] & {
	readonly control?: [boolean, Dispatch<SetStateAction<boolean>>];
};

function ItemButton(props: ButtonProps) {
	return (
		<MenuItem className="outline-none">
			<AriaButton
				{...props}
				className={cn(
					'px-4 py-2 w-full outline-none text-left',
					'hover:bg-ui-200 dark:hover:bg-ui-700',
					props.className,
				)}
				aria-label="Menu Dialog"
				// If control is passed, set the state value
				onPress={(event) => {
					props.onPress?.(event);
					props.control?.[1](true);
				}}
			/>
		</MenuItem>
	);
}

function Item(props: Parameters<typeof MenuItem>[0]) {
	return (
		<MenuItem
			{...props}
			className={cn(
				'px-4 py-2 w-full outline-none',
				'hover:bg-ui-200 dark:hover:bg-ui-700',
				props.className,
			)}
		/>
	);
}

function Menu({ children }: { children: ReactNode }) {
	return <MenuTrigger>{children}</MenuTrigger>;
}

export default Object.assign(Menu, {
	IconButton,
	Button,
	Item,
	ItemButton,
	Items
});
