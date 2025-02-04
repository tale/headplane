import clsx from 'clsx';
import type { HTMLProps } from 'react';

function TableList(props: HTMLProps<HTMLDivElement>) {
	return (
		<div
			{...props}
			className={clsx(
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
			className={clsx(
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
