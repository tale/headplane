import { type ActionFunctionArgs, json, type LoaderFunctionArgs, redirect } from '@remix-run/node'
import { Form, Link, useActionData, useLoaderData } from '@remix-run/react'
import { useMemo } from 'react'

import Code from '~/components/Code'
import { pull } from '~/utils/headscale'
import { startOidc } from '~/utils/oidc'
import { commitSession, getSession } from '~/utils/sessions'

export async function loader({ request }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'))
	if (session.has('hsApiKey')) {
		return redirect('/machines', {
			headers: {
				// eslint-disable-next-line @typescript-eslint/naming-convention
				'Set-Cookie': await commitSession(session)
			}
		})
	}

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

	if (!data.oidc && !data.apiKey) {
		throw new Error('No authentication method is enabled')
	}

	if (data.oidc && !data.apiKey) {
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		return startOidc(data.oidc, id!, request)
	}

	return data
}

export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()
	const apiKey = String(formData.get('api-key'))
	const session = await getSession(request.headers.get('Cookie'))

	// Test the API key
	try {
		await pull('v1/apikey', apiKey)
	} catch (error) {
		console.error(error)
		return json({
			error: 'Invalid API key'
		})
	}

	session.set('hsApiKey', apiKey)
	return redirect('/machines', {
		headers: {
			// eslint-disable-next-line @typescript-eslint/naming-convention
			'Set-Cookie': await commitSession(session)
		}
	})
}

export default function Page() {
	const data = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const showOr = useMemo(() => data.oidc && data.apiKey, [data])

	return (
		<div className='flex min-h-screen items-center justify-center'>
			<div className='w-1/3 border p-4 rounded-lg'>
				<h1 className='text-2xl mb-8'>Login</h1>
				{data.apiKey ? (
					<Form method='post'>
						<p className='text-sm text-gray-500 mb-4'>
							Enter an API key to authenticate with Headplane. You can generate
							one by running
							{' '}
							<Code>
								headscale apikeys create
							</Code>
							{' '}
							in your terminal.
						</p>

						{actionData?.error ? (
							<p className='text-red-500 text-sm mb-2'>{actionData.error}</p>
						) : undefined}
						<input
							required
							type='text'
							name='api-key'
							id='api-key'
							className='border rounded-md p-2 w-full'
							placeholder='API Key'
						/>

						<button
							type='submit'
							className='bg-gray-800 text-white rounded-md p-2 w-full mt-4'
						>
							Login
						</button>
					</Form>
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
