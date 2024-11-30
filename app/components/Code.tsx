import { useState, HTMLProps } from 'react'
import { CopyIcon, CheckIcon } from '@primer/octicons-react'

import { cn } from '~/utils/cn'
import { toast } from '~/components/Toaster'

interface Props extends HTMLProps<HTMLSpanElement> {
	isCopyable?: boolean
}

export default function Code(props: Props) {
	const [isCopied, setIsCopied] = useState(false)

	return (
		<>
			<code className={cn(
				'bg-ui-100 dark:bg-ui-800 p-0.5 rounded-md',
				props.className
			)}>
				{props.children}
			</code>
			{props.isCopyable && (
				<button
					className={cn(
						'ml-1 p-1 rounded-md',
						'bg-ui-100 dark:bg-ui-800',
						'text-ui-500 dark:text-ui-400',
						'inline-flex items-center justify-center'
					)}
					onClick={() => {
						navigator.clipboard.writeText(props.children.join(''))
						toast('Copied to clipboard')
						setIsCopied(true)
						setTimeout(() => setIsCopied(false), 1000)
					}}
				>
					{isCopied ?
						<CheckIcon className="h-3 w-3" /> :
						<CopyIcon className="h-3 w-3" />
					}
				</button>
			)}
		</>
	)
}
