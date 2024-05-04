import { type LoaderFunctionArgs, redirect } from '@remix-run/node'
import { Outlet, useLoaderData } from '@remix-run/react'

import { ErrorPopup } from '~/components/Error'
import Header from '~/components/Header'
import { getContext } from '~/utils/config'
import { HeadscaleError, pull } from '~/utils/headscale'
import { destroySession, getSession } from '~/utils/sessions'

export async function loader({ request }: LoaderFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'))
	if (!session.has('hsApiKey')) {
		return redirect('/login')
	}

	try {
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		await pull('v1/apikey', session.get('hsApiKey')!)
	} catch (error) {
		if (error instanceof HeadscaleError) {
			// Safest to just redirect to login if we can't pull
			return redirect('/login', {
				headers: {
					// eslint-disable-next-line @typescript-eslint/naming-convention
					'Set-Cookie': await destroySession(session)
				}
			})
		}

		// Otherwise propagate to boundary
		throw error
	}

	const context = await getContext()
	return {
		...context,
		user: session.get('user')
	}
}

export default function Layout() {
	const data = useLoaderData<typeof loader>()

	return (
		<>
			<Header data={data}/>

			<main className='container mx-auto overscroll-contain mt-4 mb-24'>
				<Outlet/>
			</main>
		</>
	)
}

export function ErrorBoundary() {
	return (
		<>
			<Header/>
			<ErrorPopup type='embedded'/>
		</>
	)
}
