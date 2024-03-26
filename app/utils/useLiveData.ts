import { useRevalidator } from '@remix-run/react'
import { useEffect } from 'react'
import { useInterval } from 'usehooks-ts'

type Properties = {
	interval: number;
}

export function useLiveData({ interval }: Properties) {
	const revalidator = useRevalidator()

	// Handle normal stale-while-revalidate behavior
	useInterval(() => {
		if (revalidator.state === 'idle') {
			revalidator.revalidate()
		}
	}, interval)

	useEffect(() => {
		const handler = () => {
			if (revalidator.state === 'idle') {
				revalidator.revalidate()
			}
		}

		window.addEventListener('online', handler)
		document.addEventListener('focus', handler)

		return () => {
			window.removeEventListener('online', handler)
			document.removeEventListener('focus', handler)
		}
	}, [revalidator])
}
