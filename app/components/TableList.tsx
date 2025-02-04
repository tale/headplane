import type { HTMLProps } from 'react';
import cn from '~/utils/cn';

function TableList(props: HTMLProps<HTMLDivElement>) {
	return (
		<div
			{...props}
			className={cn(
				'rounded-xl',
				'border border-headplane-100 dark:border-headplane-800',
				props.className,
			)}
		>
			{props.children}
		</div>
	);
}

function Item(props: HTMLProps<HTMLDivElement>) {
	return (
		<div
			{...props}
			className={cn(
				'flex items-center justify-between p-2 last:border-b-0',
				'border-b border-headplane-100 dark:border-headplane-800',
				props.className,
			)}
		>
			{props.children}
		</div>
	);
}

export default Object.assign(TableList, { Item });
