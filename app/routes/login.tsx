import { type LoaderFunctionArgs } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import { useMemo } from 'react'

import { startOidc } from '~/utils/oidc'

export async function loader({ request }: LoaderFunctionArgs) {
	const issuer = process.env.OIDC_ISSUER
	const id = process.env.OIDC_CLIENT_ID
	const secret = process.env.OIDC_CLIENT_SECRET
	const normal = process.env.DISABLE_API_KEY_LOGIN

	if (issuer && (!id || !secret)) {
		throw new Error('An invalid OIDC configuration was provided')
	}

	const data = {
		oidc: issuer,
		apiKey: normal === undefined
	}

	console.log(data)

	if (!data.oidc && !data.apiKey) {
		throw new Error('No authentication method is enabled')
	}

	if (data.oidc && !data.apiKey) {
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		return startOidc(data.oidc, id!, request)
	}

	return data
}

export default function Page() {
	const data = useLoaderData<typeof loader>()
	const showOr = useMemo(() => data.oidc && data.apiKey, [data])

	return (
		<div className='flex min-h-screen items-center justify-center'>
			<div className='w-1/3 border p-4 rounded-lg'>
				<h1 className='text-2xl mb-8'>Login</h1>
				{data.apiKey ? (
					<>
						<p className='text-sm text-gray-500 mb-4'>
							Enter an API key to authenticate with Headplane. You can generate
							one by running
							{' '}
							<code className='bg-gray-100 p-1 rounded-md'>
								headscale apikeys create
							</code>
							{' '}
							in your terminal.
						</p>

						<input
							type='text'
							id='api-key'
							className='border rounded-md p-2 w-full'
							placeholder='API Key'
						/>
					</>
				) : undefined}
				{showOr ? (
					<div className='flex items-center gap-x-2 py-2'>
						<hr className='flex-1'/>
						<span className='text-gray-500'>or</span>
						<hr className='flex-1'/>
					</div>
				) : undefined}
				{data.oidc ? (
					<Link to='/oidc/start'>
						<button className='bg-gray-800 text-white rounded-md p-2 w-full' type='button'>
							Login with SSO
						</button>
					</Link>
				) : undefined}
			</div>
		</div>
	)
}
