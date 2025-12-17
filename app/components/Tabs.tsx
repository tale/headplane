import { useRef } from 'react';
import {
	AriaTabListProps,
	AriaTabPanelProps,
	useTab,
	useTabList,
	useTabPanel,
} from 'react-aria';
import { Item, Node, TabListState, useTabListState } from 'react-stately';
import cn from '~/utils/cn';

export interface TabsProps extends AriaTabListProps<object> {
	label: string;
	className?: string;
	variant?: 'default' | 'pill';
}

function Tabs({ label, className, variant = 'default', ...props }: TabsProps) {
	const state = useTabListState(props);
	const ref = useRef<HTMLDivElement | null>(null);

	const { tabListProps } = useTabList(props, state, ref);
	return (
		<div className={cn('flex flex-col', className)}>
			<div
				{...tabListProps}
				className={cn(
					'flex items-center w-fit',
					variant === 'pill'
						? 'rounded-full border border-headplane-500/60 bg-transparent h-9 px-1 py-0.5'
						: [
								'rounded-t-xl',
								'border-headplane-100 dark:border-headplane-800',
								'border-t border-x',
							],
				)}
				ref={ref}
			>
				{[...state.collection].map((item) => (
					<Tab item={item} key={item.key} state={state} variant={variant} />
				))}
			</div>
			<TabsPanel key={state.selectedItem?.key} state={state} />
		</div>
	);
}

export interface TabsTabProps {
	item: Node<object>;
	state: TabListState<object>;
	variant: 'default' | 'pill';
}

function Tab({ item, state, variant }: TabsTabProps) {
	const { key, rendered } = item;
	const ref = useRef<HTMLDivElement | null>(null);

	const { tabProps } = useTab({ key }, state, ref);
	return (
		<div
			{...tabProps}
			className={cn(
				variant === 'pill'
					? [
							'px-4 py-1.5 text-sm font-medium cursor-pointer select-none',
							'rounded-full',
							'focus:outline-hidden focus:ring-3',
							'transition-colors duration-150 ease-in-out',
							'text-headplane-400 dark:text-headplane-500',
							'hover:text-headplane-200 dark:hover:text-headplane-200',
							'aria-selected:bg-headplane-50 aria-selected:text-headplane-900',
						]
					: [
							'pl-2 pr-3 py-2.5',
							'aria-selected:bg-headplane-100 dark:aria-selected:bg-headplane-950',
							'focus:outline-hidden focus:ring-3 z-10',
							'border-r border-headplane-100 dark:border-headplane-800',
							'first:rounded-tl-xl last:rounded-tr-xl last:border-r-0',
						],
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
	const content = state.selectedItem?.props.children;

	// If there is no panel content for the selected tab (e.g. header toggles),
	// don't render the bordered panel container at all.
	if (!content) {
		return null;
	}

	return (
		<div
			{...tabPanelProps}
			className={cn(
				'w-full overflow-clip rounded-b-xl rounded-r-xl',
				'border border-headplane-100 dark:border-headplane-800',
			)}
			ref={ref}
		>
			{content}
		</div>
	);
}

export default Object.assign(Tabs, { Item });
