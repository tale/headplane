import { ChevronDownIcon } from '@primer/octicons-react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import {
	Button,
	ListBox,
	ListBoxItem,
	Popover,
	Select as AriaSelect,
	SelectValue,
} from 'react-aria-components';
import { cn } from '~/utils/cn';

type SelectProps = Parameters<typeof AriaSelect>[0] & {
	readonly label: string;
	readonly state?: [string, Dispatch<SetStateAction<string>>];
	readonly children: ReactNode;
};

function Select(props: SelectProps) {
	return (
		<AriaSelect
			{...props}
			aria-label={props.label}
			selectedKey={props.state?.[0]}
			onSelectionChange={(key) => {
				props.state?.[1](key.toString());
			}}
			className={cn(
				'block w-full rounded-lg my-1',
				'border border-ui-200 dark:border-ui-600',
				'bg-white dark:bg-ui-800 dark:text-ui-300',
				'focus-within:outline-6',
				props.className,
			)}
		>
			<Button
				className={cn(
					'w-full flex items-center justify-between',
					'px-2.5 py-1.5 rounded-lg',
				)}
			>
				<SelectValue />
				<ChevronDownIcon className="w-4 h-4" aria-hidden="true" />
			</Button>
			<Popover
				className={cn(
					'mt-2 rounded-md w-[var(--trigger-width)]',
					'bg-ui-100 dark:bg-ui-800 shadow-sm',
					'z-50 overflow-y-auto',
					'border border-ui-200 dark:border-ui-600',
					'entering:animate-in exiting:animate-out',
					'entering:fade-in entering:zoom-in-95',
					'exiting:fade-out exiting:zoom-out-95',
					'fill-mode-forwards origin-left-right',
				)}
			>
				<ListBox orientation="vertical">{props.children}</ListBox>
			</Popover>
		</AriaSelect>
	);
}

type ItemProps = Parameters<typeof ListBoxItem>[0];

function Item(props: ItemProps) {
	return (
		<ListBoxItem
			{...props}
			className={cn(
				'px-4 py-2 w-full outline-none w-full',
				'hover:bg-ui-200 dark:hover:bg-ui-700',
				props.className,
			)}
		>
			{props.children}
		</ListBoxItem>
	);
}

export default Object.assign(Select, { Item });
