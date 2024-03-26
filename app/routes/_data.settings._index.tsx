import { useLoaderData } from '@remix-run/react'

import { getConfig } from '~/utils/config'

export async function loader() {
	const config = await getConfig()
	return config
}

export default function Page() {
	const data = useLoaderData<typeof loader>()

	return (
		<div>
			{JSON.stringify(data, null, 4)}
		</div>
	)
}
