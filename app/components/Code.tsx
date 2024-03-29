import clsx from 'clsx'
import { type HTMLProps } from 'react'

type Properties = HTMLProps<HTMLSpanElement>

export default function Code(properties: Properties) {
	return (
		<code className={clsx('bg-gray-100 dark:bg-zinc-700 p-0.5 rounded-md', properties.className)}>
			{properties.children}
		</code>
	)
}
