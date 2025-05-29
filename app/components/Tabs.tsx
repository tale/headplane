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
}

function Tabs({ label, className, ...props }: TabsProps) {
	const state = useTabListState(props);
	const ref = useRef<HTMLDivElement | null>(null);

	const { tabListProps } = useTabList(props, state, ref);
	return (
		<div className={cn('flex flex-col', className)}>
			<div
				{...tabListProps}
				ref={ref}
				className={cn(
					'flex items-center rounded-t-xl w-fit',
					'border-headplane-100 dark:border-headplane-800',
					'border-t border-x',
				)}
			>
				{[...state.collection].map((item) => (
					<Tab key={item.key} item={item} state={state} />
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
			ref={ref}
			className={cn(
				'pl-2 pr-3 py-2.5',
				'aria-selected:bg-headplane-100 dark:aria-selected:bg-headplane-950',
				'focus:outline-hidden focus:ring-3 z-10',
				'border-r border-headplane-100 dark:border-headplane-800',
				'first:rounded-tl-xl last:rounded-tr-xl last:border-r-0',
			)}
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
			ref={ref}
			className={cn(
				'w-full overflow-clip rounded-b-xl rounded-r-xl',
				'border border-headplane-100 dark:border-headplane-800',
			)}
		>
			{state.selectedItem?.props.children}
		</div>
	);
}

export default Object.assign(Tabs, { Item });
