import { type ActionFunctionArgs, json, type LoaderFunctionArgs, redirect } from '@remix-run/node'
import { Form, useActionData, useLoaderData } from '@remix-run/react'
import { useMemo } from 'react'

import Button from '~/components/Button'
import Card from '~/components/Card'
import Code from '~/components/Code'
import Input from '~/components/Input'
import { type Key } from '~/types'
import { getContext } from '~/utils/config'
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

	const context = await getContext()
	const issuer = context.oidcConfig?.issuer
	const id = context.oidcConfig?.client
	const secret = context.oidcConfig?.secret
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
	const oidcStart = String(formData.get('oidc-start'))

	if (oidcStart) {
		const context = await getContext()
		const issuer = context.oidcConfig?.issuer
		const id = context.oidcConfig?.client

		// We know it exists here because this action only happens on OIDC
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		return startOidc(issuer!, id!, request)
	}

	const apiKey = String(formData.get('api-key'))
	const session = await getSession(request.headers.get('Cookie'))

	// Test the API key
	try {
		const apiKeys = await pull<{ apiKeys: Key[] }>('v1/apikey', apiKey)
		const key = apiKeys.apiKeys.find(k => apiKey.startsWith(k.prefix))
		if (!key) {
			throw new Error('Invalid API key')
		}

		const expiry = new Date(key.expiration)
		const expiresIn = expiry.getTime() - Date.now()
		const expiresDays = Math.round(expiresIn / 1000 / 60 / 60 / 24)

		session.set('hsApiKey', apiKey)
		session.set('user', {
			name: key.prefix,
			email: `${expiresDays} days`
		})

		return redirect('/machines', {
			headers: {
				// eslint-disable-next-line @typescript-eslint/naming-convention
				'Set-Cookie': await commitSession(session, {
					maxAge: expiresIn
				})
			}
		})
	} catch (error) {
		console.error(error)
		return json({
			error: 'Invalid API key'
		})
	}
}

export default function Page() {
	const data = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()
	const showOr = useMemo(() => data.oidc && data.apiKey, [data])

	return (
		<div className='flex min-h-screen items-center justify-center'>
			<Card className='w-96'>
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
						<Input
							required
							type='text'
							name='api-key'
							id='api-key'
							className='border rounded-md p-2 w-full'
							placeholder='API Key'
						/>

						<Button
							variant='emphasized'
							type='submit'
							className='bg-gray-800 text-white rounded-md p-2 w-full mt-4'
						>
							Login
						</Button>
					</Form>
				) : undefined}
				{showOr ? (
					<div className='flex items-center gap-x-2 py-2'>
						<hr className='flex-1 dark:border-zinc-700'/>
						<span className='text-gray-500'>or</span>
						<hr className='flex-1 dark:border-zinc-700'/>
					</div>
				) : undefined}
				{data.oidc ? (
					<Form method='POST'>
						<input type='hidden' name='oidc-start' value='true'/>
						<Button
							variant='emphasized'
							type='submit'
							className='bg-gray-800 text-white rounded-md p-2 w-full'
						>
							Login with SSO
						</Button>
					</Form>
				) : undefined}
			</Card>
		</div>
	)
}
