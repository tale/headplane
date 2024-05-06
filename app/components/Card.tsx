import { type HTMLProps } from 'react'
import { Heading as AriaHeading } from 'react-aria-components'

import { cn } from '~/utils/cn'

function Title(properties: Parameters<typeof AriaHeading>[0]) {
	return (
		<AriaHeading
			{...properties}
			slot='title'
			className={cn(
				'text-lg font-semibold leading-6 mb-5',
				properties.className
			)}
		/>
	)
}

function Text(properties: React.HTMLProps<HTMLParagraphElement>) {
	return (
		<p
			{...properties}
			className={cn(
				'text-base leading-6 my-0',
				properties.className
			)}
		/>
	)
}

type Properties = HTMLProps<HTMLDivElement> & {
	variant?: 'raised' | 'flat';
}

function Card(properties: Properties) {
	return (
		<div
			{...properties}
			className={cn(
				'w-full max-w-md overflow-hidden rounded-xl p-4',
				properties.variant === 'flat'
					? 'bg-transparent shadow-none'
					: 'bg-ui-50 dark:bg-ui-900 shadow-sm',
				'border border-ui-200 dark:border-ui-700',
				properties.className
			)}
		>
			{properties.children}
		</div>
	)
}

export default Object.assign(Card, { Title, Text })
