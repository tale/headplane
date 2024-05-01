import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { isRouteErrorResponse, useRouteError } from '@remix-run/react'
import { useState } from 'react'

import { cn } from '~/utils/cn'

import Code from './Code'
import Dialog from './Dialog'

type Properties = {
	readonly type?: 'full' | 'embedded';
}

export function ErrorPopup({ type = 'full' }: Properties) {
	// eslint-disable-next-line react/hook-use-state
	const open = useState(true)

	const error = useRouteError()
	const routing = isRouteErrorResponse(error)
	const message = (error instanceof Error ? error.message : 'An unexpected error occurred')

	return (
		<Dialog>
			<Dialog.Panel
				className={cn(
					type === 'embedded' ? 'pointer-events-none bg-transparent dark:bg-transparent' : '',
				)}
				control={open}
			>
				{() => (
					<>
						<div className='flex items-center justify-between'>
							<Dialog.Title className='text-3xl mb-0'>
								{routing ? error.status : 'Error'}
							</Dialog.Title>
							<ExclamationTriangleIcon className='w-12 h-12 text-red-500'/>
						</div>
						<Dialog.Text className='mt-4 text-lg'>
							{routing ? (
								error.statusText
							) : (
								<Code>
									{message}
								</Code>
							)}
						</Dialog.Text>
					</>
				)}
			</Dialog.Panel>
		</Dialog>
	)
}
