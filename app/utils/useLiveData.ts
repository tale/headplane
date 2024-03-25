import { useRevalidator } from '@remix-run/react'
import { useInterval } from 'usehooks-ts'

type Properties = {
	interval: number;
}

export function useLiveData({ interval }: Properties) {
	const revalidator = useRevalidator()
	useInterval(() => {
		if (revalidator.state === 'idle') {
			revalidator.revalidate()
		}
	}, interval)
}

