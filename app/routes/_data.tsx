import { type LoaderFunctionArgs, redirect } from '@remix-run/node'
import { Outlet, useLoaderData, useNavigation } from '@remix-run/react'
import { ProgressBar } from 'react-aria-components'

import { ErrorPopup } from '~/components/Error'
import Header from '~/components/Header'
import { cn } from '~/utils/cn'
import { loadContext } from '~/utils/config/headplane'
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
					'Set-Cookie': await destroySession(session),
				},
			})
		}

		// Otherwise propagate to boundary
		throw error
	}

	const context = await loadContext()
	return {
		config: context.config,
		user: session.get('user'),
	}
}

export default function Layout() {
	const data = useLoaderData<typeof loader>()
	const nav = useNavigation()

	return (
		<>
			<ProgressBar
				aria-label="Loading..."
			>
				<div
					className={cn(
						'fixed top-0 left-0 z-50 w-1/2 h-1',
						'bg-blue-500 dark:bg-blue-400 opacity-0',
						nav.state === 'loading' && 'animate-loading opacity-100',
					)}
				/>
			</ProgressBar>
			<Header data={data} />
			<main className="container mx-auto overscroll-contain mt-4 mb-24">
				<Outlet />
			</main>
		</>
	)
}

export function ErrorBoundary() {
	return (
		<>
			<Header />
			<ErrorPopup type="embedded" />
		</>
	)
}
