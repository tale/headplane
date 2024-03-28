import { ExclamationTriangleIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline'
import type { LinksFunction, MetaFunction } from '@remix-run/node'
import {
	isRouteErrorResponse,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useRouteError
} from '@remix-run/react'
import clsx from 'clsx'

import Toaster from '~/components/Toaster'
import stylesheet from '~/tailwind.css?url'
import { getContext } from '~/utils/config'

export const meta: MetaFunction = () => [
	{ title: 'Headplane' },
	{ name: 'description', content: 'A frontend for the headscale coordination server' }
]

export const links: LinksFunction = () => [
	{ rel: 'stylesheet', href: stylesheet }
]

export async function loader() {
	await getContext()

	if (!process.env.HEADSCALE_URL) {
		throw new Error('The HEADSCALE_URL environment variable is required')
	}

	if (!process.env.COOKIE_SECRET) {
		throw new Error('The COOKIE_SECRET environment variable is required')
	}

	if (!process.env.API_KEY) {
		throw new Error('The API_KEY environment variable is required')
	}

	// eslint-disable-next-line unicorn/no-null
	return null
}

export function Layout({ children }: { readonly children: React.ReactNode }) {
	return (
		<html lang='en'>
			<head>
				<meta charSet='utf-8'/>
				<meta name='viewport' content='width=device-width, initial-scale=1'/>
				<Meta/>
				<Links/>
			</head>
			<body className='overscroll-none'>
				{children}
				<Toaster/>
				<ScrollRestoration/>
				<Scripts/>
			</body>
		</html>
	)
}

export function ErrorBoundary() {
	const error = useRouteError()
	const routing = isRouteErrorResponse(error)
	const message = (error instanceof Error ? error.message : 'An unexpected error occurred')
	return (
		<div className='flex min-h-screen items-center justify-center'>
			<div className={clsx(
				'w-1/3 border p-4 rounded-lg flex flex-col items-center text-center',
				routing ? 'gap-2' : 'gap-4'
			)}
			>
				{routing ? (
					<>
						<QuestionMarkCircleIcon className='text-gray-500 w-14 h-14'/>
						<h1 className='text-2xl font-bold'>{error.status}</h1>
						<p className='opacity-50 text-sm'>{error.statusText}</p>
					</>
				) : (
					<>
						<ExclamationTriangleIcon className='text-red-500 w-14 h-14'/>
						<h1 className='text-2xl font-bold'>Error</h1>
						<code className='bg-gray-100 p-1 rounded-md'>
							{message}
						</code>
						<p className='opacity-50 text-sm mt-4'>
							If you are the administrator of this site, please check your logs for information.
						</p>
					</>
				)}
			</div>
		</div>
	)
}

export default function App() {
	return <Outlet/>
}
