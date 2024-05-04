import { IssueDraftIcon } from '@primer/octicons-react'

export default function Page() {
	return (
		<div className='w-96 mx-auto flex flex-col justify-center items-center text-center my-8'>
			<IssueDraftIcon className='w-24 h-24 text-gray-300 dark:text-gray-500'/>
			<p className='text-lg mt-8'>
				The settings page is currently unavailable.
				It will be available in a future release.
			</p>
		</div>
	)
}
