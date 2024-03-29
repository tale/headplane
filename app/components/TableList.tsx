import clsx from 'clsx'
import { type HTMLProps } from 'react'

function TableList(properties: HTMLProps<HTMLDivElement>) {
	return (
		<div
			{...properties}
			className={clsx(
				'border border-gray-300 rounded-lg overflow-clip',
				'dark:border-zinc-700 dark:text-gray-300',
				// 'dark:bg-zinc-800',
				properties.className
			)}
		>
			{properties.children}
		</div>
	)
}

function Item(properties: HTMLProps<HTMLDivElement>) {
	return (
		<div
			{...properties}
			className={clsx(

				'flex items-center justify-between px-3 py-2',
				'border-b border-gray-200 last:border-b-0',
				'dark:border-zinc-800',
				properties.className
			)}
		>
			{properties.children}
		</div>
	)
}

export default Object.assign(TableList, { Item })
