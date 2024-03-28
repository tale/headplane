import { CubeTransparentIcon } from '@heroicons/react/24/outline'

export default function Page() {
	return (
		<div className='w-96 mx-auto flex flex-col justify-center items-center text-center'>
			<CubeTransparentIcon className='w-32 h-32 text-gray-500'/>
			<p className='text-lg mt-8'>
				Access Control Lists are currently unavailable.
				They will be available in a future release.
			</p>
		</div>
	)
}
