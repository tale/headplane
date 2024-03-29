import { Transition } from '@headlessui/react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { isRouteErrorResponse, useRouteError } from '@remix-run/react'
import clsx from 'clsx'
import { Fragment, useEffect, useState } from 'react'

import Code from './Code'

type Properties = {
	readonly type?: 'full' | 'embedded';
}

export function ErrorPopup({ type = 'full' }: Properties) {
	const [isOpen, setIsOpen] = useState(false)
	const error = useRouteError()
	const routing = isRouteErrorResponse(error)
	const message = (error instanceof Error ? error.message : 'An unexpected error occurred')
	console.error(error)

	// Debounce the error modal so it doesn't show up for a split second
	// when the user navigates to a new page.
	useEffect(() => {
		setTimeout(() => {
			setIsOpen(true)
		}, 150)
	}, [])

	return (
		<Transition as={Fragment} show={isOpen}>
			<Transition.Child
				as={Fragment}
				enter='ease-out duration-150'
				enterFrom='opacity-0 scale-95'
				enterTo='opacity-100 scale-100'
			>

				<div className={clsx(
					'flex items-center justify-center overflow-clip',
					type === 'full' ? 'min-h-screen' : 'mt-24'
				)}
				>
					<div className={clsx(
						'flex flex-col items-center justify-center space-y-2 w-full sm:w-1/2 xl:w-1/3',
						'bg-white dark:bg-zinc-800 rounded-lg py-8 px-4 md:px-16',
						'border border-gray-200 dark:border-zinc-700 text-center'
					)}
					>
						<ExclamationTriangleIcon className='w-12 h-12 text-red-500'/>
						<h1 className='text-2xl font-semibold text-gray-800 dark:text-gray-100'>
							{routing ? error.status : 'Error'}
						</h1>
						{routing ? (
							<p className='text-gray-500 dark:text-gray-400'>
								{error.statusText}
							</p>
						) : (
							<Code className='text-sm'>
								{message}
							</Code>
						)}
					</div>
				</div>
			</Transition.Child>
		</Transition>
	)
}
