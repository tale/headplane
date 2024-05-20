import type { LinksFunction, MetaFunction } from '@remix-run/node'
import {
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
} from '@remix-run/react'

import { ErrorPopup } from '~/components/Error'
import { Toaster } from '~/components/Toaster'
import stylesheet from '~/tailwind.css?url'

export const meta: MetaFunction = () => [
	{ title: 'Headplane' },
	{ name: 'description', content: 'A frontend for the headscale coordination server' },
]

export const links: LinksFunction = () => [
	{ rel: 'stylesheet', href: stylesheet },
]

export function Layout({ children }: { readonly children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<Meta />
				<Links />
			</head>
			<body className="overscroll-none dark:bg-ui-950 dark:text-ui-50">
				{children}
				<Toaster />
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	)
}

export function ErrorBoundary() {
	return <ErrorPopup />
}

export default function App() {
	return <Outlet />
}
