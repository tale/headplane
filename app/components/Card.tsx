import clsx from 'clsx'
import { type HTMLProps } from 'react'

type Properties = HTMLProps<HTMLDivElement>

export default function Card(properties: Properties) {
	return (
		<div
			{...properties}
			className={clsx(
				'p-4 md:p-6 border dark:border-zinc-700 rounded-lg',
				properties.className
			)}
		>
			{properties.children}
		</div>
	)
}
