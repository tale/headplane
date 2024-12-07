import { LoaderFunctionArgs, redirect } from '@remix-run/node'
import { Outlet, useLoaderData, useNavigation } from '@remix-run/react'
import { ProgressBar } from 'react-aria-components'

import { ErrorPopup } from '~/components/Error'
import Header from '~/components/Header'
import Link from '~/components/Link'
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
		url: context.headscalePublicUrl ?? context.headscaleUrl,
		debug: context.debug,
		user: session.get('user'),
	}
}

interface FooterProps {
	url: string
	debug: boolean
}

function Footer({ url, debug, integration }: FooterProps) {
	return (
		<footer className={cn(
			'fixed bottom-0 left-0 z-50 w-full h-14',
			'bg-ui-100 dark:bg-ui-900 text-ui-500',
			'flex flex-col justify-center gap-1',
			'border-t border-ui-200 dark:border-ui-800',
		)}>
			<p className="container text-xs">
				Headplane is entirely free to use.
				{' '}
				If you find it useful, consider
				{' '}
				<Link
					to="https://github.com/sponsors/tale"
					name="Aarnav's GitHub Sponsors"
				>
					donating
				</Link>
				{' '}
				to support development.
				{' '}
			</p>
			<p className="container text-xs opacity-75">
				Version: {__VERSION__}
				{' | '}
				Connecting to
				{' '}
				<strong>{url}</strong>
				{' '}
				{debug && '(Debug mode enabled)'}
			</p>
		</footer>
	)
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
			<Footer {...data} />
		</>
	)
}

export function ErrorBoundary() {
	return (
		<>
			<Header />
			<ErrorPopup type="embedded" />
			<Footer url="Unknown" debug={false} />
		</>
	)
}
