import { CopyIcon } from '@primer/octicons-react'

import { toast } from './Toaster'

type Properties = {
	readonly name: string;
	readonly value: string;
	readonly isCopyable?: boolean;
}

export default function Attribute({ name, value, isCopyable }: Properties) {
	const canCopy = isCopyable ?? false
	return (
		<dl className='flex gap-1 text-sm w-full'>
			<dt className='w-1/4 shrink-0 min-w-0 truncate text-gray-700 dark:text-gray-300 py-1'>
				{name}
			</dt>

			{(canCopy ?? false) ? (
				<button
					type='button'
					className='focus:outline-none flex items-center gap-x-1 truncate hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md'
					onClick={async () => {
						await navigator.clipboard.writeText(value)
						toast(`Copied ${name}`)
					}}
				>
					<dd className='min-w-0 truncate px-2 py-1'>
						{value}
					</dd>
					<CopyIcon className='text-gray-600 dark:text-gray-200 pr-2 w-max h-4'/>
				</button>
			) : (
				<dd className='min-w-0 truncate px-2 py-1'>
					{value}
				</dd>
			)}
		</dl>
	)
}
