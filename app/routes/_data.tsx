import { CpuChipIcon, ServerStackIcon, UsersIcon } from '@heroicons/react/24/outline'
import { type LoaderFunctionArgs, redirect } from '@remix-run/node'
import { Outlet } from '@remix-run/react'

import TabLink from '~/components/TabLink'
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
			console.error(error)
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

	// eslint-disable-next-line unicorn/no-null
	return null
}

export default function Layout() {
	return (
		<>
			<header className='bg-gray-800 text-white mb-16'>
				<nav className='container mx-auto'>
					<div className='flex items-center gap-x-2 mb-8 pt-4'>
						<CpuChipIcon className='w-8 h-8'/>
						<h1 className='text-2xl'>Headplane</h1>
					</div>
					<div className='flex items-center gap-x-4'>
						<TabLink to='/machines' name='Machines' icon={<ServerStackIcon className='w-4 h-4'/>}/>
						<TabLink to='/users' name='Users' icon={<UsersIcon className='w-4 h-4'/>}/>
					</div>
				</nav>
			</header>

			<main className='container mx-auto overscroll-contain'>
				<Outlet/>
			</main>
		</>
	)
}

